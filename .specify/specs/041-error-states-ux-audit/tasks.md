# Tasks: 041 — Error States, Empty States, and Symbol Legend UX Audit

**Input**: Design documents from `.specify/specs/041-error-states-ux-audit/`  
**Branch**: `041-error-states-ux-audit`  
**GH Issue**: #187

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths included in every task description

## User Story Map

| Story | Scope | Priority |
|-------|-------|----------|
| US1 | Error translation layer — `errors.ts` + `conditionStatusLabel` in `conditions.ts` | P1 |
| US2 | HIGH findings: H-1 through H-6 (user blocked, no path forward) | P2 |
| US3 | MEDIUM findings: M-1 through M-18 (confusing but recoverable) | P3 |
| US4 | LOW findings: L-1 through L-12 (missing labels, legends, tooltips) | P4 |

---

## Phase 1: Setup

**Purpose**: Verify toolchain and confirm no stale type errors before starting.

- [X] T001 Run `cd web && bun run typecheck` to confirm zero pre-existing TypeScript errors
- [X] T002 Run `cd web && bun run test --run` to confirm all existing unit tests pass

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the translation utility and condition label helper that every subsequent
phase depends on. **No US2–US4 work can start until this phase is complete.**

**⚠️ CRITICAL**: All phases depend on T003 and T004.

- [X] T003 Create `web/src/lib/errors.ts` with `translateApiError(message, context?)` — implement all 7 error patterns from `research.md §2` (resource-not-found, no-kind-registered, 403/forbidden, 401/Unauthorized, connection-refused/dial-tcp/503, context-deadline-exceeded, x509-certificate); add Apache 2.0 header
- [X] T004 Add `conditionStatusLabel(type, status): string` to `web/src/lib/conditions.ts` — maps `"True"` → `"Healthy"`, `"False"` → `"Failed"`, `"Unknown"` → `"Pending"` with `NEGATION_POLARITY_CONDITIONS` inversion; add Apache 2.0 header is already present
- [X] T005 Create `web/src/lib/errors.test.ts` with table-driven unit tests covering all 9 groups from `contracts/ui-contracts.md`: patterns 1–7, no-match passthrough, edge cases (empty/whitespace string), and context (`rgdReady: false` strengthens CRD hint); add Apache 2.0 header
- [X] T006 Add `conditionStatusLabel` unit tests to `web/src/lib/conditions.test.ts` — table-driven: normal polarity (True/False/Unknown), negation polarity (ReconciliationSuspended), unknown input passthrough
- [X] T007 Run `cd web && bun run test --run src/lib/errors.test.ts src/lib/conditions.test.ts` to confirm T005 and T006 pass

**Checkpoint**: `errors.ts` and updated `conditions.ts` are complete and tested. All subsequent phases can now proceed.

---

## Phase 3: User Story 1 — HIGH findings (H-1 through H-6) (Priority: P2) 🎯 MVP

**Goal**: Eliminate all 6 cases where the user is completely blocked with no path forward.
Every HIGH error site gets translated messages, Retry buttons, and navigation links.

**Independent Test**: Navigate to `/rgds/nonexistent-rgd` (H-1), open Instances tab on a
not-Ready RGD (H-2), open Errors/Access/InstanceOverlay on a broken cluster (H-3 through H-6).
Each shows a translated message, a Retry button, and a "Back" link where applicable.

### Implementation for US1

