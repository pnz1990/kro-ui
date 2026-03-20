# Feature Specification: Context Switcher

**Feature Branch**: `007-context-switcher`
**Created**: 2026-03-20
**Status**: Draft

## User Scenarios & Testing

### User Story 1 — User switches between Kubernetes clusters without restarting the server (Priority: P1)

From the top bar, the user opens a dropdown showing all kubeconfig contexts. Selecting a different context sends a request to the server, which reloads its k8s client for that context. The UI then reloads the home page showing RGDs from the new cluster.

**Why this priority**: Multi-cluster workflows are common. Requiring a server restart for each switch is a major friction point.

**Independent Test**: With two contexts in kubeconfig, switch from context A to context B. Confirm the top bar updates to context B's name and the RGD list changes to context B's RGDs.

**Acceptance Scenarios**:

1. **Given** a kubeconfig with 3 contexts, **When** the context switcher dropdown is opened, **Then** all 3 contexts are listed with the current one marked as active
2. **Given** the user selects a different context, **When** `POST /api/v1/contexts/switch` succeeds, **Then** the top bar updates and the home page RGD list reloads
3. **Given** the user selects an invalid/unreachable context, **When** the switch fails, **Then** an error toast is shown and the previous context remains active
4. **Given** only one context exists, **When** the dropdown is opened, **Then** the dropdown is shown (not hidden) but the single context is not clickable/selectable as a switch target

---

### User Story 2 — Context name is always visible in the top bar (Priority: P1)

The active kubeconfig context name is always shown in the top bar. Long context names (e.g., EKS ARN strings) are truncated with a tooltip showing the full name.

**Why this priority**: Context visibility prevents the accidental "wrong cluster" mistake.

**Independent Test**: With context `arn:aws:eks:us-west-2:319279230668:cluster/krombat`, confirm the top bar truncates it to something readable (e.g., `…krombat`) with the full ARN in a tooltip.

**Acceptance Scenarios**:

1. **Given** a short context name (`minikube`), **When** displayed, **Then** the full name is shown without truncation
2. **Given** a long context name (EKS ARN, 60+ chars), **When** displayed, **Then** it is truncated with `…` and a tooltip shows the full name on hover
3. **Given** the context changes, **When** displayed, **Then** the new context name is shown immediately after the switch completes

---

### Edge Cases

- What if `POST /api/v1/contexts/switch` takes more than 5 seconds? → Show a loading spinner in the top bar; cancel and show error after 10s.
- What if the kubeconfig has 0 contexts? → Show "No contexts found" in the dropdown.
- What if the new context's cluster is unreachable? → Server returns an error; show toast "Could not connect to cluster: [error]"; revert to previous context.

## Requirements

### Functional Requirements

- **FR-001**: Top bar MUST always show the active kubeconfig context name
- **FR-002**: A context switcher dropdown MUST be accessible from the top bar on all pages
- **FR-003**: The dropdown MUST be populated from `GET /api/v1/contexts`
- **FR-004**: Selecting a context MUST call `POST /api/v1/contexts/switch` with `{"context": "name"}`
- **FR-005**: On successful switch, the home page RGD list MUST reload automatically
- **FR-006**: On failed switch, an error message MUST be shown and the active context MUST remain unchanged
- **FR-007**: Long context names MUST be truncated in the top bar with a full-name tooltip
- **FR-008**: The current context MUST be visually marked in the dropdown (e.g., checkmark or highlight)

### Key Entities

- **ContextSwitcher**: dropdown component in the top bar
- **Context API**: `GET /api/v1/contexts` → `{contexts: [], active: ""}`, `POST /api/v1/contexts/switch`

## Success Criteria

- **SC-001**: Context switch completes (server + UI update) within 3 seconds for a reachable cluster
- **SC-002**: After a successful switch, the RGD list reflects the new cluster's RGDs
- **SC-003**: Long EKS ARN context names are truncated cleanly in the top bar
- **SC-004**: Failed switch shows an error and does not leave the UI in a broken state
