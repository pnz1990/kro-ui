# Data Model: 036 — RGD Detail Header Kind Label + Status Badge

**Phase 1 output** for `.specify/specs/036-rgd-detail-header/plan.md`

---

## Entities and Data Flow

This feature introduces no new data entities. All data is derived from the
`K8sObject` (raw `unstructured.Unstructured`) already fetched by `RGDDetail`
via `GET /api/v1/rgds/{name}`.

### Consumed Data

| Field path in K8sObject | Extraction function | TypeScript type | Used for |
|---|---|---|---|
| `metadata.name` | `extractRGDName(rgd)` | `string` | RGD name `<h1>` (already rendered) |
| `spec.schema.kind` | `extractRGDKind(rgd)` | `string` (empty if absent) | Kind badge |
| `status.conditions[type=Ready]` | `extractReadyStatus(rgd)` | `ReadyStatus` | StatusDot |

### `ReadyStatus` shape (from `@/lib/format`)

```ts
type ReadyState = 'ready' | 'error' | 'unknown'

interface ReadyStatus {
  state:   ReadyState  // 'ready' | 'error' | 'unknown'
  reason:  string      // empty string if absent
  message: string      // empty string if absent
}
```

### Degradation rules (from constitution §XII and `extractReadyStatus` implementation)

| Cluster condition | Rendered result |
|---|---|
| `status.conditions[type=Ready].status === 'True'` | StatusDot green (`--color-status-ready`) |
| `status.conditions[type=Ready].status === 'False'` | StatusDot red (`--color-status-error`) |
| `status.conditions` absent / no Ready entry | StatusDot gray (`--color-status-unknown`), never an error state |
| `spec.schema.kind` absent or empty | Kind badge omitted entirely — not `?`, not empty string |

---

## Component Changes

### `RGDDetail.tsx` — header block (lines 198–201)

**Before:**
```tsx
{/* Header */}
<div className="rgd-detail-header">
  <h1 className="rgd-detail-name">{String(rgdName)}</h1>
</div>
```

**After (conceptual):**
```tsx
{/* Header */}
<div className="rgd-detail-header">
  <div className="rgd-detail-header-row">
    <StatusDot state={readyState.state} reason={readyState.reason} message={readyState.message} />
    <h1 className="rgd-detail-name">{String(rgdName)}</h1>
  </div>
  {rgdKind && (
    <span className="rgd-detail-kind">{rgdKind}</span>
  )}
</div>
```

New local variables extracted once from `rgd` (before the early-return guards):
```ts
const rgdKind = extractRGDKind(rgd)
const readyState = extractReadyStatus(rgd)
```

### `RGDDetail.css` — new styles

```css
/* Header row: StatusDot + name on one line */
.rgd-detail-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

/* Kind badge — visually identical to .rgd-card__kind */
.rgd-detail-kind {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--color-primary-muted);
  color: var(--color-primary-text);
  margin-bottom: 12px;
}
```

The existing `.rgd-detail-name` margin-bottom adjusts from `16px` to `0` (margin
is moved to `.rgd-detail-header-row` and `.rgd-detail-kind` instead).

---

## Validation Rules

- `rgdKind` guard: `{rgdKind && <span ...>}` — empty string is falsy, so absent
  Kind automatically omits the badge. This is consistent with `RGDCard.tsx:43`.
- `readyState` is always a valid `ReadyStatus` (never null); `extractReadyStatus`
  returns `{ state: 'unknown', ... }` as a safe default.

---

## State Transitions

Not applicable — this feature renders static data from a single fetch.
The RGD `state` is: `ready | error | unknown` as defined by `extractReadyStatus`.

---

## No new interfaces / contracts

This is a pure frontend UI change. The API contract (`GET /api/v1/rgds/{name}`)
is unchanged. No new HTTP endpoints, no new response fields.
The "contracts" directory is skipped per the template note:
> "Skip if project is purely internal"  
> (this change exposes nothing new to users or external systems beyond visual polish)