- [X] T008 [US1] Fix H-1 in `web/src/pages/RGDDetail.tsx:318–320` — replace `<div className="rgd-detail-error">Error: {error}</div>` with a block that: (a) wraps in `role="alert"`, (b) calls `translateApiError(error)`, (c) adds a Retry button that re-calls `fetchRGD`, (d) adds `<Link to="/">← Back to Overview</Link>`; add `data-testid="rgd-detail-error"` to the container
- [X] T009 [US1] Fix H-2 in `web/src/pages/RGDDetail.tsx:500–526` — in the Instances tab error branch: (a) if `readyState.state === 'error'`, show the CRD-not-provisioned message with a link to `?tab=validation`; (b) otherwise call `translateApiError(instancesError, { rgdReady: readyState.state !== 'error' })` with Retry button; keep `data-testid="instance-error-state"`
- [X] T010 [US1] Fix H-3 in `web/src/components/ErrorsTab.tsx:224–236` — replace `Error: {error}` with `translateApiError(error, { tab: 'validation' })`; map 403 → permission message, 404/resource-not-found → CRD hint; keep `data-testid="errors-api-error"` and existing Retry button
- [X] T011 [US1] Fix H-4 in `web/src/components/AccessTab.tsx:100–119` — replace `Error: {error}` with context-specific translation: 403 → "kro-ui's own service account lacks permissions to run access checks. Check that the Helm ClusterRole is installed."; other → `translateApiError(error)`; keep existing Retry button; add `data-testid` to loading div at line 97
- [X] T012 [US1] Fix H-5 in `web/src/components/InstanceOverlayBar.tsx:96–108` — replace raw `pickerError` with translated message: if RGD not Ready → "Could not load instance list — the RGD CRD may not be provisioned yet"; otherwise → "Could not load instance list — check cluster connectivity"; add `role="alert"` to the error span; add `data-testid="overlay-picker-error"`
- [X] T013 [US1] Fix H-6 in `web/src/components/InstanceOverlayBar.tsx:167–178` — replace raw `overlayError` with: 404 / resource-not-found → "Instance not found — it may have been deleted"; other → `translateApiError(overlayError)`; add `role="alert"` to the error div; add `data-testid="overlay-data-error"`

**Checkpoint**: All 6 HIGH findings resolved. Run `bun run typecheck` — must pass.

---

## Phase 4: User Story 2 — MEDIUM findings (M-1 through M-18) (Priority: P3)

**Goal**: Resolve all 14 medium-severity UX gaps where users are confused but not fully
blocked. Enriched empty states, missing Retry buttons, and translated page-level errors.

**Independent Test**: Trigger each error path described in `quickstart.md §Verifying specific
fixes visually`. All page-level errors show translated messages; all medium empty states show
actionable guidance.

### Implementation for US2

