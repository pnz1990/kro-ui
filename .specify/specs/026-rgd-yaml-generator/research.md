# Research: 026-rgd-yaml-generator

**Date**: 2026-03-23
**Branch**: `026-rgd-yaml-generator`

All NEEDS CLARIFICATION items from Technical Context are resolved below.

---

## 1. Reuse Strategy for Clipboard + Copy UX

**Decision**: Inline clipboard pattern from `KroCodeBlock` — no hook extraction needed.

**Rationale**: The existing copy UX in `KroCodeBlock.tsx` uses `navigator.clipboard.writeText` with a `copied: boolean` state and a 2-second `setTimeout` reset. This is a 5-line pattern, not a library. Extracting it into a `useClipboard` hook is unnecessary complexity (§V). `YAMLPreview` will replicate this pattern directly. The visual confirmation is icon-swap only (no `.is-copied` CSS class needed).

**Pattern to use**:
```ts
const [copied, setCopied] = useState(false)
const handleCopy = useCallback(() => {
  navigator.clipboard.writeText(yaml).then(() => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, () => {})
}, [yaml])
```

---

## 2. CSS Tokens for Form Inputs

**Decision**: Compose from existing tokens in `tokens.css`. No new input-specific tokens needed — the existing token set is sufficient.

**Key token mapping**:

| Use | Token |
|-----|-------|
| Input/select background | `var(--color-surface-2)` |
| Input border (resting) | `var(--color-border)` |
| Input border (focus) | `var(--color-border-focus)` (= `var(--color-primary)`, auto-applied by global `:focus-visible`) |
| Label text | `var(--color-text)` |
| Muted/secondary labels | `var(--color-text-muted)` |
| Placeholder / disabled | `var(--color-text-faint)` |
| Border radius | `var(--radius-sm)` (4px) |
| Transition | `var(--transition-fast)` (80ms) |
| Primary button bg | `var(--color-primary)` / hover: `var(--color-primary-hover)` |
| Primary button text | `var(--color-on-primary)` |
| Type/constraint badge | `var(--color-surface-3)` bg + `var(--color-primary-text)` text + `var(--radius-sm)` |
| Error indicator | `var(--color-error)` |

**Rationale**: No new tokens needed. Existing token vocabulary covers all form control states. Adding tokens for `--input-border`, `--input-bg`, etc. would be premature when the current tokens already express those values. If a new shadow token is needed (e.g. for a dropdown or popup within the form), it must be added to `tokens.css` per §IX.

---

## 3. YAML Serialization Strategy

**Decision**: Use the existing `toYaml` from `web/src/lib/yaml.ts` for object serialization. Use string construction (template literals) for the YAML envelope (`apiVersion`, `kind`, `metadata`).

**Rationale**: `toYaml` handles all the cases needed:
- Arrays of strings → multi-line `- item` blocks
- Nested objects → correct 2-space indentation
- Scalar quoting → auto-quotes strings containing `: `, `#`, boolean literals, numbers

For instance generation, the YAML will be built by constructing a JavaScript object `{ apiVersion, kind, metadata: { name }, spec: { ...fieldValues } }` and calling `toYaml()` on it. This avoids any manual string interpolation of field values and handles edge cases (special characters in string values, numeric values, arrays) automatically.

For the RGD authoring YAML, the structure is more template-like (the output contains `${schema.spec.name}` CEL expressions as string literals), so string construction is used directly to avoid the `toYaml` serializer double-quoting CEL expressions.

**Array field representation** in instance form: The user enters items via a repeatable row UI. The field value stored in React state is a `string[]`. When constructing the YAML object, it is passed directly as an array to `toYaml`.

---

## 4. Tab Integration in RGDDetail

**Decision**: Add `"generate"` to the `TabId` union in `RGDDetail.tsx`. Add a 7th tab button and a `{activeTab === "generate" && ...}` content block.

**Pattern** (from existing `TabId` and tab bar code):
```ts
type TabId = "graph" | "instances" | "yaml" | "validation" | "access" | "docs" | "generate"
```
Tab button uses `role="tab"`, `aria-selected={activeTab === "generate"}`, `data-testid="tab-generate"`, class `rgd-tab-btn`. Tab content wrapped in `<div className="rgd-tab-panel">`.

**No layout changes needed** for the tab bar — the existing `rgd-tab-bar` CSS uses `display: flex` with no `flex-wrap`, so adding a 7th button works as long as the viewport is wide enough. On narrow viewports, the tab bar already scrolls horizontally (no overflow clipping).

---

## 5. Form Field → Input Control Mapping

**Decision**: Map `ParsedType` to HTML controls as follows:

| Condition | Control | Notes |
|-----------|---------|-------|
| `parsedType.enum` is set | `<select>` | Split enum string on `,` for `<option>` values |
| `type === 'boolean'` | `<input type="checkbox">` | Checked state maps to `"true"` / `"false"` string |
| `type === 'integer'` or `'number'` | `<input type="number">` | `step=1` for integer |
| `type === 'array'` | Repeatable text rows + add/remove buttons | Value is `string[]` |
| `type === 'object'` or `'map'` | `<textarea>` | Raw YAML entry; validated as string |
| Anything else (including unknown) | `<input type="text">` | Graceful degradation (§XII) |

