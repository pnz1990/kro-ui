# API Contract: `POST /api/v1/rgds/validate`

**Handler**: `ValidateRGD` in `internal/api/handlers/validate.go`
**Spec**: `045-rgd-designer-validation-optimizer` US9

---

## Request

```
POST /api/v1/rgds/validate
Content-Type: text/plain
Body: <raw ResourceGraphDefinition YAML>
```

- Body size limit: 1 MiB (enforced in handler).
- No authentication beyond kubeconfig context (same as all other endpoints).
- The YAML must be a valid `ResourceGraphDefinition` — other object kinds return
  HTTP 400.

## Response (success path)

```json
HTTP 200 OK
Content-Type: application/json

{ "valid": true }
```

kro's admission webhook accepted the object via `dryRun=All` apply.
**Nothing was persisted to etcd.**

## Response (kro rejected)

```json
HTTP 200 OK
Content-Type: application/json

{ "valid": false, "error": "<kro admission webhook error message>" }
```

Note: HTTP status is still 200. The `valid` field carries the semantic result.
The `error` field contains the raw message from the Kubernetes `StatusError`.

## Response (bad request)

```json
HTTP 400 Bad Request
Content-Type: application/json

{ "error": "body is not a ResourceGraphDefinition" }
```

Returned when YAML is unparseable or `kind != "ResourceGraphDefinition"`.

## Response (cluster unavailable)

```json
HTTP 503 Service Unavailable
Content-Type: application/json

{ "error": "cluster unreachable: <reason>" }
```

## Response (timeout)

```json
HTTP 504 Gateway Timeout
```

Returned when the 5s handler budget is exceeded (kro webhook slow or hung).

---

## Backend implementation notes

- Uses `h.factory.Dynamic().Resource(rgdGVR).Apply(ctx, name, obj, metav1.ApplyOptions{DryRun: []string{"All"}, FieldManager: "kro-ui"})`.
- Parses YAML body via `k8s.io/apimachinery/pkg/util/yaml.NewYAMLToJSONDecoder`.
- Extracts `metadata.name` from the unstructured object for the Apply call.
- Error discrimination: `k8s.io/apimachinery/pkg/api/errors.IsNotFound` etc. —
  but for a dry-run apply on a new object, "not found" is fine; the API server
  creates in dry-run mode.
- Logs the dry-run result at DEBUG level.

---

## Frontend contract

`api.ts` export:

```typescript
export type DryRunResult =
  | { valid: true }
  | { valid: false; error: string }

export async function validateRGD(yaml: string): Promise<DryRunResult>
```

`YAMLPreview` props:

| Prop | Type | When |
|------|------|------|
| `onValidate` | `() => void` | Required to show the button |
| `validateResult` | `DryRunResult \| null` | `null` = no result shown |
| `validateLoading` | `boolean` | `true` = button in loading state |

DOM contract:

| Element | `data-testid` | When visible |
|---------|-------------|--------------|
| Validate button | `"dry-run-btn"` | Always (when `onValidate` provided) |
| Loading state | button text = "Validating…" | `validateLoading === true` |
| Result container | `"dry-run-result"` | `validateResult !== null` |
| Valid badge | green "✓ Valid" text | `validateResult.valid === true` |
| Error panel | red "✗ Validation failed" + message | `validateResult.valid === false` |

**Stale result clearing**: `AuthorPage` resets `validateResult` to `null` in a
`useEffect` watching `rgdYaml`. The result is never shown for a different YAML
than the one that produced it.
