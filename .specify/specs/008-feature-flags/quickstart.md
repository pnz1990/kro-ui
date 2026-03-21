# Quickstart: Feature Flag System

**Spec**: `008-feature-flags` | **Date**: 2026-03-20

---

## For Backend Developers

### Adding a new schema capability

When upstream kro adds a new optional field to the RGD schema (e.g.,
`spec.resources[].readyWhen`), add detection in two places:

1. **`internal/k8s/capabilities.go`** — Add the field to `SchemaCapabilities`
   and a path check in `detectSchemaCapabilities()`:

   ```go
   type SchemaCapabilities struct {
       // ... existing fields ...
       HasReadyWhen bool `json:"hasReadyWhen"`
   }

   // In detectSchemaCapabilities():
   caps.HasReadyWhen = hasFieldInSchema(crdSchema, "spec", "resources", "items", "readyWhen")
   ```

2. **`web/src/lib/features.ts`** — Add the field to the `KroCapabilities`
   interface and update the baseline:

   ```typescript
   schema: {
     // ... existing fields ...
     hasReadyWhen: boolean
   }
   ```

No route changes, no handler changes, no cache changes needed.

### Adding a new feature gate

When upstream kro adds a new feature gate (e.g., `ResourceValidation`):

1. No backend code changes needed — the Deployment args parser discovers
   any `--feature-gates` key-value pair automatically.
2. Add the gate to the `BASELINE` in `features.ts` with `false` as default:

   ```typescript
   featureGates: {
     // ... existing gates ...
     ResourceValidation: false,
   }
   ```

3. Add a test in `capabilities_test.go` for the new gate.

### Cache invalidation

The capabilities cache is invalidated automatically when:
- The 30-second TTL expires
- The user switches kubeconfig context (different cluster)

No manual invalidation is needed.

---

## For Frontend Developers

### Gating UI features on capabilities

```typescript
import { useCapabilities } from '../lib/features'

function MyComponent() {
  const { capabilities, loading } = useCapabilities()

  if (loading) return null  // or a skeleton

  return (
    <>
      {capabilities.schema.hasForEach && (
        <CollectionNode ... />
      )}
      {capabilities.featureGates.CELOmitFunction && (
        <OmitFunctionHighlight ... />
      )}
      {capabilities.knownResources.includes('graphrevisions') && (
        <RevisionsTab ... />
      )}
    </>
  )
}
```

### Checking experimental mode

```typescript
import { isExperimental } from '../lib/features'

function RGDDetailPage() {
  return (
    <>
      <DAGTab />
      <YAMLTab />
      {isExperimental() && (
        <ExperimentalBadge>
          <RevisionsTab />
        </ExperimentalBadge>
      )}
    </>
  )
}
```

Experimental mode is enabled by adding `?experimental=true` to the URL.
It is purely a frontend concern — the backend returns the same capabilities
regardless.

### Handling unknown feature gates (forward compatibility)

The `featureGates` object may contain keys not known to the current frontend
version. Always check specific gates by name:

```typescript
// GOOD: checks a known gate
if (capabilities.featureGates.CELOmitFunction) { ... }

// GOOD: safely checks an unknown gate (returns undefined → falsy)
if (capabilities.featureGates.SomeNewGate) { ... }

// BAD: iterates all gates — may include unexpected keys
Object.keys(capabilities.featureGates).forEach(...)
```

---

## For E2E Test Authors

### Testing capabilities in a kind cluster

The E2E kind cluster runs a standard kro installation with no feature gates
enabled. Expected capabilities:

```json
{
  "schema": { "hasForEach": true, "hasExternalRef": true },
  "featureGates": { "CELOmitFunction": false },
  "knownResources": ["resourcegraphdefinitions"]
}
```

### Testing with feature gates enabled

To test feature-gated behavior, modify the kro Deployment in the E2E cluster:

```bash
kubectl -n kro-system patch deployment kro-controller-manager \
  --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--feature-gates=CELOmitFunction=true"}]'
```

Then wait for the capabilities cache to expire (30s) or restart kro-ui.

---

## Integration with Other Specs

| Spec | Integration Point |
|---|---|
| `003-rgd-detail-dag` | `useCapabilities()` gates DAG node types (ExternalRef, Collection) |
| `005-instance-detail-live` | `useCapabilities()` gates live instance features |
| `006-cel-highlighter` | `CELOmitFunction` gate controls `omit()` keyword highlighting |
| `007-context-switcher` | Context switch invalidates capabilities cache |
| `009-rgd-graph-diff` | `knownResources.includes('graphrevisions')` gates Revisions tab |
| `011-collection-explorer` | `hasForEach` gate controls collection drill-down |
