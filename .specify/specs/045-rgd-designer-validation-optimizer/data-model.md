# Data Model: 045 — RGD Designer Validation & Optimizer

**Branch**: `045-rgd-designer-validation-optimizer`
**Phase**: 1 — Design
**Date**: 2026-03-26

---

## Overview

This spec introduces a pure validation layer over the existing `RGDAuthoringState`.
No new persistent entities or API shapes are created. All changes are frontend-only,
entirely within `web/src/`.

---

## New Types (all in `web/src/lib/generator.ts`)

### `ValidationIssue`

```typescript
export interface ValidationIssue {
  /** 'error' = definite problem (required field missing, duplicate ID).
   *  'warning' = advisory (format hint, constraint inconsistency). */
  type: 'error' | 'warning'
  /** Human-readable message shown beneath the affected input. */
  message: string
}
```

**Constraints**:
- `type` is an enum-like union; no other values are valid.
- `message` is a short imperative sentence ≤80 chars, no punctuation at end.

---

### `ValidationState`

```typescript
export interface ValidationState {
  /** Issue on the rgdName metadata field (required or format). */
  rgdName?: ValidationIssue
  /** Issue on the kind metadata field (required or PascalCase format). */
  kind?: ValidationIssue
  /** Issues keyed by AuthoringResource._key.
   *  Covers: duplicate ID, forEach-no-iterator. */
  resourceIssues: Record<string, ValidationIssue>
  /** Issues keyed by AuthoringField.id.
   *  Covers: duplicate spec field name, min > max. */
  specFieldIssues: Record<string, ValidationIssue>
  /** Issues keyed by AuthoringStatusField.id.
   *  Covers: duplicate status field name. */
  statusFieldIssues: Record<string, ValidationIssue>
  /** Total count of all issues (rgdName + kind + resourceIssues + specFieldIssues
   *  + statusFieldIssues). Used to drive the summary badge. */
  totalCount: number
}
```

**Invariant**: `totalCount === [rgdName, kind].filter(Boolean).length +
Object.keys(resourceIssues).length + Object.keys(specFieldIssues).length +
Object.keys(statusFieldIssues).length`

---

### `validateRGDState` — pure function

```typescript
export function validateRGDState(state: RGDAuthoringState): ValidationState
```

**Algorithm**:

1. **`rgdName` check**:
   - Empty string → `{ type: 'error', message: 'RGD name is required' }`
   - Fails DNS subdomain regex → `{ type: 'warning', message: 'RGD name should be a valid DNS subdomain (lowercase alphanumeric and hyphens)' }`
   - DNS subdomain regex: `/^[a-z0-9]([a-z0-9\-.]*[a-z0-9])?$/` (allows dots, hyphens; no consecutive hyphens check beyond common sense — RFC 1123 labels)

2. **`kind` check**:
   - Empty string → `{ type: 'error', message: 'Kind is required' }`
   - Fails PascalCase regex → `{ type: 'warning', message: 'Kind should be PascalCase (e.g. WebApp, MyService)' }`
   - PascalCase regex: `/^[A-Z][a-zA-Z0-9]*$/`

3. **Duplicate resource IDs** — collect non-empty IDs into a frequency map;
   for each resource whose `id` appears more than once → add to `resourceIssues`
   with `{ type: 'warning', message: 'Duplicate resource ID' }`.

4. **forEach-no-iterator** — for each resource with `resourceType === 'forEach'`
   where `forEachIterators.filter(i => i.variable.trim() && i.expression.trim()).length === 0`
   → add `{ type: 'warning', message: 'forEach resources require at least one iterator' }`.
   When a resource has BOTH duplicate ID AND forEach-no-iterator, only the
   duplicate-ID issue is recorded (higher severity wins; avoids double-badge on same row).

5. **Duplicate spec field names** — same frequency-map approach over `state.specFields`
   keyed by `field.id`; message: `'Duplicate spec field name'`.

6. **Min > max** — for each spec field where `minimum` and `maximum` are both
   non-empty strings and `Number(minimum) > Number(maximum)` → `{ type: 'warning',
   message: 'minimum must be ≤ maximum' }`. Keyed by `field.id`; does NOT override
   duplicate-name issue if both apply (both recorded under the same `field.id`).
   **Resolution when both issues apply on same field**: use `specFieldIssues[field.id]`
   — last write wins. To avoid ambiguity, implementation order is: (a) build
   duplicate-name map first, (b) then scan for min>max; if a field already has
   a duplicate-name issue the min>max check is skipped for that field (duplicate
   name takes priority since it produces invalid YAML structure).

