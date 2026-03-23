# Fix: expand fixture set to cover all kro node types

**Issue**: #84
**Branch**: fix/issue-84-expand-fixture-set-cover
**Labels**: enhancement

## Root Cause

The E2E fixture set only exercises `NodeTypeResource` and `NodeTypeInstance`. `NodeTypeExternal`, `NodeTypeCollection` (live instance), and `NodeTypeExternalCollection` have no fixtures, so journey assertions for those UI paths are either absent or skipped. The multi-resource (4+ node) DAG case with real dependency edges is also untested.

## Files to change

- `test/e2e/fixtures/` — 5 new YAML files (multi-resource RGD+instance, external-ref prereq+RGD+instance, cel-functions RGD+instance)
- `test/e2e/setup/global-setup.ts` — wire new fixtures; promote collection instance from skip to active
- `test/e2e/journeys/001-*.spec.ts` through `010-*.spec.ts` — new steps per journey
- `.github/workflows/e2e.yml` — bump timeout 20m → 30m to accommodate new fixtures
- `Makefile` + `scripts/demo.sh` — new `make demo` / `make demo-clean` targets

## Tasks

### Phase 1 — Fixtures

- [x] Write `.specify/fixes/fix-issue-84-expand-fixture-set-cover/tasks.md`
- [ ] `test/e2e/fixtures/multi-resource-rgd.yaml` — Deployment+Service+ConfigMap+HPA RGD with inter-resource CEL refs (adapted from kro upstream `check-multi-resource-rgd`)
- [ ] `test/e2e/fixtures/multi-resource-instance.yaml` — instance CR for the multi-resource RGD
- [ ] `test/e2e/fixtures/external-ref-prereq.yaml` — pre-existing ConfigMap that the externalRef RGD reads
- [ ] `test/e2e/fixtures/external-ref-rgd.yaml` — RGD with one `externalRef` node + one owned ConfigMap (adapted from kro upstream `check-external-references`)
- [ ] `test/e2e/fixtures/external-ref-instance.yaml` — instance CR for the external-ref RGD
- [ ] `test/e2e/fixtures/cel-functions-rgd.yaml` — Deployment+Service RGD using split/json.marshal/quantity/random.seededString CEL (adapted from kro upstream `examples/kubernetes/cel-functions`)
- [ ] `test/e2e/fixtures/cel-functions-instance.yaml` — instance CR for the cel-functions RGD

### Phase 2 — global-setup.ts

- [ ] Apply `external-ref-prereq.yaml` before any RGD
- [ ] Apply `multi-resource-rgd.yaml`, wait Ready, apply `multi-resource-instance.yaml`, wait for child Deployment
- [ ] Apply `external-ref-rgd.yaml`, wait Ready, apply `external-ref-instance.yaml`, wait for owned ConfigMap
- [ ] Apply `cel-functions-rgd.yaml`, wait Ready, apply `cel-functions-instance.yaml`, wait for child Deployment
- [ ] Promote collection instance: wait for `test-collection` RGD Ready with `--timeout=180s`, then apply `test-collection-instance.yaml` and wait for child ConfigMaps

### Phase 3 — Journey updates

- [ ] `001`: steps 7-11 — verify new RGDs in list, instance detail endpoint, events endpoint
- [ ] `002`: steps 5-9 — ≥5 cards, no `?` kind, search filter, fully-clickable card
- [ ] `003`: steps 8-15 — multi-resource 5-node DAG + edge, externalRef node class/label, collection node class
- [ ] `004`: steps 6-10 — multi-resource and external-ref instance rows, namespace filter, sort indicator
- [ ] `005`: steps 7-11 — multi-resource live DAG with state badges, conditions panel, externalRef live DAG
- [ ] `006`: steps 6-9 — cel-functions YAML tab (split, json.marshal tokens), external-ref orValue token
- [ ] `007`: step 7 — all 5 fixture cards visible after context switch
- [ ] `008`: steps 3-5 — hasForEach/hasExternalRef === true, feature-gated DAG nodes render
- [ ] `009`: steps 7-9 — multi-RGD DOM count meaningful, search "cel" → 1, search "external" → 1
- [ ] `010`: unskip steps 3-4; add step 5 cardinality badge count matches instance region count

### Phase 4 — Demo + CI

- [ ] `scripts/demo.sh` — shell script: check prereqs, create kind cluster, install kro, apply fixtures, start server
- [ ] `Makefile` — add `demo` and `demo-clean` targets
- [ ] `.github/workflows/e2e.yml` — bump `timeout-minutes: 20` → `30`

### Phase 5 — Verify

- [ ] `cd web && bun run tsc --noEmit`
- [ ] `go vet ./...`
