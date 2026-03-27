# Implementation Plan: kro v0.9.0 Upgrade — UI Compatibility & Feature Surfacing

**Branch**: `046-kro-v090-upgrade` | **Date**: 2026-03-26 | **Spec**: `.specify/specs/046-kro-v090-upgrade/spec.md`
**Input**: Feature specification from `/specs/046-kro-v090-upgrade/spec.md`

## Summary

kro v0.9.0 (released 2026-03-24) ships `GraphRevision` CRD, `scope`/`types`
schema fields, cartesian forEach, CEL comprehension macros, and
`externalRef.metadata.selector`. kro-ui must surface these via: a new
GraphRevision backend API, capabilities detection update, scope badges on RGD
cards/detail, DocsTab types section, and capabilities baseline update.

## Technical Context

**Language/Version**: Go 1.25 (backend) + TypeScript 5.x / React 19 (frontend)
**Primary Dependencies**: chi v5, zerolog, client-go dynamic, React 19 + Vite — no new deps
**Storage**: N/A — all state in React `useState`; no persistence
**Testing**: `go test -race ./...` (Go), `bun test` via Vitest (TS), Playwright E2E
**Target Platform**: Linux server binary + browser (dark mode first)
**Project Type**: Go binary + embedded React SPA (read-only kro dashboard)
**Performance Goals**: ≤5s per HTTP handler; discovery cached ≥30s (§XI)
**Constraints**: Read-only Kubernetes API calls only (§III). No new npm or Go packages.
**Scale/Scope**: 5,000+ RGDs; 10+ clusters. All badge/label rendering O(1) per card.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| §I Iterative-First | ✅ PASS | All prerequisites merged. Spec 045 merged (PR #273). |
| §II Cluster Adaptability — dynamic client only | ✅ PASS | New GraphRevision endpoints use dynamic client. GVR discovered via `ServerResourcesForGroupVersion`. |
| §II Cluster Adaptability — no hardcoded field paths | ✅ PASS | `internal.kro.run/v1alpha1` is the only new GVR; group/version/resource are constants in `client.go`, not scattered across handlers. |
| §II Only upstream features | ✅ PASS | All new fields (`scope`, `types`, `GraphRevision`, `lastIssuedRevision`) are from kubernetes-sigs/kro v0.9.0. |
| §III Read-Only | ✅ PASS | New endpoints are GET-only; no mutating verbs added. |
| §V Simplicity — no new deps | ✅ PASS | No npm or Go packages added. Standard library + existing stack only. |
| §IX Theme — no hardcoded colors | ✅ PASS | Scope badge uses existing token `--color-cluster-scoped` (to be added to tokens.css) or reuses `--badge-bg`. Must NOT use hardcoded hex. |
| §XI Performance — no per-request discovery | ✅ PASS | `internal.kro.run/v1alpha1` discovery uses the same cached `CachedServerGroupsAndResources` path. |
| §XII Graceful degradation | ✅ PASS | `lastIssuedRevision` absent → omit. `spec.schema.types` null → hide Types section. `graphrevisions` absent → return `{items: []}`. |
| §XIII UX — page titles | ✅ PASS | No new pages added; existing page titles unchanged. |

**Verdict**: No constitution violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/046-kro-v090-upgrade/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Backend (Go)
internal/
  k8s/
    capabilities.go          # Add HasGraphRevisions to SchemaCapabilities; internal.kro.run detection
    capabilities_test.go     # + TestDetectsGraphRevisions, TestBaselineHasExternalRefSelectorTrue
    client.go                # Add internalKroAPIVersion, graphRevisionGVR constants
  api/
    handlers/
      graph_revisions.go     # NEW: ListGraphRevisions, GetGraphRevision
      graph_revisions_test.go# NEW: unit tests
  server/
    server.go                # Register /kro/graph-revisions routes

# Frontend (TypeScript/React)
web/src/
  lib/
    api.ts                   # Add hasGraphRevisions; listGraphRevisions, getGraphRevision
    features.ts              # BASELINE: hasExternalRefSelector→true, hasGraphRevisions→false
    features.test.ts         # + baseline assertions
    highlighter.ts           # KRO_KEYWORDS: add 'state' if not present (regression guard)
    highlighter.test.ts      # + comprehension token tests (regression guard)
    dag.ts                   # extractScopeFromRGD helper (or inline in RGDCard)
  components/
    RGDCard.tsx              # Scope badge: show "Cluster" when spec.schema.scope === 'Cluster'
    RGDCard.css              # Badge token reference
    RGDDetailHeader.tsx      # Scope badge + lastIssuedRevision display
    DocsTab.tsx              # Types section rendered when spec.schema.types non-null
    DocsTab.test.tsx         # + types section unit tests
    RGDAuthoringForm.tsx     # "Add iterator" button for cartesian forEach (FR-060/061)

# Tokens
web/src/tokens.css           # --badge-cluster-bg/--badge-cluster-fg tokens (or reuse existing)
```

**Structure Decision**: Single project (Go binary + embedded React SPA). All changes are
additive — existing component files extended, one new handler file added.

## Complexity Tracking

> No constitution violations — section intentionally blank.