7. **Duplicate status field names** — same approach over `state.statusFields`
   keyed by `statusField.id`; message: `'Duplicate status field name'`.

8. **totalCount** — sum all present issue keys at the end.

**Returns**: a new `ValidationState` object; never throws; returns an empty-issues
state (no entries, `totalCount: 0`) for the `STARTER_RGD_STATE`.

---

## Modified Types (existing, unchanged interface)

No existing type interfaces change shape. The `RGDAuthoringState`,
`AuthoringResource`, `AuthoringField`, `AuthoringStatusField`, and
`ForEachIterator` types are all read-only inputs to `validateRGDState`.

---

## State Transitions

Validation is stateless — `validateRGDState(state)` is a pure read-only
derivation. It has no internal state and no side effects. The call site
(`RGDAuthoringForm`) passes the current `state` prop on every render.

```
RGDAuthoringState (prop)
       │
       ▼
validateRGDState()   ← called on every render of RGDAuthoringForm
       │
       ▼
ValidationState      ← drives inline messages + summary badge rendering
```

---

## Validation Rules Summary

| Check | Field | Type | Message |
|-------|-------|------|---------|
| `rgdName` empty | `rgdName` | error | "RGD name is required" |
| `rgdName` not DNS subdomain | `rgdName` | warning | "RGD name should be a valid DNS subdomain (lowercase alphanumeric and hyphens)" |
| `kind` empty | `kind` | error | "Kind is required" |
| `kind` not PascalCase | `kind` | warning | "Kind should be PascalCase (e.g. WebApp, MyService)" |
| Duplicate resource `id` | resource `_key` | warning | "Duplicate resource ID" |
| forEach no iterator | resource `_key` | warning | "forEach resources require at least one iterator" |
| Duplicate spec field `name` | field `id` | warning | "Duplicate spec field name" |
| `minimum > maximum` | field `id` | warning | "minimum must be ≤ maximum" |
| Duplicate status field `name` | statusField `id` | warning | "Duplicate status field name" |

---

## CSS Additions

### `tokens.css` additions

```css
/* Dark mode */
--color-warning: #f59e0b;

/* Light mode ([data-theme="light"]) */
--color-warning: #d97706;
```

### `RGDAuthoringForm.css` additions

```css
/* Inline validation message beneath an input.
   --field-msg-height reserves space to prevent layout shift. */
.rgd-authoring-form__field-msg {
  display: block;
  min-height: 1.25em;      /* reserve space even when empty */
  font-size: 0.75rem;
  line-height: 1.25;
  color: var(--color-error);
  /* role="alert" + aria-live set in JSX */
}

.rgd-authoring-form__field-msg--warn {
  color: var(--color-warning);
}

/* Summary badge at top of form */
.rgd-authoring-form__validation-summary {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 0.25rem;
  background: var(--color-advisor-bg);
  border: 1px solid var(--color-advisor-border);
  color: var(--color-warning);
  font-size: 0.75rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
}
```

### `RGDAuthoringForm.css` updated (fix pre-existing violation)

Replace `var(--color-warning, var(--color-text-muted))` with `var(--color-warning)`
in `.rgd-authoring-form__badge--conditional` and `.rgd-authoring-form__warn-badge`.

---

## Component Modifications

### `YAMLPreview.tsx`

Wrap the default export with `React.memo`:

```tsx
const YAMLPreview = React.memo(function YAMLPreview({ yaml, title = 'Manifest' }: YAMLPreviewProps) {
  // ... unchanged body ...
})
export default YAMLPreview
```

### `RGDAuthoringForm.tsx`

1. Import `validateRGDState` and `ValidationState` from `@/lib/generator`.
2. Call `const validation = validateRGDState(state)` at the top of the component
   render body (no `useMemo` — fast enough synchronously).
3. Render `validation.totalCount > 0 &&` summary badge at top of form.
4. Add `<span role="alert" aria-live="polite" className="...">` message elements
   beneath: `rgdName` input, `kind` input, each resource `id` input, each spec
   field `name` input + constraint panel, each status field `name` input.

---

## US8 Additions: Bidirectional YAML Import

### New Type: `ParseResult` (in `web/src/lib/generator.ts`)

```typescript
export type ParseResult =
  | { ok: true; state: RGDAuthoringState }
  | { ok: false; error: string }
```

**Constraints**:
- Never throws — all errors surface as `{ ok: false, error: string }`.
- On success: the returned `state` is a fully-defaulted `RGDAuthoringState`
  with new stable `id` / `_key` values generated for all rows.

---

### New Function: `parseRGDYAML(yaml: string): ParseResult`

**Location**: `web/src/lib/generator.ts` (exported alongside `generateRGDYAML`)

