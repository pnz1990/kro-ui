# Research: RBAC Service Account Auto-Detection

**Branch**: `032-rbac-sa-autodetect`
**Date**: 2026-03-23
**Status**: Complete — all unknowns resolved

---

## Decision 1: Remove hardcoded fallback vs keep it with a warning

**Question**: Should `ResolveKroServiceAccount` return `("kro-system", "kro", false)` as
a convenience fallback (current behavior), or return `("", "", false)` and force the
frontend to handle the missing case?

**Decision**: Return `("", "", false)` and remove the hardcoded fallback entirely.

**Rationale**:
- Constitution §XIII explicitly prohibits hardcoded SA names, namespaces, or label key values
- The original spec (018-rbac-visualizer, Edge Cases) says "MUST NOT hardcode a fallback
  SA name like `'kro'` — derive only from the cluster. If discovery fails, show an error state."
- Returning a hardcoded fallback silently produces wrong results on clusters with
  custom installation namespaces (e.g., `kro-prod/kro-controller`) — the tab shows
  "All permissions satisfied" for the wrong SA
- The frontend manual override form is the correct UX for this edge case

**Alternatives considered**:
- Keep `("kro-system", "kro")` as a documented default with a warning banner
  → Rejected: still violates constitution; still produces silently wrong results
- Fall back to searching all namespaces for a Deployment named "kro*"
  → Considered: more robust but has performance implications (can't list all namespaces
  efficiently without listing all namespaces first); also risks false positives

---

## Decision 2: Manual SA override mechanism — query params vs dedicated endpoint

**Question**: Should the manual SA override use:
- (a) Query params on existing endpoint: `GET /api/v1/rgds/{name}/access?saNamespace=x&saName=y`
- (b) A new POST endpoint with a request body
- (c) A new GET endpoint with path segments

**Decision**: Query params on the existing endpoint (option a).

**Rationale**:
- The operation is still a read (GET) — no mutation; a POST would imply mutation (constitution §III)
- Query params are idiomatic for filtering/overriding GET behavior in REST APIs
- No new route registration needed; chi router already handles query params via `r.URL.Query()`
- The frontend can construct the URL with `URLSearchParams` and call the same `getRGDAccess()`
  function with an options argument
- Backend handler change is minimal: `r.URL.Query().Get("saNamespace")` before auto-detect

**Alternatives considered**:
- New dedicated endpoint `GET /api/v1/kro/service-account` that just returns the detected SA
  → Considered but rejected: adds a round-trip; doesn't help with the override flow
- Store override in server-side session
  → Rejected: kro-ui is stateless; no session layer

---

## Decision 3: Frontend manual form — single `namespace/name` field vs two separate inputs

**Question**: Should the manual override form use:
- (a) A single input with `namespace/name` format
- (b) Two separate inputs: one for namespace, one for SA name

**Decision**: Two separate inputs (option b).

**Rationale**:
- Slash-delimited fields are error-prone for users (unclear which delimiter, easy to
  include spaces or extra slashes)
- Two clearly labeled fields (`Namespace` and `Service account name`) require no
  format knowledge from the user
- Aligns with the display format decision (Decision 4) — if we show them separately
  in the banner, we should input them separately too
- React state for two strings is trivially simple; no parsing needed

**Alternatives considered**:
- Single `namespace/name` input with server-side parsing
  → Rejected: fragile; ambiguous when SA name contains a slash (technically valid in k8s)

---

## Decision 4: SA display banner format

**Question**: How should the SA be displayed in the Access tab banner?

**Decision**: Display as two separately labeled inline elements:
`Namespace: <ns>  ·  Service account: <name>` with a detection source indicator
`(auto-detected)` or `(manually specified)`.

**Rationale**:
- Issue #133 requests explicit labeling of the `namespace/name` format
- The "·" separator is a common pattern in metadata display (already used in other parts of kro-ui)
- Keeping namespace and name on the same line avoids vertical space waste
- The detection source indicator closes the UX gap: users know whether to trust the SA or override it
- `data-testid` attributes make testing straightforward

**Alternatives considered**:
- Display as `namespace: kro  /  service account: kro` (using slash)
  → Considered but the slash could be confused with the raw `namespace/name` format we're trying to clarify
- Show only the SA name with namespace in a tooltip
  → Considered but the namespace is important context when troubleshooting

---

## Decision 5: Behavior when `ComputeAccessResult` receives empty SA from `ResolveKroServiceAccount`

**Question**: What should `ComputeAccessResult` do when `saNS=""` and `saName=""`?

**Decision**: Return an `AccessResult` with empty `ServiceAccount`, `ServiceAccountFound=false`,
empty `Permissions` slice, and `HasGaps=false` (no permissions means no matrix to show).
Do NOT return an error — the absence of an SA is a valid, expected state.

**Rationale**:
- Returning an error would cause the frontend to show the error state (with Retry button)
  rather than the manual override form
- The frontend distinguishes between "error" (network failure, API unreachable) and
  "SA not found" (expected operational case) via the `serviceAccountFound=false` + empty
  `serviceAccount=""` combination
- The `FetchEffectiveRules` function would be called with empty strings and simply return
  no matching rules — which is fine since the SA is unknown anyway; we skip it entirely

**Implementation**: When `saNS==""` (after stripping whitespace), short-circuit
`ComputeAccessResult` and return early with the "not found" result.

---

## Decision 6: `capabilities.go` `kroNamespace` constant — scope of this fix

**Question**: The `capabilities.go` file also hardcodes `kroNamespace = "kro-system"`
(line 96) and `kroDeploymentName = "kro-controller-manager"` (line 97). Should these
be removed as part of this fix?

**Decision**: Out of scope for this spec. The `detectFeatureGatesAndVersion` function in
capabilities.go uses these to look up the specific controller Deployment for feature gate
parsing — it already gracefully handles "not found" with `return nil, ""`. This is a
different concern from the RBAC SA fallback bug:

- `capabilities.go`: hardcodes a specific Deployment name for feature gate detection
  (non-critical; falls back gracefully to no feature gates)
- `rbac.go`: hardcodes a fallback SA name that silently produces **wrong results**
  (critical bug — shows wrong permissions for the wrong SA)

The capabilities.go hardcoding would require a separate spec/issue since it involves a
different detection strategy (look up by name vs look up by SA). Not a §XIII violation
because it's used as a search key, not as a display value or assumed truth.

---

## Research Summary

| Unknown | Resolution |
|---------|------------|
| What to return when SA detection fails | `("", "", false)` — no fallback |
| Override mechanism | Query params on existing GET endpoint |
| Manual form design | Two separate inputs (namespace + name) |
| Banner display format | Labeled `Namespace: X · Service account: Y (source)` |
| Empty SA in `ComputeAccessResult` | Early return with `ServiceAccountFound=false`, empty permissions |
| `capabilities.go` constants | Out of scope; different concern |

All NEEDS CLARIFICATION items resolved. Ready for Phase 1 design.
