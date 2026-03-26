# Implementation Plan: 043 — Upstream Fixture Generator

**Branch**: `043-upstream-fixture-generator` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)

---

## Summary

Four deliverables shipped together:

- **Part A** (2 edits): Apply the missing `chain-cycle-a.yaml` in both E2E setup and demo.
- **Part B** (Go tool): `cmd/dump-fixtures` generates fixture YAMLs from kro's upstream
  `pkg/testutil/generator`. `make dump-fixtures` regenerates on new kro releases.
- **Part C** (6 fixture families + 6 journeys): Cover every previously uncovered kro node
  type and behaviour — cartesian forEach, resource→collection dependency, contagious
  `includeWhen`, cluster-scoped CR, `NodeTypeExternalCollection`, CEL two-variable
  comprehensions.
- **Part D** (3 journey upgrades): Promote journeys 005, 017, and 006 from "no crash"
  assertions to specific condition/type assertions.

**End state**: every kro upstream feature and node type has a fixture and a Playwright
journey step. 36 → 42 journeys. ~219 → ~275 steps.

---

## Technical Context

**Language/Version**: Go 1.25 + TypeScript 5.x / Node
**Primary Dependencies**: `github.com/kubernetes-sigs/kro/pkg/testutil/generator` (tools-only), `sigs.k8s.io/yaml` (already in go.mod), Playwright, kubectl, kind, helm
**Storage**: N/A
**Testing**: `go test -race ./...`, `bun run typecheck`, Playwright E2E
**Target Platform**: Linux / macOS (kind cluster, CI runner)
**Project Type**: Test tooling + E2E coverage expansion
**Performance Goals**: `make dump-fixtures` < 10s; each fixture applies in < 180s on CI
**Constraints**: kro dep tools-tag-isolated; `GOPROXY=direct GONOSUMDB="*"` required
**Scale/Scope**: ~15 files modified, ~17 new files, 6 new journeys, 3 upgraded journeys, 1 new Go tool

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| § I Iterative-First | PASS | Part A shippable alone; each part additive |
| § II Cluster Adaptability | PASS | All fixtures use upstream kro v1alpha1 only; no fork fields |
| § III Read-Only | PASS | kro-ui binary unchanged; `kubectl apply` only in test/demo tooling |
| § IV Single Binary Distribution | PASS | `tools` build tag isolates kro dep from binary |
| § V Simplicity | PASS | Uses kro's own generator; no new frontend deps |
| § VI Go Standards | PASS | Apache 2.0 headers, `fmt.Errorf` wrapping, `go vet` gate |
| § VII Testing Standards | PASS | 6 new journeys + 3 upgrades; existing 36 unmodified |
| § XI API Performance Budget | PASS | Tooling only; not in hot path |
| § XII Graceful Degradation | PASS | All new journeys guard with `fixtureState.<key>` skip |
| § XIII Frontend UX Standards | PASS | No frontend changes except journey assertions |

No violations.

---

## Project Structure

### Documentation

```text
.specify/specs/043-upstream-fixture-generator/
├── spec.md
├── plan.md              ← this file
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code — files changed / created

```text
# Part A
test/e2e/setup/global-setup.ts                               EDIT
scripts/demo.sh                                              EDIT

# Part B — Go tooling
tools.go                                                     NEW
cmd/dump-fixtures/main.go                                    NEW
go.mod                                                       EDIT
go.sum                                                       EDIT
Makefile                                                     EDIT

# Part C — Generated fixture YAMLs (10 files)
test/e2e/fixtures/upstream-cartesian-foreach-rgd.yaml        NEW
test/e2e/fixtures/upstream-cartesian-foreach-instance.yaml   NEW
test/e2e/fixtures/upstream-collection-chain-rgd.yaml         NEW
test/e2e/fixtures/upstream-collection-chain-instance.yaml    NEW
test/e2e/fixtures/upstream-contagious-include-when-rgd.yaml  NEW
test/e2e/fixtures/upstream-contagious-include-when-instance.yaml NEW
test/e2e/fixtures/upstream-cluster-scoped-rgd.yaml           NEW
test/e2e/fixtures/upstream-external-collection-rgd.yaml      NEW
test/e2e/fixtures/upstream-external-collection-prereq.yaml   NEW
test/e2e/fixtures/upstream-cel-comprehensions-rgd.yaml       NEW
test/e2e/fixtures/upstream-cel-comprehensions-instance.yaml  NEW

# Part C — E2E wiring
test/e2e/fixture-state.ts                                    EDIT (+6 keys)
test/e2e/setup/global-setup.ts                               EDIT (+6 blocks)
scripts/demo.sh                                              EDIT (+6 applies)

# Part C — New journeys (6 files)
test/e2e/journeys/043-cartesian-foreach.spec.ts              NEW
test/e2e/journeys/043-collection-chain.spec.ts               NEW
test/e2e/journeys/043-contagious-include-when.spec.ts        NEW
test/e2e/journeys/043-cluster-scoped.spec.ts                 NEW
test/e2e/journeys/043-external-collection.spec.ts            NEW
test/e2e/journeys/043-cel-comprehensions.spec.ts             NEW

# Part D — Journey upgrades (3 files)
test/e2e/journeys/005-live-instance.spec.ts                  EDIT
test/e2e/journeys/006-cel-highlighting.spec.ts               EDIT
test/e2e/journeys/017-rgd-validation-linting.spec.ts         EDIT
```

**Total**: 5 files edited (Part A+B+C), 17 files created, 3 journey files edited (Part D).

---

## Complexity Tracking

No constitution violations. Table not required.
