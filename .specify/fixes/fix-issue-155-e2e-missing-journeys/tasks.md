# Fix: E2E journey backfill for 21 merged specs

**Issue(s)**: #155
**Branch**: fix/issue-155-e2e-missing-journeys
**Labels**: enhancement

## Root Cause
21 specs were merged after the initial E2E suite was written (covering specs 001–010
and 028). New features were shipped with no automated end-to-end coverage, meaning
regressions in catalog search, fleet view, events filtering, deletion debugger, and
14 other flows are invisible to CI.

## Files to change
All files are new additions under `test/e2e/journeys/`:
- `011-collection-explorer.spec.ts`
- `012-rgd-chaining-deep-graph.spec.ts`
- `014-multi-cluster-overview.spec.ts`
- `015-rgd-catalog.spec.ts`
- `017-rgd-validation-linting.spec.ts`
- `018-rbac-visualizer.spec.ts`
- `019-smart-event-stream.spec.ts`
- `020-schema-doc-generator.spec.ts`
- `021-collection-node-cardinality.spec.ts`
- `022-controller-metrics-panel.spec.ts`
- `023-rgd-optimization-advisor.spec.ts`
- `025-rgd-static-chain-graph.spec.ts`
- `027-instance-telemetry-panel.spec.ts`
- `029-dag-instance-overlay.spec.ts`
- `030-error-patterns-tab.spec.ts`
- `031-deletion-debugger.spec.ts`
- `032-rbac-sa-autodetect.spec.ts`
- `033-first-time-onboarding.spec.ts`
- `034-generate-form-polish.spec.ts`
- `035-global-footer.spec.ts`
- `036-rgd-detail-header.spec.ts`

## Tasks

### Phase 1 — Write journeys (high priority first)
- [x] 015-rgd-catalog — search filter, instance count, used-by detection
- [x] 031-deletion-debugger — TerminatingBanner, FinalizersPanel, events
- [x] 019-smart-event-stream — events page, filter bar, anomaly banners
- [x] 014-multi-cluster-overview — fleet page renders, matrix visible
- [x] 018-rbac-visualizer — access tab, SA detection, permission rows
- [x] 011-collection-explorer — CollectionPanel opens from DAG node click
- [x] 012-rgd-chaining-deep-graph — DeepDAG expansion on instance detail
- [x] 017-rgd-validation-linting — Validation tab, condition rows
- [x] 020-schema-doc-generator — Docs tab, field table
- [x] 021-collection-node-cardinality — forEach badge, cardinality on DAG
- [x] 022-controller-metrics-panel — metrics panel on home page
- [x] 023-rgd-optimization-advisor — advisor visible in catalog
- [x] 025-rgd-static-chain-graph — static chain DAG in RGD detail
- [x] 027-instance-telemetry-panel — telemetry panel on instance detail
- [x] 029-dag-instance-overlay — overlay picker in RGD graph tab
- [x] 030-error-patterns-tab — errors tab on RGD detail
- [x] 032-rbac-sa-autodetect — SA auto-detected, no hardcoded values
- [x] 033-first-time-onboarding — empty state with onboarding content
- [x] 034-generate-form-polish — generate tab required field indicator
- [x] 035-global-footer — footer links present
- [x] 036-rgd-detail-header — kind badge and status dot on all tabs

### Phase 2 — Verify
- [x] Run `bun run tsc --noEmit` in `test/e2e/`
- [x] Smoke-check for obvious selector typos

### Phase 3 — PR
- [ ] Commit: `test(e2e): backfill 21 missing journey files — closes #155`
- [ ] Push and open PR
