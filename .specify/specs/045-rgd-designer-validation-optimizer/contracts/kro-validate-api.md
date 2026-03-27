# API Contract: `POST /api/v1/rgds/validate/static` and `internal/validate/`

**Handler**: `ValidateRGDStatic` in `internal/api/handlers/validate.go`
**Package**: `internal/validate/`
**Spec**: `045-rgd-designer-validation-optimizer` US10

---

## HTTP contract: `POST /api/v1/rgds/validate/static`

### Request

```
POST /api/v1/rgds/validate/static
Content-Type: text/plain
Body: <raw ResourceGraphDefinition YAML>
```

- Body size limit: 1 MiB.
- **Does not contact the Kubernetes API server.** Fully offline.
- Works even when no cluster is connected.

### Response (always HTTP 200)

```json
HTTP 200 OK
Content-Type: application/json

{
  "issues": [
    { "field": "spec.schema.spec.replicas", "message": "unknown type 'badtype'" },
    { "field": "spec.resources[web].template", "message": "CEL parse error: ..." },
    { "field": "spec.resources[MyDB].id", "message": "resource ID must be lowerCamelCase" }
  ]
}
```

- `issues` is always an array — empty (`[]`) when no issues found.
- HTTP status is always 200 on a successful validation run (even with issues).
- HTTP 500 only on internal server panic/error during extraction.

### Field naming convention in `StaticIssue.field`

| Source | Field format |
|--------|-------------|
| Spec field type error | `spec.schema.spec.<fieldName>` |
| CEL expression error | `spec.resources[<id>].template` |
| Resource ID format error | `spec.resources[<id>].id` |
| Internal/unknown | `internal` |

---

## Go package contract: `internal/validate/`

### Exported types

```go
package validate

// ResourceExpressions is the input for ValidateCELExpressions.
type ResourceExpressions struct {
    ID          string   // resource id value
    Expressions []string // all raw "${...}" strings found in the template
}
```

### Exported functions

#### `ValidateSpecFields(fieldMap map[string]string) []apitypes.StaticIssue`

Validates each field's type string using `pkg/simpleschema.ParseField`.

| Input | Output |
|-------|--------|
| `{"replicas": "integer"}` | `[]` (no issues) |
| `{"replicas": "integer \| minimum=1 \| maximum=100"}` | `[]` |
| `{"replicas": "badtype"}` | `[{field: "spec.schema.spec.replicas", message: "..."}]` |
| `{"replicas": "integer \| enum=a,b"}` | `[{field: "spec.schema.spec.replicas", message: "..."}]` |

**Pre-processing**: strips surrounding double-quotes from the type string before
calling `ParseField` (kro YAML uses quoted strings; `ParseField` expects unquoted).

**Panic safety**: wraps in `recover()`.

---

#### `ValidateCELExpressions(resources []ResourceExpressions) []apitypes.StaticIssue`

Validates each CEL expression using `pkg/cel.DefaultEnvironment()` + `env.Parse()`.

| Input | Output |
|-------|--------|
| `[{ID:"web", Expressions:["${schema.spec.replicas}"]}]` | `[]` |
| `[{ID:"web", Expressions:["${x +++ y}"]}]` | `[{field: "spec.resources[web].template", message: "..."}]` |
| `[{ID:"web", Expressions:["hello"]}]` | `[]` (not a `${...}` expression — skipped) |

**Expression extraction**: only strings matching `${...}` are validated. The
`${` and `}` wrappers are stripped before passing to `env.Parse()`.

**CEL environment**: `DefaultEnvironment()` is called once and cached via
`sync.Once`. If initialisation fails (should not happen with kro v0.9.0+), all
CEL validation is skipped and a single `StaticIssue{ Field: "internal",
Message: "CEL environment unavailable" }` is returned.

**Panic safety**: wraps in `recover()`.

---

#### `ValidateResourceIDs(ids []string) []apitypes.StaticIssue`

Validates each ID against the kro lowerCamelCase rule: `/^[a-z][a-zA-Z0-9]*$/`.

| Input | Output |
|-------|--------|
| `["web", "database", "configMap"]` | `[]` |
| `["MyDB"]` | `[{field: "spec.resources[MyDB].id", message: "resource ID must be lowerCamelCase"}]` |
| `["my-db"]` | `[{field: "spec.resources[my-db].id", message: "resource ID must be lowerCamelCase"}]` |
| `[""]` | `[]` (empty IDs ignored — already caught by form-level F-1) |

---

## Version upgrade contract

The `internal/validate/` package is the **only** file in the codebase that
imports kro library packages. When upgrading kro:

1. `GOPROXY=direct GONOSUMDB="*" go get github.com/kubernetes-sigs/kro@vX.Y.Z`
2. `make tidy`
3. Fix any compilation errors in `internal/validate/` only.
4. `make build` — confirms nothing else broke.

**No handler, route, frontend, or other internal package requires changes**
unless kro adds entirely new validation concepts (which would be new US additions,
not version upgrades).

---

## Frontend contract

### `StaticIssue` TypeScript type (`web/src/lib/api.ts`)

```typescript
export interface StaticIssue {
  field: string
  message: string
}

export interface StaticValidationResult {
  issues: StaticIssue[]
}

export async function validateRGDStatic(yaml: string): Promise<StaticValidationResult>
```

`validateRGDStatic` **never throws** — on HTTP error it returns `{ issues: [] }`
(best-effort; static validation failure must not crash the form).

### `RGDAuthoringForm` prop

| Prop | Type | Effect |
|------|------|--------|
| `staticIssues` | `StaticIssue[]` | Renders "Deep validation" section when non-empty |

### DOM contract

| Element | `data-testid` | When visible |
|---------|-------------|--------------|
| Section container | `"static-validation-section"` | `staticIssues.length > 0` |
| Section title | — | Always inside container |
| Per-issue field | — | One per issue |
| Per-issue message | — | One per issue |

### Debounce contract

Static validation is triggered by `AuthorPage` via `useEffect` on `rgdYaml`
with a 1000ms debounce. The pending request is cancelled on cleanup (via
`clearTimeout`). On component unmount or fast edits, only the last-typed YAML
is validated — no race conditions.