**Approach**: Line-by-line string parser targeting the fixed-indent structure
produced by `generateRGDYAML`. Does NOT use a general-purpose YAML library
(constitution §V — no new npm deps). Scans indented blocks by tracking the
current nesting context via an indent-stack state machine.

**Parsing algorithm** (pseudocode):

```
1. Guard: if yaml does not contain "kind: ResourceGraphDefinition" → error

2. Extract metadata.name → rgdName
   Pattern: /^  name:\s+(.+)/m

3. Extract spec.schema block (everything under "  schema:")
   a. spec.schema.kind → kind
   b. spec.schema.apiVersion → apiVersion
   c. spec.schema.group → group (default 'kro.run' if absent)
   d. spec.schema.scope → scope ('Cluster' if present, else 'Namespaced')
   e. spec.schema.spec.* → specFields[] (each key: "typeString")
      - Parse typeString with parseSimpleSchemaStr()
   f. spec.schema.status.* → statusFields[] (each key: expression)

4. Extract spec.resources[] array (each "    - id:" block)
   For each resource block:
   a. id = value after "      id:"
   b. If "      externalRef:" exists → resourceType = 'externalRef'
      - Extract externalRef.apiVersion, kind, metadata.name/namespace/selector
   c. Else if "      forEach:" exists → resourceType = 'forEach'
      - Extract forEachIterators from "        - varname: expression" entries
      - Extract template block → templateYaml (lines after kind:, stripped of
        leading 8 spaces)
   d. Else → resourceType = 'managed'
      - Extract template block → templateYaml
   e. Extract includeWhen → first entry of includeWhen array (if present)
   f. Extract readyWhen → array entries (if present)
   g. apiVersion + kind from template or externalRef block

5. Assign fresh ids/keys using counter-based helpers
   (idempotent — counter resets per parse call)

6. Return { ok: true, state: assembled RGDAuthoringState }
```

**`parseSimpleSchemaStr(s: string): Partial<AuthoringField>`**:

New helper in `generator.ts`. Parses the SimpleSchema modifier string:
`"integer | default=3 | minimum=1 | maximum=100 | enum=dev,prod | pattern=^[a-z]+"`.

```
Split on " | " → first token is base type, rest are modifiers.
  - "required"     → required: true
  - "default=X"    → defaultValue: X
  - "minimum=X"    → minimum: X
  - "maximum=X"    → maximum: X
  - "enum=X"       → enum: X
  - "pattern=X"    → pattern: X
  - unknown token  → ignored (graceful degradation)
```

Strips surrounding quotes from the full string before splitting.

---

### New Component: `YAMLImportPanel` (in `web/src/components/YAMLImportPanel.tsx`)

**Props**:
```typescript
interface YAMLImportPanelProps {
  onImport: (state: RGDAuthoringState) => void
}
```

**Behaviour**:
- Collapsible panel, collapsed by default.
- Contains a `<textarea>` (`data-testid="import-yaml-input"`, rows=10, monospace)
  and an "Apply" button (`data-testid="import-yaml-apply"`).
- On Apply: calls `parseRGDYAML(textarea value)`.
  - `{ ok: true }` → calls `onImport(state)`, collapses panel, clears textarea.
  - `{ ok: false }` → shows inline error (`data-testid="import-parse-error"`),
    does NOT call `onImport`.
- The collapse toggle has `data-testid="import-yaml-toggle"`.

**No CSS framework** — styled with a new `YAMLImportPanel.css` using only
`tokens.css` custom properties.

---

### `AuthorPage.tsx` modification

Pass `onImport={setRgdState}` to `<YAMLImportPanel>`. Place `YAMLImportPanel`
above `<RGDAuthoringForm>` in the left pane.

---

### New CSS file: `web/src/components/YAMLImportPanel.css`

