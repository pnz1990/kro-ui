# API Contract: Capabilities Endpoint

**Spec**: `008-feature-flags` | **Date**: 2026-03-20

---

## `GET /api/v1/kro/capabilities`

Returns the capabilities of the connected kro installation. Uses a 30-second
server-side cache. Always returns a valid response — falls back to a
conservative baseline on any detection failure.

### Request

```
GET /api/v1/kro/capabilities HTTP/1.1
Accept: application/json
```

No request body. No query parameters. No authentication (same as all kro-ui
endpoints — RBAC is at the Kubernetes level).

### Response: 200 OK

```json
{
  "version": "0.9.1",
  "apiVersion": "kro.run/v1alpha1",
  "featureGates": {
    "CELOmitFunction": false,
    "InstanceConditionEvents": false
  },
  "knownResources": [
    "resourcegraphdefinitions"
  ],
  "schema": {
    "hasForEach": true,
    "hasExternalRef": true,
    "hasExternalRefSelector": true,
    "hasScope": true,
    "hasTypes": true
  }
}
```

### Response Fields

| Field | Type | Description | Always present |
|---|---|---|---|
| `version` | `string` | kro version (from Deployment image tag or labels). `"unknown"` if not detected. | Yes |
| `apiVersion` | `string` | Preferred kro API version (e.g., `"kro.run/v1alpha1"`). | Yes |
| `featureGates` | `object` | Map of feature gate name → enabled state. Unknown gates from future kro versions may appear as additional keys. | Yes |
| `featureGates.CELOmitFunction` | `boolean` | Whether the `omit()` CEL function is enabled. | Yes |
| `featureGates.InstanceConditionEvents` | `boolean` | Whether K8s Events on condition transitions are emitted. | Yes |
| `knownResources` | `string[]` | Plural resource names registered under `kro.run`. Always includes `"resourcegraphdefinitions"`. Future resources (e.g., `"graphrevisions"`) appear automatically. | Yes |
| `schema` | `object` | Schema-level capabilities detected from the RGD CRD's OpenAPI schema. | Yes |
| `schema.hasForEach` | `boolean` | Whether `spec.resources[].forEach` exists in the CRD schema. | Yes |
| `schema.hasExternalRef` | `boolean` | Whether `spec.resources[].externalRef` exists in the CRD schema. | Yes |
| `schema.hasExternalRefSelector` | `boolean` | Whether `spec.resources[].externalRef.metadata.selector` exists. | Yes |
| `schema.hasScope` | `boolean` | Whether `spec.schema.scope` exists (cluster-scoped instances). | Yes |
| `schema.hasTypes` | `boolean` | Whether `spec.schema.types` exists (custom type definitions). | Yes |

### Response: 500 Internal Server Error

Only returned if the server cannot construct even a baseline response (should
never happen in practice).

```json
{
  "error": "failed to detect capabilities: <detail>"
}
```

### Forward Compatibility

- **Unknown feature gates**: Future kro versions may add feature gates not listed
  above. They will appear as additional keys in `featureGates`. Frontends MUST
  ignore unknown gates (the TypeScript type uses an index signature
  `[key: string]: boolean`).
- **Unknown resources**: Future kro CRDs appear automatically in
  `knownResources` via discovery. No server code change needed.
- **Schema fields**: New schema capabilities require adding a new boolean field
  to `SchemaCapabilities` and a corresponding CRD path check. This is a minor
  server-side change only.

### Caching Behavior

- Server caches the result for **30 seconds** (FR-001)
- No `Cache-Control` headers are set (frontend manages its own SWR cache)
- Cache is **invalidated** when the user switches kubeconfig context (the new
  cluster may have a different kro installation)

### Error Handling

The endpoint **always** returns `200 OK` with a valid capabilities object.
Internal detection failures are logged server-side and result in conservative
defaults:

| Failure | Behavior |
|---|---|
| kro not installed (`kro.run` group not found) | Returns baseline: `version: "unknown"`, all feature gates `false`, minimal schema |
| CRD not accessible | Uses baseline schema capabilities (`hasForEach: true`, `hasExternalRef: true`, rest `false`) |
| Deployment not found (can't read feature gates) | All feature gates default to `false` |
| Partial detection (some calls succeed) | Merges successful results with baseline for failed parts |

---

## Test Requirements

### Backend Unit Tests (`internal/k8s/capabilities_test.go`)

| Test Case | Input | Expected Output |
|---|---|---|
| Baseline when kro not installed | `ServerResourcesForGroupVersion` returns error | Conservative baseline |
| Detects known resources | Discovery returns `[rgds]` | `knownResources: ["resourcegraphdefinitions"]` |
| Detects future resource | Discovery returns `[rgds, graphrevisions]` | Both in `knownResources` |
| Schema detection — forEach present | CRD has `forEach` in schema | `hasForEach: true` |
| Schema detection — scope absent | CRD lacks `scope` in schema | `hasScope: false` |
| Feature gate parsing — enabled | Deployment has `--feature-gates=CELOmitFunction=true` | `CELOmitFunction: true` |
| Feature gate parsing — disabled | Deployment has `--feature-gates=CELOmitFunction=false` | `CELOmitFunction: false` |
| Feature gate parsing — no flag | Deployment has no `--feature-gates` | All gates `false` |
| Feature gate parsing — Deployment not found | Get returns 404 | All gates `false` |
| Fork guard — specPatch excluded | Detection somehow produces `specPatch` | `specPatch` NOT in response |
| Fork guard — stateFields excluded | Detection somehow produces `stateFields` | `stateFields` NOT in response |

### Backend Handler Tests (`internal/api/handlers/capabilities_test.go`)

| Test Case | Input | Expected Output |
|---|---|---|
| Returns 200 with capabilities | Stub factory with full detection | 200 + valid JSON |
| Returns 200 with baseline on error | Stub factory that errors | 200 + baseline JSON |
| Cache hit within TTL | Two rapid requests | Second request returns same data, no new detection |
| Cache invalidation after TTL | Request after 30s | Fresh detection triggered |

### Frontend Tests (`web/src/lib/features.test.ts`)

| Test Case | Input | Expected Output |
|---|---|---|
| `useCapabilities` returns baseline initially | No fetch response yet | `capabilities === BASELINE`, `loading === true` |
| `useCapabilities` updates after fetch | Mock 200 response | `capabilities` matches response, `loading === false` |
| `useCapabilities` shares data across consumers | Two components both call hook | Single fetch, both get same data |
| Experimental mode detection | `?experimental=true` in URL | `isExperimental() === true` |
| Experimental mode off by default | No query param | `isExperimental() === false` |

### E2E Test (`test/e2e/journeys/008-feature-flags.spec.ts`)

| Step | Action | Assertion |
|---|---|---|
| 1 | `GET /api/v1/kro/capabilities` | Status 200, `schema.hasForEach === true`, `featureGates.CELOmitFunction === false` |
| 2 | Navigate to `/rgds/test-app` | No ExternalRef nodes present (fixture has none) |
