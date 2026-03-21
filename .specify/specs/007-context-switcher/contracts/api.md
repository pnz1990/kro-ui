# API Contract: Context Switcher

**Feature**: 007-context-switcher
**Status**: Implemented (backend) — documented for frontend reference

All endpoints are already implemented and tested. This document serves as the
contract reference for frontend development.

---

## GET /api/v1/contexts

List all available kubeconfig contexts and the currently active one.

**Handler**: `internal/api/handlers/contexts.go` → `Handler.ListContexts`

### Request

No parameters. No body.

### Response — 200 OK

```json
{
  "contexts": [
    { "name": "staging", "cluster": "staging-cluster", "user": "staging-user" },
    { "name": "production", "cluster": "prod-cluster", "user": "prod-user" }
  ],
  "active": "staging"
}
```

### Response — 500 Internal Server Error

```json
{ "error": "load kubeconfig: <detail>" }
```

Returned when the kubeconfig file cannot be read.

### Frontend Usage

```typescript
import { listContexts, ContextsResponse } from '@/lib/api'

const data: ContextsResponse = await listContexts()
// data.contexts — all available contexts
// data.active   — currently active context name
```

---

## POST /api/v1/contexts/switch

Switch the active kubeconfig context. Atomically replaces the Kubernetes
clients (dynamic + discovery) on the server side.

**Handler**: `internal/api/handlers/contexts.go` → `Handler.SwitchContext`

### Request

```json
{ "context": "production" }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `context` | `string` | Yes | Target context name to switch to |

### Response — 200 OK

```json
{ "active": "production" }
```

### Response — 400 Bad Request

Returned for:
- Missing or empty `context` field
- Context name not found in kubeconfig
- Invalid JSON body

```json
{ "error": "context name must not be empty" }
```

```json
{ "error": "context \"nonexistent\" not found in kubeconfig" }
```

### Frontend Usage

```typescript
import { switchContext } from '@/lib/api'

const result = await switchContext('production')
// result.active === 'production'
```

### Error Handling

The frontend must:
1. Show a loading indicator while the POST is in-flight (FR-008)
2. On failure, display the error message and keep the previous context (FR-009)
3. On success, update the displayed context name and refetch page data (FR-007)
4. Apply a 10-second timeout using `AbortController` (edge case spec)

---

## Component Contract: ContextSwitcher

### Props

```typescript
interface ContextSwitcherProps {
  contexts: KubeContext[]
  active: string
  onSwitch: (name: string) => void
}
```

### Data Test IDs (for E2E)

| Element | `data-testid` |
|---------|--------------|
| Trigger button | `context-switcher-btn` |
| Dropdown panel | `context-dropdown` |
| Context name in top bar | `context-name` |

### ARIA Attributes

| Element | Attribute | Value |
|---------|-----------|-------|
| Trigger button | `aria-haspopup` | `"listbox"` |
| Trigger button | `aria-expanded` | `"true"` / `"false"` |
| Dropdown panel | `role` | `"listbox"` |
| Context option | `role` | `"option"` |
| Active context option | `aria-selected` | `"true"` |

### Keyboard Interactions

| Key | Behavior |
|-----|----------|
| Enter/Space | Open dropdown (from button) or select focused option |
| Escape | Close dropdown, return focus to trigger |
| ArrowDown | Move focus to next option |
| ArrowUp | Move focus to previous option |