Key classes:
- `.yaml-import-panel` — collapsible container, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-sm)`
- `.yaml-import-panel__header` — clickable toggle row
- `.yaml-import-panel__body` — expandable content area (flex-direction: column, gap)
- `.yaml-import-panel__textarea` — monospace, same styling as template textarea in form
- `.yaml-import-panel__apply-btn` — primary action button (uses `--color-primary`)
- `.yaml-import-panel__error` — rose error text (`var(--color-error)`, `font-size: 0.75rem`)

All colors via `var(--token)` — no hardcoded hex/rgba.

---

## US9 Additions: Dry-Run Cluster Validation

### New Go response type: `DryRunResult` (`internal/api/types/response.go`)

```go
// DryRunResult is the response payload for POST /api/v1/rgds/validate.
// Valid=true means kro's admission webhook accepted the object in dry-run mode.
// Valid=false means the webhook (or API server) rejected it; Error carries the reason.
type DryRunResult struct {
    Valid bool   `json:"valid"`
    Error string `json:"error,omitempty"`
}
```

### New backend handler: `ValidateRGD` (`internal/api/handlers/validate.go`)

```
POST /api/v1/rgds/validate
Content-Type: text/plain (raw YAML body)
```

**Algorithm**:
1. Read raw body (limit 1 MiB).
2. Unmarshal YAML into `unstructured.Unstructured` using `k8s.io/apimachinery/pkg/util/yaml.NewYAMLToJSONDecoder`.
3. Assert `kind == "ResourceGraphDefinition"` and `apiVersion` starts with `kro.run/` → else return 400.
4. Call `h.factory.Dynamic().Resource(rgdGVR).Apply(ctx, name, obj, metav1.ApplyOptions{DryRun: []string{"All"}, FieldManager: "kro-ui"})`.
5. On success (no error) → return `{ valid: true }`.
6. On Kubernetes API error → extract `.Message` from `k8s.io/apimachinery/pkg/api/errors.StatusError` → return `{ valid: false, error: message }`.
7. On any other error → return 503.

**Does NOT persist anything.** Server timeout: 5s (inherited from chi middleware).

### New route registration (`internal/server/server.go`)

```go
r.Post("/rgds/validate", h.ValidateRGD)
```

### Frontend: `YAMLPreview` modification

`YAMLPreview` gains two new optional props:

```typescript
interface YAMLPreviewProps {
  yaml: string
  title?: string
  // US9: dry-run validate
  onValidate?: () => void
  validateResult?: DryRunResult | null
  validateLoading?: boolean
}

type DryRunResult = { valid: true } | { valid: false; error: string }
```

- Renders `data-testid="dry-run-btn"` button when `onValidate` is provided.
- Renders `data-testid="dry-run-result"` when `validateResult` is non-null.
- Loading state: button text "Validating…", `disabled`, `aria-busy="true"`.
- Result cleared by parent when `yaml` prop changes (parent resets `validateResult`
  to `null` in a `useEffect` watching `yaml`).

**`React.memo` compatibility**: adding optional props does not break memo — the
shallow comparison still works correctly for the new optional prop values.

### Frontend: `AuthorPage.tsx` modification for US9

```typescript
const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
const [dryRunLoading, setDryRunLoading] = useState(false)

// Clear stale result whenever YAML changes
useEffect(() => { setDryRunResult(null) }, [rgdYaml])

