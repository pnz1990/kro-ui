# Data Model: Context Switcher

**Feature**: 007-context-switcher
**Date**: 2026-03-20

## Entities

This feature has no persistent data model — it operates on kubeconfig contexts
(read from the filesystem) and React component state (ephemeral). The entities
below describe the runtime data structures exchanged between backend and frontend.

---

### KubeContext (Backend: `k8s.Context`, Frontend: `KubeContext`)

Represents a single kubeconfig context entry.

| Field | Go Type | TS Type | JSON Key | Description |
|-------|---------|---------|----------|-------------|
| Name | `string` | `string` | `name` | Context name from kubeconfig (unique) |
| Cluster | `string` | `string` | `cluster` | Cluster name referenced by this context |
| User | `string` | `string` | `user` | Auth info / user name |

**Source**: Extracted from `k8s.io/client-go/tools/clientcmd/api.Config.Contexts`
map at read time. Not stored persistently.

**Validation**: Names must be non-empty. The backend validates against the
kubeconfig file — unknown names return an error.

---

### ContextsResponse (API Response)

| Field | Go Type | TS Type | JSON Key | Description |
|-------|---------|---------|----------|-------------|
| Contexts | `[]k8s.Context` | `KubeContext[]` | `contexts` | All available contexts |
| Active | `string` | `string` | `active` | Currently active context name |

---

### SwitchContextRequest (API Request)

| Field | Go Type | TS Type | JSON Key | Description |
|-------|---------|---------|----------|-------------|
| Context | `string` | `string` | `context` | Target context name to switch to |

**Validation**: Must be non-empty. Must exist in kubeconfig.

---

### SwitchContextResponse (API Response)

| Field | Go Type | TS Type | JSON Key | Description |
|-------|---------|---------|----------|-------------|
| Active | `string` | `string` | `active` | New active context name after switch |

---

### ContextSwitcher Component State (Frontend Only)

| Field | Type | Initial | Description |
|-------|------|---------|-------------|
| isOpen | `boolean` | `false` | Whether dropdown is expanded |
| switching | `boolean` | `false` | Whether a switch request is in-flight |
| error | `string \| null` | `null` | Error message from last failed switch |

---

## Relationships

```
Layout (stateful)
  ├── contexts: KubeContext[]    ← fetched from GET /contexts on mount
  ├── activeContext: string      ← tracks current active context
  └── TopBar
       └── ContextSwitcher
            ├── reads: contexts[], activeContext
            ├── calls: POST /contexts/switch
            └── triggers: Layout.onSwitch(name) → updates activeContext
                          → Outlet key changes → child pages remount
```

## State Transitions

```
ContextSwitcher states:

  IDLE (isOpen=false, switching=false, error=null)
    → user clicks trigger button
  OPEN (isOpen=true, switching=false, error=null)
    → user clicks a non-active context
  SWITCHING (isOpen=false, switching=true, error=null)
    → POST succeeds
  IDLE (isOpen=false, switching=false, error=null)  [new active context]
    
  SWITCHING (isOpen=false, switching=true, error=null)
    → POST fails or times out
  ERROR (isOpen=false, switching=false, error="message")
    → user clicks trigger button (clears error)
  OPEN (isOpen=true, switching=false, error=null)
```
