# Quickstart: 041 — Error States UX Audit

## Prerequisites

- Node.js 20+ / bun 1.x
- Go 1.25+
- Working kubeconfig (for E2E only)

## Running the frontend dev server

```bash
# From the worktree root
cd web
bun install          # first time only
bun run dev          # starts Vite dev server on :5173
```

The Go backend must be running on :40107 for API calls to proxy correctly (configured in
`web/vite.config.ts`).

## Running the Go backend

```bash
# From the worktree root
make go CMD="run ./cmd/kro-ui/... serve"
```

## Type-checking

```bash
cd web && bun run typecheck
```

All TypeScript must pass `tsc --noEmit` with no errors.

## Unit tests

```bash
cd web && bun run test        # watch mode
cd web && bun run test --run  # single run (CI mode)
```

The new `errors.test.ts` and `conditions.test.ts` additions run in this suite.

## Verifying the new `errors.ts` module

```bash
cd web && bun run test --run src/lib/errors.test.ts
```

Expected output: all table-driven test cases pass (empty string, known patterns, no-match
passthrough, context-sensitive CRD hint).

## E2E tests (requires kind cluster)

```bash
# Full E2E run
make test-e2e

# Keep cluster for iteration
SKIP_KIND_DELETE=true make test-e2e
```

The error-state changes must not break any existing Playwright journeys. No new E2E journeys
are required for this spec (all changes are defensive display improvements to paths the
existing journeys don't assert on).

## Verifying specific fixes visually

Start the full stack and open the browser to verify:

| Finding | How to trigger |
|---|---|
| H-1 (RGD detail load error) | Navigate to `/rgds/nonexistent-rgd` |
| H-2 (Instances tab when RGD not Ready) | Apply an invalid RGD YAML; open Instances tab |
| M-9 (Fleet empty kubeconfig) | Start kro-ui with an empty `~/.kube/config` |
| M-10 (No events TTL hint) | Open an instance detail with no recent events |
| FR-031 (ConditionsPanel labels) | Open any instance with conditions; verify "Healthy"/"Failed"/"Pending" |
| FR-019 (FleetMatrix legend) | Open Fleet page with 2+ clusters; verify legend row |

## Key files changed by this spec

```
web/src/lib/errors.ts          ← new — translateApiError()
web/src/lib/errors.test.ts     ← new — unit tests
web/src/lib/conditions.ts      ← +conditionStatusLabel()
web/src/lib/conditions.test.ts ← +conditionStatusLabel tests
web/src/pages/RGDDetail.tsx    ← H-1, H-2, M-13
web/src/pages/InstanceDetail.tsx ← M-5, M-18
web/src/pages/Events.tsx       ← M-1 + Retry button
web/src/components/ErrorsTab.tsx ← H-3, L-9
web/src/components/AccessTab.tsx ← H-4
web/src/components/InstanceOverlayBar.tsx ← H-5, H-6, L-8
web/src/components/LiveNodeDetailPanel.tsx ← M-6
web/src/components/CollectionPanel.tsx ← M-7, L-6, L-7
web/src/components/ExpandableNode.tsx ← M-8, L-5
web/src/components/EventsPanel.tsx ← M-10, L-3
web/src/components/SpecPanel.tsx ← M-11
web/src/components/StaticChainDAG.tsx ← M-12, L-4, L-5
web/src/components/FleetMatrix.tsx ← M-15, M-16
web/src/components/ClusterCard.tsx ← M-17
web/src/components/ConditionsPanel.tsx ← L-10
web/src/components/MetricsStrip.tsx ← L-11
web/src/components/Catalog.tsx ← M-1, L-12
web/src/components/Fleet.tsx ← M-1, M-9
web/src/components/Home.tsx ← M-1
web/src/components/LiveDAG.tsx ← L-1, L-2
web/src/components/DeepDAG.tsx ← L-1
```
