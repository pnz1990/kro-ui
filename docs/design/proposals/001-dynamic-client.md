# 001 — Dynamic Kubernetes Client

**Status**: Accepted  
**Deciders**: @pnz1990  
**Date**: 2025-01  
**Refs**: `internal/k8s/client.go`, `AGENTS.md` §Key architectural decisions

---

## Problem statement

kro is under active development; its CRD shapes (`ResourceGraphDefinition`,
instance CRDs) change between releases. A typed Go client (generated via
`code-generator` or `controller-gen`) would require regeneration and a rebuild
of kro-ui every time kro changes an API field. This contradicts the goal of
kro-ui surviving kro API changes without code changes.

---

## Proposal / overview

Use `k8s.io/client-go/dynamic` throughout the entire backend. All kro objects
are read as `unstructured.Unstructured` and marshalled to `map[string]interface{}`
before being JSON-encoded and sent to the frontend. The frontend treats every
object as a generic `Record<string, unknown>`.

---

## Design details

- `ClientFactory` holds a `dynamic.Interface` and a `discovery.DiscoveryInterface`,
  both protected by `sync.RWMutex`.
- `SwitchContext` reconstructs both clients from the new kubeconfig context
  without restarting the process.
- Only `internal/k8s/rgd.go` knows kro field paths (`spec.schema.kind`,
  `spec.resources[].id`, `spec.resources[].template`, etc.). All other code
  accesses these via the `RGDFields` extraction functions.
- The frontend's `K8sObject = Record<string, unknown>` type makes the same
  version-agnosticism explicit on the UI side.

---

## Alternatives considered

| Alternative | Reason rejected |
|---|---|
| Typed client generated from kro CRD | Requires regeneration on every kro API bump; breaks donation goal |
| OpenAPI schema validation on ingest | Adds complexity; graceful degradation is preferred over hard failure |
| GraphQL layer | Premature; adds a dependency and build step for no additional value at this scale |

---

## Testing strategy

- Unit tests in `internal/k8s/` use `fake.NewSimpleDynamicClient` from
  `k8s.io/client-go/dynamic/fake`.
- E2E tests apply real RGD fixtures to a kind cluster and assert UI renders
  correctly without typed knowledge of field shapes.
