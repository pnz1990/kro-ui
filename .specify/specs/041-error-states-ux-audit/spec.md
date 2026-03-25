# Spec 041 — Error States, Empty States, and Symbol Legend UX Audit

**GH Issue**: #187  
**Type**: UX Enhancement + Bug Fix  
**Scope**: Frontend only — `web/src/`  
**Status**: Merged (PR #208)

---

## Overview

kro-ui is meant not only to visualise cluster state but to help operators **fix problems**.
Today, nearly every error path forwards a raw Go/Kubernetes API error string directly to the
screen, and nearly every empty state gives no guidance on what to do next.

This spec covers the full audit: 6 HIGH, 14 MEDIUM, and 12 LOW findings from issue #187.

---

## Guiding Principle

Every error, empty state, and symbol in the UI must answer three questions:

1. **What happened?** (translated, not a raw Go/k8s error string)
2. **Why did it happen?** (distinguish CRD-not-provisioned from network error from RBAC gap)
3. **What should I do?** (link to the relevant tab, kubectl command, or doc)

---

## Root Cause: No Error Translation Layer

Almost all HIGH and MEDIUM findings share a single root cause: `web/src/lib/api.ts:9–11`
forwards the raw `body.error` from the Go backend verbatim. The recommended fix is a new
`web/src/lib/errors.ts` module with a `translateApiError()` function.

### Error translation table

| Raw error pattern | User-readable message |
|---|---|
| `"the server could not find the requested resource"` | "The API server doesn't recognise this resource type — the CRD may not be provisioned yet. Check the Validation tab." |
| `"no kind \"X\" is registered"` | "The kind 'X' is not registered in this cluster — the RGD CRD hasn't been created yet." |
| HTTP 403 / `forbidden` | "Permission denied — kro-ui's service account lacks access. Check the Access tab." |
| HTTP 401 / `Unauthorized` | "Not authenticated — your kubeconfig credentials may have expired." |
| `dial tcp ... connection refused` / HTTP 503 | "Cannot reach the Kubernetes API server — check cluster connectivity." |
| `context deadline exceeded` | "Request timed out — the cluster may be under load. Try again." |
| `x509: certificate` | "TLS certificate error — your kubeconfig certificate may be invalid or expired." |

---

## Functional Requirements

### FR-001 — `errors.ts` translation utility (ROOT CAUSE FIX)

Create `web/src/lib/errors.ts` with:

```ts
translateApiError(message: string, context?: {
  rgdReady?: boolean   // if false, prefer CRD-not-provisioned wording
  tab?: string         // hint for contextual suggestions (e.g. "validation")
}): string
```

- Maps all patterns from the table above
- Returns the raw message unchanged when no pattern matches
- Exported and covered by unit tests in `errors.test.ts`

### FR-002 — HIGH: RGD detail full-page error (H-1)

**File**: `RGDDetail.tsx:318–320`

Current: `<div className="rgd-detail-error">Error: {error}</div>`

Fix:
- Translate error via `translateApiError()`
- Add a "Retry" button that re-fetches the RGD
- Add a "← Back to Overview" link (`<Link to="/">`)
- Wrap in `role="alert"`

### FR-003 — HIGH: Instances tab raw API error (H-2)

**File**: `RGDDetail.tsx:502–503`

Fix:
- If `readyState.state === 'error'` (RGD not Ready), show:
  > "This RGD's CRD has not been provisioned yet. Instances can only be created once the RGD is
  > Ready. Check the [Validation tab](?tab=validation) for details."
- For other errors: `translateApiError()` + Retry button

### FR-004 — HIGH: ErrorsTab API error (H-3)

**File**: `ErrorsTab.tsx:226`

Fix:
- Translate: 403 → "kro-ui does not have permission to list instances in this namespace"
- Translate: 404 / CRD-not-found → "RGD CRD not found — check the [Validation tab](?tab=validation)"
- Other → generic translated message with Retry

### FR-005 — HIGH: AccessTab API error (H-4)

**File**: `AccessTab.tsx:100–119`

Fix:
- 403 → "kro-ui's own service account lacks permissions to run access checks. Check that
  the Helm ClusterRole is installed."
- Other → translated message with Retry

### FR-006 — HIGH: InstanceOverlayBar picker error (H-5)

**File**: `InstanceOverlayBar.tsx:96–108`

Fix:
- If RGD not Ready: "Could not load instance list — the RGD CRD may not be provisioned yet"
- Network/other: "Could not load instance list — check cluster connectivity"
- Add `role="alert"` to the error span

### FR-007 — HIGH: InstanceOverlayBar overlay error (H-6)

**File**: `InstanceOverlayBar.tsx:167–178`

Fix:
- 404 → "Instance not found — it may have been deleted"
- Other → "Could not load overlay data — check cluster connectivity"
- Add `role="alert"` to the error div

### FR-008 — MEDIUM: Page-level raw error banners (M-1–M-4)

**Files**: `Home.tsx:179`, `Catalog.tsx:188`, `Fleet.tsx:234`, `Events.tsx:275`

Fix:
- Wrap all `{error}` renderings in `translateApiError(error)`
- `Events.tsx` additionally needs a Retry button (the only page missing one)

### FR-009 — MEDIUM: InstanceDetail RGD spec load failure (M-5)

**File**: `InstanceDetail.tsx:352–354`

Fix:
- Add `<Link to={`/rgds/${rgdName}`}>← Back to {rgdName}</Link>`
- Translate the error message
- Explain: "The RGD may have been deleted or renamed"

### FR-010 — MEDIUM: LiveNodeDetailPanel YAML error — no Retry (M-6)

**File**: `LiveNodeDetailPanel.tsx:188`

Fix:
- Add Retry button to generic error branch (matching the timeout branch at lines 179–185)
- Translate common errors: 403 → "No permission to read this resource"; 404 → "Resource not
  found in cluster — it may not have been created yet"

### FR-011 — MEDIUM: CollectionPanel item YAML error — no Retry (M-7)

**File**: `CollectionPanel.tsx:263`

Fix: Same as FR-010 — add Retry button to the generic error branch

### FR-012 — MEDIUM: DeepDAG child-load error (M-8)

**File**: `ExpandableNode.tsx:249–256`

Fix:
- Translate "No X instance found" → "No [Kind] instance found in namespace [ns] — it may
  not have been created yet or may be in a different namespace"
- Add Retry button (call the existing retry mechanism)

### FR-013 — MEDIUM: Fleet empty kubeconfig state (M-9)

**File**: `Fleet.tsx:242–244`

Fix:
- Replace "No kubeconfig contexts found." with:
  > "No kubeconfig contexts found. Mount a kubeconfig file and restart kro-ui, or check that
  > your `~/.kube/config` contains at least one context."

### FR-014 — MEDIUM: EventsPanel "No events." — missing TTL explanation (M-10)

**File**: `EventsPanel.tsx:69`

Fix:
- Replace "No events." with:
  > "No events found. Kubernetes events expire after ~1 hour — run
  > `kubectl get events -n [ns]` to check for recent activity."
- The `ns` should be the instance's namespace (prop-drilled or from context)

### FR-015 — MEDIUM: SpecPanel "No spec fields." (M-11)

**File**: `SpecPanel.tsx:41`

Fix:
- Replace "No spec fields." with:
  > "No spec fields defined. Check the RGD's [Docs tab](?tab=docs) to see the schema."

### FR-016 — MEDIUM: StaticChainDAG "RGD not found" (M-12)

**File**: `StaticChainDAG.tsx:181`

Fix:
- Replace "RGD not found" with:
  > "Chained RGD '[chainedName]' not found in this cluster — it may have been deleted or not yet applied."

### FR-017 — MEDIUM: "No managed resources defined" on Graph tab and instance DAG (M-13–M-14)

**Files**: `RGDDetail.tsx:469`, `InstanceDetail.tsx:390`

Fix:
- Replace the bare "No managed resources defined in this RGD." with:
  > "No managed resources defined in this RGD. Open the [YAML tab](?tab=yaml) to inspect the
  > spec, or use the [Generate tab](?tab=generate) to scaffold a new resource."
- On the instance DAG, link to the static RGD DAG (breadcrumb back to RGD detail)

### FR-018 — MEDIUM: FleetMatrix "No RGDs found" (M-15)

**File**: `FleetMatrix.tsx:44–49`

Fix:
- Replace "No RGDs found across any cluster." with:
  > "No ResourceGraphDefinitions found. Apply an RGD to any connected cluster to see it here."
- Add a link to `/author`

### FR-019 — MEDIUM: FleetMatrix color dots — no legend (M-16)

**File**: `FleetMatrix.tsx` (above the table)

Fix:
- Add a compact legend row: `● Present  ● Degraded  — Absent`
- Tokens: `--color-alive` (present), `--color-reconciling` (degraded)
- No new tokens needed

### FR-020 — MEDIUM: ClusterCard health dot — color-only healthy state (M-17)

**File**: `ClusterCard.tsx:40–44`

Fix:
- Add inline text label for the healthy state (matching amber/red/grey states which already show text)
- Ensure all health states have a text label alongside the dot

### FR-021 — MEDIUM: "Refresh paused" banner — swallows underlying error (M-18)

**File**: `InstanceDetail.tsx:344–348`

Fix:
- Show translated error alongside the retry countdown:
  > "Refresh paused ([translated reason]) — retrying in 10s"

### FR-022 — LOW: DAGLegend not rendered on LiveDAG and DeepDAG (L-1)

**Files**: `LiveDAG.tsx`, `DeepDAG.tsx`

Fix:
- Render `<DAGLegend />` below the DAG SVG on all DAG variants, not only `StaticChainDAG`

### FR-023 — LOW: Live-state legend missing on Live DAG (L-2)

**File**: `LiveDAG.tsx`

Fix:
- Add a live-state legend row below the DAG with colour + label for each node state:
  alive (green), reconciling (amber), pending (violet), error (rose), not-found (grey)
- Uses existing `--color-*` tokens

### FR-024 — LOW: EventsPanel deletion tag — no text label (L-3)

**File**: `EventsPanel.tsx:80–82`

Fix:
- Add "Deletion" text alongside `⊘` glyph (the glyph remains `aria-hidden="true"`)

### FR-025 — LOW: StaticChainDAG cycle indicator — SVG aria-label unreliable (L-4)

**File**: `StaticChainDAG.tsx:492`

Fix:
- Add visible "(cycle)" text label next to the `⊗` glyph in the node

### FR-026 — LOW: StaticChainDAG / ExpandableNode max-depth indicator (L-5)

**Files**: `StaticChainDAG.tsx:479`, `ExpandableNode.tsx:208`

Fix:
- Add visible "(max depth)" text next to `⋯` glyph

### FR-027 — LOW: CollectionPanel empty collection — no CEL guidance (L-6)

**File**: `CollectionPanel.tsx:405–408`

Fix:
- Replace "Empty collection — 0 resources" with:
  > "Empty collection. The forEach expression evaluated to an empty list. Check the forEach CEL expression above."

### FR-028 — LOW: CollectionPanel legacy notice — no upgrade guidance (L-7)

**File**: `CollectionPanel.tsx:401–404`

Fix:
- Add: "kro < 0.8.0 lacks `kro.run/node-id` labels — upgrade kro to enable collection drill-down."

### FR-029 — LOW: InstanceOverlayBar empty state — no Generate tab link (L-8)

**File**: `InstanceOverlayBar.tsx:109–115`

Fix:
- Change "No instances — create one with `kubectl apply`" to also include a link to `?tab=generate`

### FR-030 — LOW: ErrorsTab empty state — no Generate tab link (L-9)

**File**: `ErrorsTab.tsx:241`

Fix:
- Add link to `?tab=generate` alongside the `kubectl apply` instruction

### FR-031 — LOW: ConditionsPanel — raw True/False/Unknown strings (L-10)

**File**: `ConditionsPanel.tsx:96`

Fix:
- Map `"True"` → `"Healthy"`, `"False"` → `"Failed"`, `"Unknown"` → `"Pending"`
- Exception: negation-polarity conditions (`NEGATION_POLARITY_CONDITIONS`) — for these,
  `"False"` → `"Healthy"`, `"True"` → `"Failed"`

### FR-032 — LOW: MetricsStrip — stale --metrics-url reference (L-11)

**File**: `MetricsStrip.tsx:82`

Fix:
- Replace "start kro-ui with --metrics-url to enable" with:
  "Controller metrics unavailable — kro controller pod not found in this cluster"

### FR-033 — LOW: Catalog empty state order — filter vs onboarding (L-12)

**File**: `Catalog.tsx:217`

Fix:
- Check `hasFilters` first, then `items.length === 0`:
  - If `hasFilters && filtered.length === 0`: show "No RGDs match your filter."
  - If `!hasFilters && items.length === 0`: show the onboarding empty state

---

## Non-Goals

- Backend changes — all fixes are frontend-only
- New loading skeleton components — use existing `<SkeletonCard />` or plain text (skeleton
  consistency is a separate audit)
- Retry logic changes beyond adding missing Retry buttons

---

## Acceptance Criteria

1. `web/src/lib/errors.ts` exists with `translateApiError()` covered by unit tests
2. All 6 HIGH findings resolved
3. All 14 MEDIUM findings resolved
4. All 12 LOW findings resolved
5. `go vet ./...` passes
6. `bun run typecheck` passes (TypeScript strict mode, no new `any` escapes)
7. Existing E2E journeys pass unmodified

---

## File Impact Summary

### New files

- `web/src/lib/errors.ts` — error translation utility
- `web/src/lib/errors.test.ts` — unit tests

### Modified files

| File | Findings |
|---|---|
| `web/src/pages/RGDDetail.tsx` | FR-002, FR-003, FR-017 |
| `web/src/pages/InstanceDetail.tsx` | FR-009, FR-021 |
| `web/src/pages/Home.tsx` | FR-008 |
| `web/src/pages/Catalog.tsx` | FR-008, FR-033 |
| `web/src/pages/Fleet.tsx` | FR-008, FR-013 |
| `web/src/pages/Events.tsx` | FR-008 |
| `web/src/components/ErrorsTab.tsx` | FR-004, FR-030 |
| `web/src/components/AccessTab.tsx` | FR-005 |
| `web/src/components/InstanceOverlayBar.tsx` | FR-006, FR-007, FR-029 |
| `web/src/components/LiveNodeDetailPanel.tsx` | FR-010 |
| `web/src/components/CollectionPanel.tsx` | FR-011, FR-027, FR-028 |
| `web/src/components/ExpandableNode.tsx` | FR-012, FR-026 |
| `web/src/components/EventsPanel.tsx` | FR-014, FR-024 |
| `web/src/components/SpecPanel.tsx` | FR-015 |
| `web/src/components/StaticChainDAG.tsx` | FR-016, FR-025, FR-026 |
| `web/src/components/FleetMatrix.tsx` | FR-018, FR-019 |
| `web/src/components/ClusterCard.tsx` | FR-020 |
| `web/src/components/ConditionsPanel.tsx` | FR-031 |
| `web/src/components/MetricsStrip.tsx` | FR-032 |
| `web/src/components/LiveDAG.tsx` | FR-022, FR-023 |
| `web/src/components/DeepDAG.tsx` | FR-022 |