- [X] T014 [P] [US2] Fix M-1 (Home page error) in `web/src/pages/Home.tsx:179` — wrap `{error}` in `translateApiError(error)` call; no structural change needed
- [X] T015 [P] [US2] Fix M-2 (Catalog page error) in `web/src/pages/Catalog.tsx:188` — wrap `{error}` in `translateApiError(error)` call
- [X] T016 [P] [US2] Fix M-3 (Fleet page error) in `web/src/pages/Fleet.tsx:234` — wrap `{error}` in `translateApiError(error)` call
- [X] T017 [P] [US2] Fix M-4 (Events page error) in `web/src/pages/Events.tsx:275` — wrap `{error}` in `translateApiError(error)`; additionally add a Retry button that re-calls the fetch function (Events is the only page-level error currently missing a Retry button)
- [X] T018 [P] [US2] Fix M-5 in `web/src/pages/InstanceDetail.tsx:351–355` — add `<Link to={`/rgds/${rgdName}`}>← Back to {rgdName}</Link>` to the `rgdError` block; wrap error message in `translateApiError(rgdError)`; add explanatory text "The RGD may have been deleted or renamed"; wrap in `role="alert"`
- [X] T019 [P] [US2] Fix M-6 in `web/src/components/LiveNodeDetailPanel.tsx:188` — in the generic `error` branch (not timeout), add a Retry button calling `handleRetry`; translate error: 403 → "No permission to read this resource"; 404/resource-not-found → "Resource not found in cluster — it may not have been created yet"; other → `translateApiError(yamlState.message)`; add `role="alert"`
- [X] T020 [P] [US2] Fix M-7 in `web/src/components/CollectionPanel.tsx:263` — same pattern as T019: add Retry button calling `handleRetry` in the generic error branch; translate via `translateApiError(viewState.message)` with 403/404 contextual overrides; add `role="alert"`
- [X] T021 [P] [US2] Fix M-8 in `web/src/components/ExpandableNode.tsx:249–256` — translate `childError` via `translateApiError(childError)`; additionally map "No X instance found" pattern → "No [Kind] instance found in namespace [ns] — it may not have been created yet or may be in a different namespace" (extract Kind and ns from the error string using a regex); add a Retry button that triggers the existing expand/load mechanism; keep `data-testid`
- [X] T022 [P] [US2] Fix M-9 in `web/src/pages/Fleet.tsx:242–244` — replace "No kubeconfig contexts found." paragraph with the full message from spec FR-013 including the `~/.kube/config` hint; add `data-testid="fleet-empty"` to the container
- [X] T023 [P] [US2] Fix M-10 in `web/src/components/EventsPanel.tsx:68–69` — add optional `namespace?: string` prop to `EventsPanelProps` per `data-model.md`; replace `<div className="panel-empty">No events.</div>` with the TTL-explanation message from spec FR-014 including the kubectl command (omit `-n [ns]` clause when namespace prop is undefined); add `data-testid="events-panel-empty"` to the new empty div
- [X] T024 [US2] Pass `namespace` prop to `<EventsPanel>` in `web/src/pages/InstanceDetail.tsx` — extract namespace from `fastData.instance.metadata.namespace` and forward it to `<EventsPanel namespace={ns} events={fastData.events} />`; depends on T023
- [X] T025 [P] [US2] Fix M-11 in `web/src/components/SpecPanel.tsx:40–41` — replace "No spec fields." with the message from spec FR-015: "No spec fields defined. Check the RGD's Docs tab to see the schema." with a `<Link to="?tab=docs">Docs tab</Link>` (use React Router `useSearchParams` or a relative query link)
- [X] T026 [P] [US2] Fix M-12 in `web/src/components/StaticChainDAG.tsx:181` — replace "RGD not found" with the message from spec FR-016: `Chained RGD '${chainedName}' not found in this cluster — it may have been deleted or not yet applied.`; add `role="alert"` to the container div; add `data-testid="static-chain-not-found"`
- [X] T027 [P] [US2] Fix M-13 in `web/src/pages/RGDDetail.tsx:469` — replace "No managed resources defined in this RGD." with the message from spec FR-017 including links to `?tab=yaml` and `?tab=generate`
- [X] T028 [P] [US2] Fix M-14 in `web/src/pages/InstanceDetail.tsx:375–377` — replace "No managed resources defined in this RGD." with the same enriched message; add a breadcrumb back to the RGD's Graph tab
- [X] T029 [P] [US2] Fix M-15 in `web/src/components/FleetMatrix.tsx:44–49` — replace "No RGDs found across any cluster." with "No ResourceGraphDefinitions found. Apply an RGD to any connected cluster to see it here." and a `<Link to="/author">Create your first RGD →</Link>`; add `data-testid="fleet-matrix-empty"` to the container
- [X] T030 [P] [US2] Fix M-16 in `web/src/components/FleetMatrix.tsx` — add a compact legend row above the matrix (inside the `role="region"` wrapper): `● Present  ● Degraded  — Absent`; use `--color-status-ready` for present dot and `--color-status-warning` for degraded dot in inline CSS via `var()`; mark dots `aria-hidden="true"` with adjacent text
- [X] T031 [P] [US2] Fix M-17 in `web/src/components/ClusterCard.tsx:40–44` — the healthy state health dot currently has no text label; add a visible inline text label for `health === 'healthy'` → "Healthy" consistent with amber/red/grey states; use `healthLabel()` return value or map inline
- [X] T032 [P] [US2] Fix M-18 in `web/src/pages/InstanceDetail.tsx:344–348` — update the `poll-error-banner` block to include the translated error reason alongside the countdown: `"Refresh paused (${translateApiError(pollError)}) — retrying in 10s"`; the `role="status"` is acceptable here (non-critical interruption)

**Checkpoint**: All 14 MEDIUM findings resolved. Run `bun run typecheck` — must pass.

---

## Phase 5: User Story 3 — LOW findings (L-1 through L-12) (Priority: P4)

**Goal**: Fill all 12 symbol/legend/label gaps so every glyph and colour has an accompanying
text label or legend, and no UI element relies solely on colour to convey meaning.

**Independent Test**: Open the RGD detail Graph tab (L-1 through L-5), open an instance detail
(L-1, L-2, L-6), open EventsPanel (L-3), open ConditionsPanel (L-10), open MetricsStrip (L-11),
open Catalog with active filters (L-12). All glyphs have visible text; all states have legends.

