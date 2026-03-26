# Quickstart: 043 — Upstream Fixture Generator

## Running the fixture generator

```bash
# One-time: add kro as tools dep (already done after go.mod edit)
GOPROXY=direct GONOSUMDB="*" go mod tidy

# Regenerate all upstream-*.yaml fixtures:
make dump-fixtures

# Output (7 files written to test/e2e/fixtures/):
# upstream-cartesian-foreach-rgd.yaml
# upstream-cartesian-foreach-instance.yaml
# upstream-collection-chain-rgd.yaml
# upstream-collection-chain-instance.yaml
# upstream-contagious-include-when-rgd.yaml
# upstream-contagious-include-when-instance.yaml
# upstream-cluster-scoped-rgd.yaml
```

## Verifying Part A (chain-cycle gap fix)

```bash
make demo
kubectl --kubeconfig .demo-kubeconfig.yaml get rgd | grep chain-cycle
# chain-cycle-a   ...
# chain-cycle-b   ...
```

## Verifying Part B (new fixtures in demo cluster)

```bash
make demo
kubectl --kubeconfig .demo-kubeconfig.yaml get rgd | grep upstream
# upstream-cartesian-foreach       ...
# upstream-cluster-scoped          ...
# upstream-collection-chain        ...
# upstream-contagious-include-when ...
```

## Verifying new journeys pass

```bash
# Run only the new 043-* journeys:
cd test/e2e && bunx playwright test --grep "043"
```

## Upgrading to a new kro release

```bash
GOPROXY=direct GONOSUMDB="*" go get github.com/kubernetes-sigs/kro@vX.Y.Z
make tidy
make dump-fixtures
git diff test/e2e/fixtures/upstream-*.yaml   # review structural changes
# update journey assertions if kro changed the generator API
git add test/e2e/fixtures/upstream-*.yaml go.mod go.sum
git commit -m "chore(e2e): regenerate upstream fixtures for kro vX.Y.Z"
```

## tools.go structure

```go
//go:build tools

package main

import _ "github.com/kubernetes-sigs/kro/pkg/testutil/generator"
```

This blank import anchors the kro dep in `go.mod` without it entering the
main binary build.

## Verifying binary is unaffected

```bash
go build ./cmd/kro-ui           # must succeed with no kro imports
go build -tags tools ./cmd/...  # includes dump-fixtures
```
