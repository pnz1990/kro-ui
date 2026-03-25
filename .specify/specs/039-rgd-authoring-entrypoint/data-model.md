# Data Model: RGD Authoring Global Entrypoint (039)

This feature is purely frontend. There are no new backend entities, no new API
endpoints, and no new state management patterns. All data types already exist in
`web/src/lib/generator.ts`.

---

## Existing Types (reused, not modified)

### `RGDAuthoringState` (`web/src/lib/generator.ts`)

The single state object that drives both `RGDAuthoringForm` and `generateRGDYAML`.

```typescript
interface RGDAuthoringState {
  rgdName: string        // kubernetes metadata.name of the RGD object
  kind: string           // spec.schema.kind — the CR kind being defined
  group: string          // spec.schema.apiVersion group prefix
  apiVersion: string     // spec.schema.apiVersion version segment
  specFields: AuthoringField[]   // repeatable spec field rows
  resources: AuthoringResource[] // repeatable resource template rows
}

interface AuthoringField {
  id: string             // stable React key (UUID-ish, never changes)
  name: string           // field name in spec.schema.spec
  type: string           // SimpleSchema type string (e.g. "string", "integer")
  defaultValue: string   // default= annotation value (empty = no default)
  required: boolean      // if true, no default= annotation is emitted
}

interface AuthoringResource {
  _key: string           // stable React key (never equal to user-editable `id`)
  id: string             // resource id in spec.resources[].id
  apiVersion: string     // resource template apiVersion
  kind: string           // resource template kind
}
```

### `STARTER_RGD_STATE` — Change: extract to export

Currently a `const` inside `GenerateTab.tsx`. Will be moved to / exported from
`web/src/lib/generator.ts` so both `GenerateTab` and `AuthorPage` share the same
default.

```typescript
// web/src/lib/generator.ts — newly exported
export const STARTER_RGD_STATE: RGDAuthoringState = {
  rgdName: 'my-app',
  kind: 'MyApp',
  group: 'kro.run',
  apiVersion: 'v1alpha1',
  specFields: [],
  resources: [{ _key: 'starter-web', id: 'web', apiVersion: 'apps/v1', kind: 'Deployment' }],
}
```

---

## New Components (shape only — no new types)

### `AuthorPage` (`web/src/pages/AuthorPage.tsx`)

State shape:
```typescript
const [rgdState, setRgdState] = useState<RGDAuthoringState>(STARTER_RGD_STATE)
const rgdYaml = useMemo(() => generateRGDYAML(rgdState), [rgdState])
```

Props: none (page component).

---

## Route Additions

| Route | Component | Title |
|-------|-----------|-------|
| `/author` | `AuthorPage` | `"New RGD — kro-ui"` |

Registered in `web/src/main.tsx` before the `path="*"` catch-all.

---

## UI State Transitions

```
Any page
  └─ TopBar "+ New RGD" click ──────────────────────► /author (AuthorPage)
                                                          │
                                                    RGDAuthoringForm
                                                    + YAMLPreview
                                                    (client-side only)

Home (items.length === 0, no search)
  └─ "New RGD" link in empty state ────────────────► /author

Catalog (items.length === 0, no filter)
  └─ "New RGD" link in empty state ────────────────► /author

/rgds/:name?tab=generate
  └─ "New RGD" mode button ────────────────────────► stays in-tab (no navigation)
                                                     (regression guard — no change)
```

---

## Validation Rules

None. `AuthorPage` mirrors the authoring form in `GenerateTab` exactly:
- No server-side validation
- No required-field guards on the page level
- The `RGDAuthoringForm` component itself already handles empty/default states
