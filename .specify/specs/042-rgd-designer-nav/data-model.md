# Data Model: 042-rgd-designer-nav

**Date**: 2026-03-25  
**Branch**: `042-rgd-designer-nav`

## Overview

This spec is a pure frontend refactor + enhancement. There are no new persistent entities, no new API endpoints, and no new backend types. The data model changes are limited to:

1. A new helper function `rgdAuthoringStateToSpec` in `generator.ts`
2. No changes to existing state shapes

---

## Existing entity: `RGDAuthoringState` (unchanged)

Defined in `web/src/lib/generator.ts:70`.

```typescript
interface RGDAuthoringState {
  rgdName: string          // metadata.name of the RGD
  kind: string             // spec.schema.kind
  group: string            // spec.schema.group (default: 'kro.run')
  apiVersion: string       // spec.schema.apiVersion (default: 'v1alpha1')
  specFields: AuthoringField[]
  resources: AuthoringResource[]
}

interface AuthoringField {
  _key: string             // React key (internal, not serialized)
  name: string             // field name in spec.schema.spec
  type: string             // SimpleSchema type string
  required: boolean
  description?: string
}

interface AuthoringResource {
  _key: string             // React key (internal)
  id: string               // resource ID in spec.resources[].id
  apiVersion: string       // template.apiVersion
  kind: string             // template.kind
}
```

**No changes to this interface.**

---

## New function: `rgdAuthoringStateToSpec`

**Location**: `web/src/lib/generator.ts` (new export)

**Purpose**: Convert `RGDAuthoringState` into the `spec: Record<string, unknown>` shape expected by `buildDAGGraph`. This bridges the authoring form's in-memory state to the DAG visualization pipeline without going through YAML serialization/parsing.

```typescript
/**
 * Convert RGDAuthoringState to a kro RGD spec object for DAG preview.
 *
 * Produces the minimal spec shape that buildDAGGraph can process:
 * {
 *   schema: { kind, apiVersion, spec: {...fields} },
 *   resources: [{ id, template: { apiVersion, kind, metadata, spec } }]
 * }
 *
 * Called by AuthorPage's live DAG preview (debounced at 300ms).
 */
export function rgdAuthoringStateToSpec(
  state: RGDAuthoringState,
): Record<string, unknown> {
  const schemaSpec: Record<string, string> = {}
  for (const f of state.specFields) {
    if (f.name) schemaSpec[f.name] = f.type || 'string'
  }

  return {
    schema: {
      kind: state.kind || 'MyApp',
      apiVersion: state.apiVersion || 'v1alpha1',
      ...(Object.keys(schemaSpec).length > 0 ? { spec: schemaSpec } : {}),
    },
    resources: state.resources
      .filter((r) => r.id)
      .map((r) => ({
        id: r.id,
        template: {
          apiVersion: r.apiVersion || 'apps/v1',
          kind: r.kind || 'Deployment',
          metadata: { name: '' },
          spec: {},
        },
      })),
  }
}
```

**Validation rules**:
- Resources with empty `id` are filtered out (no DAG node for incomplete rows)
- Fields with empty `name` produce no spec entry
- Defaults match `STARTER_RGD_STATE` defaults

---

## State diagram: AuthorPage live DAG preview

```
User types in RGDAuthoringForm
        │
        ▼
   setRgdState(newState)
        │
        ▼
useDebounce(rgdState, 300ms)
        │
        ▼
debouncedState changes
        │
        ▼
useMemo: rgdAuthoringStateToSpec(debouncedState)
        │
        ▼
useMemo: buildDAGGraph(spec, [])  ← no cluster context, no chain detection
        │
        ▼
<StaticChainDAG graph={graph} rgds={[]} rgdName={debouncedState.rgdName || 'my-rgd'} />
```

---

## Entities removed

| Entity | Location | Reason |
|--------|----------|--------|
| `GenerateMode = 'rgd'` | `GenerateTab.tsx:32` | Mode no longer exists |
| `rgdState` / `setRgdState` state | `GenerateTab.tsx:82` | Mode removed |
| `rgdYaml` derived state | `GenerateTab.tsx:91` | Mode removed |
| `STARTER_RGD_STATE` import in GenerateTab | `GenerateTab.tsx:17` | Unused after removal |
| `generateRGDYAML` import in GenerateTab | `GenerateTab.tsx:15` | Unused after removal |
| `RGDAuthoringState` import in GenerateTab | `GenerateTab.tsx:21` | Unused after removal |
| `RGDAuthoringForm` import in GenerateTab | `GenerateTab.tsx:24` | Unused after removal |
| `.top-bar__new-rgd-btn` CSS class | `TopBar.css:78` | Button replaced by NavLink |