### Implementation for US3

- [X] T033 [P] [US3] Fix L-1 in `web/src/components/LiveDAG.tsx` — import and render `<DAGLegend />` below the SVG container (following the same pattern as `StaticChainDAG` where it already renders); the legend explains `?` (conditional), `∀` (forEach), `⬡` (external ref)
- [X] T034 [P] [US3] Fix L-1 in `web/src/components/DeepDAG.tsx` — same as T033: import and render `<DAGLegend />` below the SVG container
- [X] T035 [US3] Fix L-2 in `web/src/components/LiveDAG.tsx` — add a live-state legend row below `<DAGLegend />` with five entries: Alive (green `--color-alive`), Reconciling (amber `--color-reconciling`), Pending (violet `--color-pending`), Error (rose `--color-error`), Not found (grey `--color-not-found`); use `aria-hidden="true"` on colour dots with adjacent text; no new tokens needed; depends on T033
- [X] T036 [P] [US3] Fix L-3 in `web/src/components/EventsPanel.tsx:80–82` — add "Deletion" text immediately after the `⊘` glyph span (the glyph keeps `aria-label="deletion event"` and `aria-hidden` is NOT set, so remove it or keep as-is; the adjacent text "Deletion" provides the visible label); ensure the text is styled consistently with event type tags
- [X] T037 [P] [US3] Fix L-4 in `web/src/components/StaticChainDAG.tsx` — locate the `⊗` cycle indicator SVG element; add a visible `<text>` "(cycle)" label adjacent to the glyph; ensure the existing `aria-label` is kept for screen readers
- [X] T038 [P] [US3] Fix L-5 in `web/src/components/StaticChainDAG.tsx` — locate the `⋯` max-depth indicator SVG `<text>` element (around line 479); add visible "(max depth)" text adjacent to the glyph; keep `data-testid="static-chain-maxdepth-*"`
- [X] T039 [P] [US3] Fix L-5 in `web/src/components/ExpandableNode.tsx` — locate the `⋯` max-depth indicator (around line 208) and add a visible "(max depth)" text label adjacent to the glyph
- [X] T040 [P] [US3] Fix L-6 in `web/src/components/CollectionPanel.tsx:405–408` — replace "Empty collection — 0 resources" with the message from spec FR-027: "Empty collection. The forEach expression evaluated to an empty list. Check the forEach CEL expression above."; keep `data-testid="collection-empty-state"`
- [X] T041 [P] [US3] Fix L-7 in `web/src/components/CollectionPanel.tsx:401–404` — expand the legacy notice text to include the upgrade guidance from spec FR-028: "kro < 0.8.0 lacks `kro.run/node-id` labels — upgrade kro to enable collection drill-down."
- [X] T042 [P] [US3] Fix L-8 in `web/src/components/InstanceOverlayBar.tsx:109–115` — add a link to `?tab=generate` in the "No instances — create one with kubectl apply" empty state; use React Router `<Link to={{ search: '?tab=generate' }}>Generate tab</Link>` or a `useNavigate` approach consistent with other tab links in the codebase
- [X] T043 [P] [US3] Fix L-9 in `web/src/components/ErrorsTab.tsx:239–243` — add a link to `?tab=generate` in the "No instances yet. Create one with kubectl apply." empty state; same approach as T042
- [X] T044 [P] [US3] Fix L-10 in `web/src/components/ConditionsPanel.tsx:95–96` — replace raw `{c.status}` with `{conditionStatusLabel(c.type, c.status)}` (import `conditionStatusLabel` from `@/lib/conditions`); the `statusClass(c.type, c.status)` call already handles polarity-aware colour, so only the text label changes
- [X] T045 [P] [US3] Fix L-11 in `web/src/components/MetricsStrip.tsx:82` — replace the `connection refused`/`unreachable` branch message "start kro-ui with --metrics-url to enable" with "Controller metrics unavailable — kro controller pod not found in this cluster" (the `--metrics-url` flag was removed in v0.4.0, spec #040)
- [X] T046 [P] [US3] Fix L-12 in `web/src/pages/Catalog.tsx` — locate the empty-state rendering condition (around line 217); ensure `hasFilters && filteredItems.length === 0` is checked before `items.length === 0` so filtered-no-results shows "No RGDs match your filter." rather than the onboarding empty state; the condition inversion is described in spec FR-033

**Checkpoint**: All 12 LOW findings resolved. Run `bun run typecheck` — must pass.

---

## Phase 6: Polish & Verification

**Purpose**: Final typecheck, full test run, and visual spot-check.

- [X] T047 Run `cd web && bun run typecheck` — zero errors required
- [X] T048 Run `cd web && bun run test --run` — all tests must pass (no regressions in existing tests)
- [X] T049 [P] Verify H-1 fix visually: navigate to `/rgds/nonexistent-rgd`; confirm translated message, Retry button, and "← Back to Overview" link are present
- [X] T050 [P] Verify FR-031 fix visually: open any instance with conditions; confirm "Healthy"/"Failed"/"Pending" labels replace raw "True"/"False"/"Unknown" strings
- [X] T051 [P] Verify FR-019 fix visually: open Fleet page; confirm legend row `● Present  ● Degraded  — Absent` appears above the matrix
- [X] T052 [P] Verify L-2 fix visually: open InstanceDetail live DAG; confirm live-state legend (Alive/Reconciling/Pending/Error/Not found) appears below the DAG
- [X] T053 Run `go vet ./...` (backend is unchanged, but must still pass)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — run immediately
- **Phase 2 (Foundational)**: Depends on Phase 1; **BLOCKS all user story phases**
- **Phase 3 (US1 — HIGH)**: Depends on Phase 2 (needs `translateApiError` from T003)
- **Phase 4 (US2 — MEDIUM)**: Depends on Phase 2; can run in parallel with Phase 3
- **Phase 5 (US3 — LOW)**: Depends on Phase 2; T044 additionally depends on T004 (`conditionStatusLabel`)
- **Phase 6 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (HIGH)**: Depends only on Phase 2 foundation
- **US2 (MEDIUM)**: Depends only on Phase 2; T024 depends on T023
- **US3 (LOW)**: Depends on Phase 2; T035 depends on T033; T044 depends on T004

### Within Each User Story

- All `[P]`-marked tasks within a story touch different files — can run in parallel
- Tasks without `[P]` have sequencing dependencies noted in their descriptions

### Parallel Opportunities

```bash
# Phase 3 (HIGH fixes) — all touch different files, run together:
T008   # RGDDetail.tsx — H-1
T009   # RGDDetail.tsx — H-2  (same file as T008, run sequentially)
T010   # ErrorsTab.tsx — H-3
T011   # AccessTab.tsx — H-4
T012   # InstanceOverlayBar.tsx — H-5
T013   # InstanceOverlayBar.tsx — H-6 (same file as T012, run sequentially)

# Phase 4 (MEDIUM fixes) — most touch different files, batch:
T014 T015 T016 T017 T018 T019 T020 T021 T022 T025 T026 T027 T029 T030 T031
# Sequential only: T024 after T023, T028 after T027 (same page file)

# Phase 5 (LOW fixes) — all touch different files, fully parallel:
T033 T034 T036 T037 T038 T039 T040 T041 T042 T043 T044 T045 T046
# Sequential only: T035 after T033 (same LiveDAG.tsx file)
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (T003–T007)
3. Complete Phase 3: HIGH findings (T008–T013)
4. **STOP and VALIDATE**: All 6 HIGH error paths show translated messages + Retry
5. The most operator-impactful changes ship first

### Incremental Delivery

1. Setup + Foundational → translation utility ready
2. Phase 3 (HIGH) → unblocks operators in error states
3. Phase 4 (MEDIUM) → enriches confusing paths
4. Phase 5 (LOW) → fills legend/label gaps
5. Phase 6 (Polish) → verify and ship

---

## Notes

- `[P]` marks tasks that touch different files from all other parallel tasks — safe to run concurrently
- All error messages must use `translateApiError()` from `web/src/lib/errors.ts` — never inline string comparisons
- All colours in new CSS must use `var(--token)` — never hardcoded hex or `rgba()` literals
- Apache 2.0 header required on new `.ts` files; existing files already have it
- No new npm dependencies introduced by any task
- `go vet ./...` must pass (no Go changes in this spec, but required by CI)