async function handleValidate() {
  setDryRunLoading(true)
  setDryRunResult(null)
  try {
    const res = await api.validateRGD(rgdYaml)
    setDryRunResult(res)
  } catch {
    setDryRunResult({ valid: false, error: 'Could not reach cluster' })
  } finally {
    setDryRunLoading(false)
  }
}
```

Pass `onValidate={handleValidate}`, `validateResult={dryRunResult}`,
`validateLoading={dryRunLoading}` to `<YAMLPreview>`.

### New frontend API call (`web/src/lib/api.ts`)

```typescript
export async function validateRGD(yaml: string): Promise<DryRunResult> {
  const res = await fetch(`${BASE}/api/v1/rgds/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: yaml,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<DryRunResult>
}
```

---

## US10 Additions: Offline kro-Library Deep Validation

### New Go package: `internal/validate/`

**Files**:
- `internal/validate/validate.go` — exported validator functions
- `internal/validate/validate_test.go` — unit tests (no cluster needed)

**Exported API** (all functions are pure, no cluster calls):

```go
package validate

import (
    krocel    "github.com/kubernetes-sigs/kro/pkg/cel"
    kroschema "github.com/kubernetes-sigs/kro/pkg/simpleschema"
    apitypes  "github.com/pnz1990/kro-ui/internal/api/types"
)

// ValidateSpecFields validates kro SimpleSchema type strings from spec.schema.spec.
// fieldMap: map of field name → raw type string (e.g. "integer | minimum=1").
// Returns one StaticIssue per invalid field.
func ValidateSpecFields(fieldMap map[string]string) []apitypes.StaticIssue

// ValidateCELExpressions validates CEL syntax in resource template fields.
// resources: list of { id: string, expressions: []string } extracted from spec.resources.
// Returns one StaticIssue per invalid expression, referencing the resource ID.
func ValidateCELExpressions(resources []ResourceExpressions) []apitypes.StaticIssue

// ValidateResourceIDs validates that resource IDs conform to kro's lowerCamelCase format.
// Returns one StaticIssue per non-conforming ID.
func ValidateResourceIDs(ids []string) []apitypes.StaticIssue

// ResourceExpressions is the input type for ValidateCELExpressions.
type ResourceExpressions struct {
    ID          string
    Expressions []string // raw "${...}" strings extracted from the template
}
```

**Implementation notes**:

`ValidateSpecFields`:
- Calls `kroschema.ParseField(typeString)` for each field.
- On error → `StaticIssue{ Field: "spec.schema.spec."+name, Message: err.Error() }`.
- Strips surrounding quotes from the type string before calling.

`ValidateCELExpressions`:
- Calls `krocel.DefaultEnvironment()` once (cached via `sync.Once`).
- For each expression, strips the `${` / `}` wrapper to get the raw CEL text.
- Calls `env.Parse(celText)` — on `*cel.Error` → `StaticIssue{ Field: "spec.resources[id].template", Message: err.Error() }`.
- Only validates CEL expressions that match the `${...}` pattern; literal strings are skipped.

`ValidateResourceIDs`:
- Validates each ID against `/^[a-z][a-zA-Z0-9]*$/`.
- Returns `StaticIssue{ Field: "spec.resources[id].id", Message: "resource ID must be lowerCamelCase" }` for violations.

**`panic` safety**: all three functions are wrapped in `recover()` and return a
single `StaticIssue{ Field: "internal", Message: "validation panic: ..." }` if
kro library code panics on pathological input.

### New Go response types (`internal/api/types/response.go`)

```go
// StaticIssue is a single issue from offline kro-library validation.
type StaticIssue struct {
    Field   string `json:"field"`
    Message string `json:"message"`
}

// StaticValidationResult is the response payload for POST /api/v1/rgds/validate/static.
type StaticValidationResult struct {
    Issues []StaticIssue `json:"issues"`
}
```

### New backend handler: `ValidateRGDStatic` (`internal/api/handlers/validate.go`)

```
POST /api/v1/rgds/validate/static
Content-Type: text/plain (raw YAML body)
```

**Algorithm**:
1. Read raw YAML body (limit 1 MiB).
2. Extract `spec.schema.spec` field map from the YAML using `internal/k8s` helpers
   or inline unstructured navigation.
3. Extract resource expressions: walk `spec.resources[].template` for `${...}` patterns.
4. Extract resource IDs from `spec.resources[].id`.
5. Call `validate.ValidateSpecFields`, `validate.ValidateCELExpressions`,
   `validate.ValidateResourceIDs`.
6. Merge all issues into a `StaticValidationResult` and return JSON 200.
7. On any panic/error in extraction → 500 with `{ issues: [] }` and log the error.

**Does NOT contact the Kubernetes API server.** Server timeout: 5s.

### New route registration (`internal/server/server.go`)

```go
r.Post("/rgds/validate/static", h.ValidateRGDStatic)
```

### Frontend: `RGDAuthoringForm` modification for US10

- New `staticIssues?: StaticIssue[]` prop on `RGDAuthoringForm`.
- Renders a "Deep validation" section below the summary badge when
  `staticIssues.length > 0`. Each issue shown as a row with the `field` path and
  `message`. Section hidden when empty.
- `data-testid="static-validation-section"` on the container.

### Frontend: `AuthorPage.tsx` modification for US10

```typescript
const [staticIssues, setStaticIssues] = useState<StaticIssue[]>([])

// Debounced static validation — fires 1s after last YAML change
useEffect(() => {
  const t = setTimeout(async () => {
    try {
      const result = await api.validateRGDStatic(rgdYaml)
      setStaticIssues(result.issues)
    } catch {
      setStaticIssues([]) // silent fail — static validation is best-effort
    }
  }, 1000)
  return () => clearTimeout(t)
}, [rgdYaml])
```

Pass `staticIssues={staticIssues}` to `<RGDAuthoringForm>`.

### New frontend API call (`web/src/lib/api.ts`)

```typescript
export async function validateRGDStatic(yaml: string): Promise<StaticValidationResult> {
  const res = await fetch(`${BASE}/api/v1/rgds/validate/static`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: yaml,
  })
  if (!res.ok) return { issues: [] } // best-effort — never crash the form
  return res.json() as Promise<StaticValidationResult>
}
```

### CSS additions for US10 (`web/src/components/RGDAuthoringForm.css`)

```css
.rgd-authoring-form__deep-validation {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
}

.rgd-authoring-form__deep-validation-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.rgd-authoring-form__deep-issue {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rgd-authoring-form__deep-issue-field {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}

.rgd-authoring-form__deep-issue-msg {
  font-size: 12px;
  color: var(--color-error);
}
```
