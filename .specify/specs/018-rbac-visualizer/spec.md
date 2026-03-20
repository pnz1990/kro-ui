# Feature Specification: RBAC & Access Control Visualizer

**Feature Branch**: `018-rbac-visualizer`
**Created**: 2026-03-20
**Status**: Draft
**Depends on**: `003-rgd-detail-dag` (merged)
**Constitution ref**: §II (Cluster Adaptability — dynamic client), §III (Read-Only),
§V (Simplicity), §IX (Theme)

---

## Context

The #1 source of kro support questions is RBAC misconfiguration: a platform
engineer adds a new resource type to an RGD, but forgets to grant kro's service
account permission to manage it. The reconciliation silently fails.

This spec adds an "Access" tab to the RGD detail page that compares what
permissions kro needs (derived from the RGD's resource list) against what
permissions it actually has (from ClusterRole/RoleBindings). All data comes
from the Kubernetes API server — no kro controller access needed.

---

## User Scenarios & Testing

### User Story 1 — Platform engineer sees permission gaps (Priority: P1)

On the RGD detail page, an "Access" tab shows a table of all resource types
(GVRs) managed by this RGD. For each GVR, it shows: the required verbs
(`get`, `list`, `watch`, `create`, `update`, `patch`, `delete`), and whether
kro's service account has those permissions (green ✓ or red ✗).

**Why this priority**: Permission gaps are invisible until reconciliation fails.
Proactive detection saves hours of debugging.

**Independent Test**: With an RGD that manages `Deployment`, `Service`, and
`IAMRole`, and kro's ClusterRole only grants access to `Deployment` and
`Service`, open the Access tab. Confirm: `IAMRole` row shows red ✗ for all
verbs.

**Acceptance Scenarios**:

1. **Given** an RGD with resources of kind Deployment, Service, ConfigMap,
   **When** the Access tab loads, **Then** 3 rows appear (plus the root CR's
   GVR), each showing the required verbs
2. **Given** kro's ClusterRole grants `get, list, watch, create, update, patch,
   delete` on Deployments, **When** rendered, **Then** the Deployment row shows
   green ✓ for all verbs
3. **Given** kro's ClusterRole has no rules for IAMRole, **When** rendered,
   **Then** the IAMRole row shows red ✗ for all verbs with a warning banner:
   "kro cannot manage this resource — missing RBAC permissions"
4. **Given** kro has `get, list, watch` but NOT `create, update, delete` on
   ConfigMap, **When** rendered, **Then** the ConfigMap row shows green ✓ for
   read verbs and red ✗ for write verbs
5. **Given** the RGD is read-only (kro-ui's own RBAC), **When** the page loads,
   **Then** a note explains "kro-ui checks kro's service account permissions, not
   its own"

---

### User Story 2 — Platform engineer sees the kubectl fix command (Priority: P2)

For each permission gap, the Access tab shows a copy-pasteable kubectl command
to add the missing permission to kro's ClusterRole.

**Acceptance Scenarios**:

1. **Given** IAMRole is missing all permissions, **When** the gap row is
   expanded, **Then** a code block shows the ClusterRole rule YAML that needs
   to be added, and the kubectl command to apply it
2. **Given** no permission gaps exist, **When** rendered, **Then** a green
   banner shows "All permissions satisfied" with no fix suggestions

---

### Edge Cases

- kro installed via Helm with custom service account name → detect via the kro
  Deployment's `spec.template.spec.serviceAccountName` or fall back to `kro`
- kro service account not found → show "Could not find kro's service account"
  with a field to manually specify it
- Namespace-scoped RoleBindings → check both ClusterRoleBindings and
  RoleBindings for the RGD's target namespace
- Wildcard rules (`*` for apiGroups, resources, or verbs) → treat as granting
  all matching permissions
- Aggregated ClusterRoles → resolve aggregation labels and include all
  aggregated rules

---

## Requirements

### Functional Requirements

- **FR-001**: Access tab MUST extract all unique GVRs from the RGD's
  `spec.resources` (template `apiVersion` + `kind`, resolved to GVR via
  discovery)
- **FR-002**: Access tab MUST determine kro's required verbs per GVR:
  `get, list, watch, create, update, patch, delete` for managed resources;
  `get, list, watch` for external references
- **FR-003**: Access tab MUST fetch kro's service account's effective
  permissions by reading ClusterRoleBindings and RoleBindings that reference
  kro's service account, then reading the associated ClusterRoles/Roles
- **FR-004**: Permission comparison MUST be displayed as a table: rows = GVRs,
  columns = verbs, cells = ✓ or ✗
- **FR-005**: Missing permissions MUST be highlighted and a fix suggestion shown
- **FR-006**: A new backend endpoint MUST be added:
  `GET /api/v1/rgds/:name/access` — returns the permission matrix
- **FR-007**: All styles MUST use CSS tokens from `tokens.css`

### Non-Functional Requirements

- **NFR-001**: Access tab loads within 2s (requires discovery + RBAC reads)
- **NFR-002**: TypeScript strict mode MUST pass

### Key Components

- **`AccessTab`** (`web/src/components/AccessTab.tsx`): permission matrix table
  with gap highlighting
- **`PermissionCell`** (`web/src/components/PermissionCell.tsx`): green ✓ or red ✗
  cell
- **`RBACFixSuggestion`** (`web/src/components/RBACFixSuggestion.tsx`): kubectl
  command block for missing permissions
- **Backend**: `internal/api/handlers/access.go` — resolves GVRs from RGD,
  reads RBAC resources, computes permission matrix
- **Backend**: `internal/k8s/rbac.go` — RBAC resolution logic (find service
  account bindings, resolve roles, check rules)

---

## Testing Requirements

### Unit Tests (required before merge)

```go
// internal/k8s/rbac_test.go
func TestResolveEffectivePermissions(t *testing.T) {
  // Table-driven tests:
  // - ClusterRole with exact match → permissions granted
  // - ClusterRole with wildcard apiGroup → permissions granted
  // - ClusterRole with wildcard verb → all verbs granted
  // - No matching binding → no permissions
  // - Aggregated ClusterRole → aggregated rules included
}
```

```typescript
// web/src/components/AccessTab.test.tsx
describe("AccessTab", () => {
  it("shows green for granted permissions", () => { ... })
  it("shows red for missing permissions", () => { ... })
  it("shows warning banner when gaps exist", () => { ... })
  it("shows success banner when all permissions satisfied", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: All RGD resource GVRs are listed with correct verb requirements
- **SC-002**: Permission gaps are visually highlighted
- **SC-003**: Fix suggestions are copy-pasteable and correct
- **SC-004**: Wildcard RBAC rules are handled correctly
- **SC-005**: TypeScript strict mode passes with 0 errors
