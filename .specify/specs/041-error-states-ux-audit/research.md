# Research: 041 — Error States UX Audit

## 1. Error translation placement strategy

### Decision
Place the translation layer in a new `web/src/lib/errors.ts` module, called at render time
in each component, **not** at the `api.ts` fetch layer.

### Rationale
- `api.ts` is intentionally minimal (it's a typed fetch wrapper). Inserting translation there
  would entangle display concerns with the data layer, and would make it impossible to vary
  the translation based on render context (e.g. "is the RGD Ready?" for H-2).
- Calling at render time lets each component pass `context` (`rgdReady`, `tab`) to
  `translateApiError()`, enabling context-sensitive messages (e.g. H-2's CRD-not-provisioned
  hint only when `readyState.state === 'error'`).
- Consistent with `conditions.ts` precedent: that module also translates raw Kubernetes
  condition strings (`rewriteConditionMessage`) at render time, not at fetch time.

### Alternatives considered
- **Translate in `api.ts`**: Rejected — no render context available; would need a second
  pass anyway for context-sensitive messages.
- **Translate in each component inline (no shared module)**: Rejected — 21 sites, guaranteed
  divergence over time (same anti-pattern the constitution §IX prohibits for `nodeTypeLabel`).
- **Backend Go translation**: Rejected — the backend is intentionally a thin proxy; API
  consumers other than kro-ui (curl, scripts) need raw k8s error strings.

---

## 2. Error pattern coverage

### Decision
Implement 7 regex/substring patterns covering the errors surfaced in issue #187.

### Pattern list (final)

| Priority | Pattern | Match mechanism | Translation |
|---|---|---|---|
| 1 | `the server could not find the requested resource` | `includes()` | CRD not provisioned + Validation tab link (when context available) |
| 2 | `no kind "X" is registered` | regex `/no kind "([^"]+)" is registered/i` | Kind-specific not registered |
| 3 | HTTP 403 / `forbidden` | `includes('403')` or `includes('forbidden')` (case-insensitive) | Permission denied + Access tab link |
| 4 | HTTP 401 / `Unauthorized` | `includes('401')` or `includes('Unauthorized')` | Credentials expired |
| 5 | `dial tcp` / `connection refused` / HTTP 503 | `includes('connection refused')` or `includes('dial tcp')` or `includes('503')` | Cannot reach API server |
| 6 | `context deadline exceeded` | `includes('context deadline exceeded')` | Timed out, cluster under load |
| 7 | `x509: certificate` | `includes('x509')` | TLS certificate error |

### Rationale
- `includes()` preferred over full regex for patterns with no extraction need (simpler, faster).
- Regex used only for pattern 2 where kind extraction improves the message quality.
- Case-insensitive matching for 401/403 human labels (`Unauthorized`, `forbidden`) since Go
  `k8s.io/apimachinery` formats these both ways depending on the path.
- Patterns checked in priority order: more specific patterns before generic ones.

### Alternatives considered
- **Single catch-all regex with named groups**: More complex, harder to maintain, no benefit
  over sequential `includes()` checks.
- **Error code enum + map**: Over-engineered for 7 patterns; `if/else if` is simpler and just
  as readable.

---

## 3. Retry button patterns — inline function vs callback ref

### Decision
Keep the inline anonymous function pattern used in `AccessTab.tsx` and `RGDDetail.tsx`
Instances tab for new Retry buttons. Do **not** refactor existing Retry buttons to callbacks.

### Rationale
- The issue is about **adding** Retry buttons to sites that are missing them (H-1, M-6, M-7,
  M-8). Refactoring existing Retry buttons is out of scope for this spec.
- The inline function pattern is already used in 5 places across the codebase; introducing a
  different pattern for new Retry buttons would create inconsistency.
- `ErrorsTab.tsx` uses a named callback (`fetchInstances`) because it's also invoked by
  `useEffect` — that requirement doesn't apply to the new sites.

### Alternatives considered
- **Extract a `<RetryButton>` component**: Premature abstraction — the surrounding error
  banners are all structurally different; a shared component would need too many props.

---

## 4. ConditionsPanel status label mapping (FR-031)

### Decision
Map `"True"` → `"Healthy"`, `"False"` → `"Failed"`, `"Unknown"` → `"Pending"` using
`NEGATION_POLARITY_CONDITIONS` from `conditions.ts` for inverted polarity.

### Rationale
- Consistent with `ValidationTab.tsx` which already shows `"Healthy"` / `"Failed"` / `"Pending"`.
- `NEGATION_POLARITY_CONDITIONS` is already the single source of truth for polarity; using it
  here propagates the correct inversion automatically.
- `"Pending"` for `"Unknown"` is consistent with the design system's `--color-status-pending`
  semantic and better communicates the state to operators.

### Alternatives considered
- **Keep raw `"True"` / `"False"` strings**: Rejected — the issue explicitly calls this out
  as a UX gap (L-10); raw k8s strings are inconsistent with `ValidationTab`.
- **Map `"Unknown"` → `"Unknown"`**: Less operator-friendly than `"Pending"`.

---

## 5. Live-state legend in LiveDAG (FR-023)

### Decision
Add a compact row of colour-labelled dots below the LiveDAG SVG using the existing
`--color-alive`, `--color-reconciling`, `--color-pending`, `--color-error`,
`--color-not-found` tokens. No new tokens required.

### Rationale
- All required colours are already defined in `tokens.css` as semantic tokens.
- The pattern follows the existing `DAGLegend` component structure — same CSS pattern.
- Issue #167 explicitly tracks the missing live-state legend; this spec resolves it.

### Alternatives considered
- **Extend `DAGLegend` to optionally show live states**: `DAGLegend` is small and purely
  presentational; a boolean prop to toggle live-state entries is simpler than a separate
  component, but adds coupling. A dedicated inline legend block in `LiveDAG.tsx` keeps
  the separation cleaner.

---

## 6. FleetMatrix legend (FR-019)

### Decision
Add a legend row above (or below) the matrix using inline spans with `--color-alive` (present)
and `--color-reconciling` (degraded) dots. The absent state is shown as `—` (no dot).

### Rationale
- Existing `fleet-matrix__dot--present` and `fleet-matrix__dot--degraded` already apply
  background-color from tokens. The legend can reuse the same CSS class with an `aria-hidden`
  dot and adjacent text.
- No new tokens needed.

### Alternatives considered
- **Add a `<FleetMatrixLegend />` component**: Over-engineering for 2 items in a single file.

---

## 7. `errors.ts` signature design

### Final API

```ts
// web/src/lib/errors.ts

export interface TranslateContext {
  /** When true, prefer "CRD may not be provisioned yet" wording for resource-not-found errors */
  rgdReady?: boolean
  /** Tab name hint for contextual "check the X tab" suggestions */
  tab?: string
}

/**
 * Translates a raw API error message string into a user-readable message.
 * Returns the original message unchanged when no known pattern matches.
 */
export function translateApiError(message: string, context?: TranslateContext): string
```

### Rationale
- `TranslateContext` is optional — callers that don't have RGD-readiness info (e.g. page-level
  errors) can omit it and get a reasonable generic message.
- The function is pure (no side effects, no React imports) — easy to unit test.
- Returns the raw message on no-match rather than a generic fallback, because some raw k8s
  errors are already readable (e.g. quota exceeded, resource version conflict).

---

## 8. NEEDS CLARIFICATION resolutions

All items were either unambiguous from the issue or resolved by codebase inspection:

| Item | Resolution |
|---|---|
| Should `api.ts` be modified? | No — translation happens at render |
| Is a new CSS file needed for `errors.ts`? | No — `errors.ts` is a pure TS utility |
| What token should live-state legend dots use? | Existing `--color-alive` etc. — no new tokens |
| Should `ConditionsPanel` use a helper from `conditions.ts`? | Yes — `NEGATION_POLARITY_CONDITIONS` for polarity; add `conditionStatusLabel()` to `conditions.ts` |
| Does `EventsPanel` need namespace prop for M-10? | Yes — pass `namespace` prop from `InstanceDetail` (already available in render scope) |
| Should DAGLegend be extended or a new component used for live states? | Inline legend block in `LiveDAG.tsx` (see §5) |
