# Spec 043: Upstream Fixture Generator

**Branch**: `043-upstream-fixture-generator`
**Status**: In Progress
**GH Issue**: #222

---

## Goal

Achieve confident, comprehensive UI test coverage for every kro upstream feature
and corner case. After this spec, every kro node type, condition variant, and
behavioural edge case supported by `kubernetes-sigs/kro` MUST have a corresponding
fixture in `test/e2e/fixtures/` and at least one Playwright journey step asserting
correct kro-ui rendering. No unknown states. If we find the UI renders something
incorrectly for a feature, that is a bug to surface and fix — not a reason to skip
coverage.

This spec also introduces the `cmd/dump-fixtures` Go tool so future kro releases
can be tracked without hand-authoring YAML.

---

## Deliverables

### Part A — Chain-cycle fixture parity (immediate gap)

`chain-cycle-a.yaml` exists in `test/e2e/fixtures/` but is never applied. Fix it.

### Part B — Upstream fixture generator tool

`cmd/dump-fixtures/main.go` (`//go:build tools`) uses `kro/pkg/testutil/generator`
to programmatically generate fixture YAMLs. Output committed to repo.
`make dump-fixtures` regenerates on new kro releases.

### Part C — New fixture families + journeys

Six new fixture families covering every previously uncovered kro feature:

| # | Fixture family | kro feature gap closed |
|---|----------------|------------------------|
| 1 | Cartesian forEach | 2D `forEach` (region × tier), multi-axis `NodeTypeCollection` |
| 2 | Resource→Collection dependency | `NodeTypeResource` output gating a collection's `forEach` expression |
| 3 | Contagious `includeWhen` | Parent excluded by `includeWhen` → dependent child also excluded |
| 4 | Cluster-scoped CR | `scope: Cluster` — no-namespace instance |
| 5 | `NodeTypeExternalCollection` | `externalRef` with `metadata.selector` — last uncovered node type |
| 6 | CEL two-variable comprehensions | `transformMap`, `transformList`, `transformMapEntry` in templates |

### Part D — Journey coverage upgrades

Three existing journeys are upgraded from "no crash" to asserting specific kro
behaviour:

| Journey | Current state | Upgraded to |
|---------|--------------|-------------|
| 017-rgd-validation-linting | Checks tab renders, no crash | Asserts specific condition type strings (`GraphAccepted`, `Ready`) and their `True`/`False` values |
| 005-live-instance | Checks panels visible | Asserts `Ready=True` condition entry present with non-empty `reason` field |
| fixture-state.ts | `celFunctionsReady` defined but never used | Wire it to guard the cel-functions-specific steps in journey 006 |

---

## Functional Requirements

### Part A

**FR-A1**: `test/e2e/setup/global-setup.ts` applies `chain-cycle-a.yaml` in step 6f
after chain-parent/chain-child. No readiness wait. Non-fatal (`execFile` pattern).

**FR-A2**: `scripts/demo.sh` applies `chain-cycle-a.yaml` in the chain RGDs block
with `2>/dev/null || true`.

### Part B

**FR-B1**: `cmd/dump-fixtures/main.go` with `//go:build tools` MUST:
1. Import `github.com/kubernetes-sigs/kro/pkg/testutil/generator`
2. Construct all fixture families in FR-C3
3. Serialise via `sigs.k8s.io/yaml`
4. Write to `test/e2e/fixtures/upstream-*.yaml`, overwriting on re-run
5. Prepend Apache 2.0 copyright header + machine-generated comment to each file
6. Exit non-zero on any error; print summary of files written on success

**FR-B2**: `tools.go` at repo root with `//go:build tools` blank-imports the
generator package to anchor the dep. `github.com/kubernetes-sigs/kro` MUST NOT
appear in the main binary (`go build ./cmd/kro-ui` without `-tags tools`).

**FR-B3**: `make dump-fixtures` target: `GOPROXY=direct GONOSUMDB="*" go run -tags tools ./cmd/dump-fixtures`. Not added to `all`/`build` chain.

**FR-B4**: Output is deterministic — identical on every run (no timestamps, no
random names). Safe to re-run; `git diff` is empty after second run.

### Part C

**FR-C1**: Each fixture family MUST produce files in `test/e2e/fixtures/upstream-*.yaml`.

**FR-C2**: Each fixture family MUST be applied in both `global-setup.ts` (with
best-effort ready wait + `fixtureState.<key>` flag) and `scripts/demo.sh`
(with `wait_rgd_ready … optional` pattern).

**FR-C3**: Fixture families, output files, and readiness keys:

| Family | RGD name | CR kind | Output files | `fixtureState` key |
|--------|----------|---------|-------------|-------------------|
| Cartesian forEach | `upstream-cartesian-foreach` | `CartesianApp` | `upstream-cartesian-foreach-rgd.yaml`, `upstream-cartesian-foreach-instance.yaml` | `cartesianReady` |
| Resource→Collection | `upstream-collection-chain` | `CollectionChain` | `upstream-collection-chain-rgd.yaml`, `upstream-collection-chain-instance.yaml` | `collectionChainReady` |
| Contagious `includeWhen` | `upstream-contagious-include-when` | `ContagiousApp` | `upstream-contagious-include-when-rgd.yaml`, `upstream-contagious-include-when-instance.yaml` | `contagiousReady` |
| Cluster-scoped CR | `upstream-cluster-scoped` | `ClusterApp` | `upstream-cluster-scoped-rgd.yaml` (no instance) | `clusterScopedReady` |
| `NodeTypeExternalCollection` | `upstream-external-collection` | `ExternalCollectionApp` | `upstream-external-collection-rgd.yaml`, `upstream-external-collection-prereq.yaml` (label-matching ConfigMaps) | `externalCollectionReady` |
| CEL two-var comprehensions | `upstream-cel-comprehensions` | `CelComprehensionsApp` | `upstream-cel-comprehensions-rgd.yaml`, `upstream-cel-comprehensions-instance.yaml` | `celComprehensionsReady` |

