# Data Model: RGD List — Home Page

**Spec**: `002-rgd-list-home`
**Date**: 2026-03-20

---

## Entities

This spec is frontend-only. There are no database entities. The "data model"
describes the API response shapes consumed by the frontend and the derived
types used in components.

---

## API Response Shapes (consumed, not created)

### `GET /api/v1/rgds` → `K8sList`

```typescript
// Already defined in web/src/lib/api.ts
type K8sObject = Record<string, unknown>
type K8sList = { items: K8sObject[]; metadata: Record<string, unknown> }
```

Each item in `items` is an unstructured kro ResourceGraphDefinition. Relevant
fields (extracted via `format.ts` helpers, never accessed directly in components):

| Path | Type | Description | Example |
|------|------|-------------|---------|
| `metadata.name` | `string` | RGD name | `"web-service-graph"` |
| `metadata.creationTimestamp` | `string` (ISO 8601) | Creation time | `"2026-03-15T10:30:00Z"` |
| `spec.schema.kind` | `string` | Generated CRD kind | `"WebService"` |
| `spec.resources` | `unknown[]` | Managed resource array | `[{...}, {...}]` |
| `status.conditions` | `unknown[]` | K8s condition array | See below |

### `GET /api/v1/contexts` → `ContextsResponse`

```typescript
// Already defined in web/src/lib/api.ts
interface ContextsResponse {
  contexts: KubeContext[]
  active: string
}

interface KubeContext {
  name: string
  cluster: string
  user: string
}
```

---

## Derived Types (new, defined in `format.ts`)

### K8sCondition

```typescript
interface K8sCondition {
  type: string
  status: string       // 'True' | 'False' | 'Unknown'
  reason?: string
  message?: string
  lastTransitionTime?: string
}
```

Standard Kubernetes condition object shape. Used after runtime type-guard
validation — never asserted with `as`.

### ReadyState

```typescript
type ReadyState = 'ready' | 'error' | 'unknown'
```

Tri-state enum for UI rendering. Maps 1:1 to CSS tokens:

| State | CSS Token | Color |
|-------|-----------|-------|
| `'ready'` | `--color-status-ready` | Emerald (#10b981) |
| `'error'` | `--color-status-error` | Rose (#f43f5e) |
| `'unknown'` | `--color-status-unknown` | Gray (#6b7280) |

### ReadyStatus

```typescript
interface ReadyStatus {
  state: ReadyState
  reason: string       // e.g. 'ReconcileSuccess', '' if absent
  message: string      // e.g. 'All resources are ready', '' if absent
}
```

Full extraction result. Components use `state` for the dot color and
`reason`/`message` for the tooltip text.

---

## Component Prop Interfaces

### RGDCardProps

```typescript
interface RGDCardProps {
  rgd: K8sObject
}
```

The card receives the raw unstructured RGD object and extracts fields
internally using `format.ts` helpers. This keeps the parent (Home) simple
— it just maps over `items` without transforming each item.

### StatusDotProps

```typescript
interface StatusDotProps {
  state: ReadyState
  reason?: string      // Shown in title tooltip
  message?: string     // Shown in title tooltip
}
```

### SkeletonCardProps

No props. The skeleton card is a static placeholder with fixed dimensions.

### TopBarProps

```typescript
interface TopBarProps {
  contextName: string
}
```

Receives the active context name from Layout (which fetches it).

### LayoutProps

No custom props. Uses React Router's `<Outlet />` for child route rendering.

---

## State Management

No external state library (constitution §V). State lives in React components:

| State | Owner | Type | Source |
|-------|-------|------|--------|
| RGD list | `Home` | `K8sObject[]` | `listRGDs()` API call |
| Loading flag | `Home` | `boolean` | Set true before fetch, false after |
| Error | `Home` | `string \| null` | Catch block on fetch failure |
| Context name | `Layout` | `string` | `listContexts()` API call on mount |

**Data flow**:
```
Layout (fetches context name)
  └─ TopBar (displays context name)
  └─ <Outlet /> → Home (fetches RGD list)
       └─ RGDCard[] (receives single K8sObject each)
            └─ StatusDot (receives ReadyState)
```

---

## Relationships

```
K8sList
  └─ items: K8sObject[]     (1:N — one list, many RGDs)
       └─ status.conditions: K8sCondition[]  (1:N — one RGD, many conditions)
            └─ Ready condition → ReadyStatus  (1:1 extraction)

ContextsResponse
  └─ active: string          (1:1 — one active context)
```

---

## Validation Rules

All validation happens at the extraction layer (`format.ts`). Components never
access raw K8sObject fields directly.

| Field | Validation | Default |
|-------|-----------|---------|
| `metadata.name` | Must be string | `''` |
| `metadata.creationTimestamp` | Must be parseable by `Date.parse()` | `'Unknown'` age |
| `spec.schema.kind` | Must be string | `''` (omit kind badge) |
| `spec.resources` | Must be array | `0` count |
| `status.conditions` | Must be array with valid condition objects | `'unknown'` state |