**Default value pre-filling**: Use `'default' in parsedType` (key-existence check, not `!== undefined`) to detect presence of a default, and pre-fill the input with `parsedType.default`. This is the same guard used in `FieldTable.tsx` to avoid issue #61 (falsy defaults `0`, `false`, `""` mistakenly treated as "no default").

---

## 6. Batch Row Parsing

**Decision**: Parse each non-empty line as a sequence of `key=value` tokens separated by spaces. The first `=` in each token is the delimiter; everything after the first `=` is the value (allows values with spaces if quoted — but we do not require quoting; simple split on first `=`).

**Algorithm**:
```ts
function parseBatchRow(line: string): Record<string, string> {
  const result: Record<string, string> = {}
  const tokens = line.trim().split(/\s+/)
  for (const token of tokens) {
    const eqIdx = token.indexOf('=')
    if (eqIdx <= 0) continue  // skip malformed tokens (no key or starts with '=')
    const key = token.slice(0, eqIdx)
    const value = token.slice(eqIdx + 1)
    result[key] = value
  }
  return result
}
```

**Alternatives considered**: CSV parsing, JSON per row. Rejected: CSV is over-engineered and confusing in a YAML context; JSON per row requires users to write `{"name":"foo"}` which is worse UX than `name=foo`. Simple `key=value` is the kubectl annotation syntax and is immediately recognizable.

---

## 7. RGD Authoring YAML Structure

**Decision**: The RGD authoring output is a `ResourceGraphDefinition` YAML with `kro.run/v1alpha1` apiVersion. The structure produced follows the upstream kro schema exactly.

**Authoritative structure** (from kro upstream `pkg/apis/v1alpha1`):
```yaml
apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: <user-provided-name>
spec:
  schema:
    apiVersion: v1alpha1
    kind: <user-defined-kind>
    spec:
      <fieldName>: <SimpleSchema type string>
    status:
      <fieldName>: ${<cel-expression>}
  resources:
    - id: <resourceId>
      template:
        apiVersion: <apiVersion>
        kind: <kind>
        metadata:
          name: ${schema.metadata.name}-<resourceId>
          namespace: ${schema.metadata.namespace}
        spec: {}
```

**CEL placeholder strategy**: In the scaffolded resource template, metadata fields reference schema via `${schema.metadata.name}`. The spec section is a stub `{}` — the user fills in CEL expressions manually after copying the scaffold. This is intentional: generating CEL for spec fields requires knowing the target resource's schema, which is out of scope.

---

## 8. `metadata.name` Editing and Slug Generation

**Decision**: Always include `metadata.name` as the first editable form field, pre-filled with `my-<kind-slug>`. Reuse the exact slug function from `ExampleYAML.tsx`:

```ts
const kindSlug = kind
  .replace(/([A-Z])/g, (match, _, offset) =>
    offset === 0 ? match.toLowerCase() : `-${match.toLowerCase()}`)
  .replace(/^-/, '')
const defaultName = `my-${kindSlug}`
```

**Rationale**: Consistency with spec 020's `ExampleYAML`. The `metadata.name` must be separate from spec fields in the form UI (it is a top-level field, not in `spec`). The YAML preview always shows a valid name even when the user hasn't typed anything.

---

## 9. New RGD Action on Home/Catalog Pages

**Decision**: FR-013 (a "New RGD" button on home/catalog pages) is deferred to a subsequent iteration. The Generate tab on RGDDetail is the primary MVP entry point. The home/catalog pages already have virtualized rendering (spec 024) and adding a prominent "New RGD" button requires design decisions about where it lives (header vs. empty state vs. floating action button) that are out of scope for this spec.

**Rationale**: §I Iterative-First. The form-based generator delivers value independently without the home page button. FR-013 can be a follow-up spec (`027-rgd-authoring-entry-points` or a PR comment during review).

---

## Summary of Design Decisions

| Decision | Choice |
|----------|--------|
| Clipboard pattern | Inline `navigator.clipboard.writeText` + `copied` boolean (no hook) |
| YAML serialization | `toYaml()` for instance manifests; string construction for RGD scaffolds |
| Form → input mapping | enum→select, bool→checkbox, int/num→number, array→repeatable rows, else→text |
| Default pre-filling | `'default' in parsedType` key-existence guard |
| Batch parsing | Space-separated `key=value` tokens per line |
| RGD authoring | Fixed structure with `kro.run/v1alpha1`; CEL placeholders for metadata only |
| Tab integration | 7th tab `"generate"` added to `TabId` union in `RGDDetail.tsx` |
| metadata.name | Always-present editable field, pre-filled with `my-<kind-slug>` |
| FR-013 home button | Deferred to follow-up spec |
| New CSS tokens | None needed — compose from existing tokens |