**FR-C4**: `test/e2e/fixture-state.ts` `FixtureState` interface gains 6 new boolean
keys (all default `false`). Both fallback return objects in `loadFixtureState` updated.

**FR-C5**: New Playwright journeys:

| File | Key assertions |
|------|---------------|
| `test/e2e/journeys/043-cartesian-foreach.spec.ts` | DAG renders; collection node has two forEach dimension annotations (`region:`, `tier:`); static DAG badge text present; live instance cardinality badge = 4 (2×2), or partial |
| `test/e2e/journeys/043-collection-chain.spec.ts` | DAG renders; `baseConfig` as `NodeTypeResource` and `chainedConfigs` as `NodeTypeCollection` both visible; directed edge between them (dependency created by forEach expression referencing `baseConfig`); live cardinality badge present |
| `test/e2e/journeys/043-contagious-include-when.spec.ts` | DAG renders; `parentDeploy` node shows excluded/conditional indicator (not error); `childConfig` node also shows excluded/grayed (contagious exclusion propagated); neither shows error CSS class |
| `test/e2e/journeys/043-cluster-scoped.spec.ts` | RGD appears in Overview; DAG renders; instance list for this RGD shows no namespace value (or empty) for the root CR |
| `test/e2e/journeys/043-external-collection.spec.ts` | `NodeTypeExternalCollection` node present in DAG with `dag-node--external-collection` CSS class (or `dag-node--external` fallback); external collection type badge in node detail panel; no `?` on node label |
| `test/e2e/journeys/043-cel-comprehensions.spec.ts` | RGD DAG renders; YAML tab contains `transformMap` or `transformList` token text; CEL expression span present; no `?` or `undefined` in token output |

All new journeys MUST guard with `fixtureState.<key>` and skip gracefully.

### Part D

**FR-D1**: Journey 017 upgrade — after confirming the Validation tab renders, assert
at least one condition item has a `type` attribute matching `GraphAccepted` or `Ready`
(or log graceful skip if kro version does not emit these condition types).

**FR-D2**: Journey 005 upgrade — in the conditions panel step, assert at least one
condition entry with a non-empty `reason` field (e.g. text "Ready") is visible;
assert no condition renders as `undefined` or `[object Object]`.

**FR-D3**: Journey 006 fix — add `test.skip(!fixtureState.celFunctionsReady, …)` guard
to the cel-functions-specific steps (currently Steps 5 and 6 reference
`cel-functions` RGD). Remove the dead `celFunctionsReady` from the fallback-only path
and wire it to actual guard usage.

---

## Non-Functional Requirements

- **NFR-001**: `go vet ./...` passes after all changes
- **NFR-002**: `bun run typecheck` passes after all changes
- **NFR-003**: `go build ./cmd/kro-ui` unaffected — no kro dep in main binary
- **NFR-004**: All 36 existing journeys continue to pass
- **NFR-005**: `make dump-fixtures` is idempotent
- **NFR-006**: E2E setup remains idempotent (re-running on existing cluster safe)

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01 | `chain-cycle-a.yaml` applied in both global-setup and demo; journey 025 Step 4 no longer silently skips |
| AC-02 | `make dump-fixtures` produces 10 files (7 RGD/instance YAMLs + 2 prereqs + 1 cluster-scoped RGD) deterministically |
| AC-03 | All 6 new fixture families applied in global-setup + demo with fixtureState flags |
| AC-04 | `FixtureState` has 10 keys total (4 existing + 6 new) |
| AC-05 | 6 new journey files exist; all steps pass or skip gracefully under `test.skip(!fixtureState.<key>)` |
| AC-06 | Journey 017 asserts a specific condition type string (not just "no crash") |
| AC-07 | Journey 005 asserts a non-empty `reason` field on at least one condition entry |
| AC-08 | Journey 006 has `celFunctionsReady` guards on cel-functions-specific steps |
| AC-09 | `go vet ./...` and `bun run typecheck` pass |
| AC-10 | Every `*-rgd.yaml` in `test/e2e/fixtures/` referenced in both global-setup and demo |
| AC-11 | `NodeTypeExternalCollection` renders without `?` label and with correct type badge |

---

## Out of Scope

- **Live `includeWhen` toggling** (false→true at runtime): requires mutating a live
  instance during the test — not representable as a static cluster state. Separate spec.
- **`readyWhen` blocking state**: requires the test to observe the IN_PROGRESS →
  ACTIVE transition; needs a controlled timing mechanism. Separate spec.
- **Nested RGDs** (RGD as managed resource): complex setup, own spec.
- **Cascading deletion**: requires testing deletion flows, own spec.
- **Spec mutation → DAG update**: requires patching a live CR during the test. Separate spec.
- **GraphRevision UI** (KREP-013): blocked upstream.
- **`random.seededString()` CEL**: slow CRD generation, already excluded.
- **Auto-regeneration in CI**: `make dump-fixtures` is manual only.
- **Status-backed `includeWhen`**: requires `envtest` `Status().Update()`. Not static.
