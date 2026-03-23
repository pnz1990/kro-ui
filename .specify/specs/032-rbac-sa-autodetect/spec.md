# Feature Specification: RBAC Service Account Auto-Detection

**Feature Branch**: `032-rbac-sa-autodetect`
**Created**: 2026-03-23
**Status**: In Progress
**Depends on**: `018-rbac-visualizer` (merged — provides the Access tab infrastructure)
**Fixes**: GitHub issues #115, #133
**Constitution ref**: §XIII (no hardcoded config values), §II (Cluster Adaptability),
§III (Read-Only), §XI (API performance budget), §IX (Theme)

---

## Context

The RBAC Access tab (spec `018-rbac-visualizer`) was designed to auto-detect kro's
service account by reading the kro controller Deployment. However, the implementation
contains two bugs:

1. **Hardcoded fallback** (`rbac.go:104`): When Deployment detection fails (wrong
   namespace, RBAC restrictions, or non-standard naming), the code returns
   `("kro-system", "kro", false)` — a hardcoded SA name that violates constitution
   §XIII. The spec itself (spec `018-rbac-visualizer`, Edge Cases) explicitly says
   "MUST NOT hardcode a fallback SA name like `"kro"` — derive only from the cluster."

2. **Opaque display format** (`AccessTab.tsx:104`): The banner shows
   `Checking kro service account: kro/kro` with no explanation that `kro/kro` means
   `namespace/name`. Issue #133 requests this be made human-readable, with clear
   labeling of what each part means.

---

## User Scenarios & Testing

### User Story 1 — SA auto-detected from cluster (Priority: P1)

kro is installed with a standard Deployment. The Access tab detects the SA
automatically and shows it with a clear, human-readable label.

**Acceptance Scenarios**:

1. **Given** kro is installed as a Deployment named `kro-controller-manager` in
   `kro-system`, **When** the Access tab loads, **Then** the banner shows:
   `Namespace: kro-system · Service account: kro-controller-manager` (or equivalent
   human-readable format) with `(auto-detected)` indicator
2. **Given** kro is installed in a custom namespace `kro-prod` with SA `kro-operator`,
   **When** the Access tab loads, **Then** the correct SA `kro-prod/kro-operator`
   is shown — not the hardcoded `kro-system/kro`
3. **Given** auto-detection succeeds, **When** rendered, **Then** `serviceAccountFound`
   is `true` in the API response

---

### User Story 2 — SA detection fails, manual override offered (Priority: P1)

kro's Deployment cannot be found (permissions issue, non-standard naming, not
in the searched namespaces).

**Acceptance Scenarios**:

1. **Given** no matching kro Deployment is found in any namespace, **When** the
   Access tab loads, **Then** the backend returns `serviceAccountFound: false`
   with an **empty** `serviceAccount` string (no hardcoded fallback)
2. **Given** `serviceAccountFound: false`, **When** rendered, **Then** the UI shows:
   "Could not auto-detect kro's service account. Enter it manually:" with a text
   input field (`namespace/name` or two separate fields for namespace and name)
3. **Given** the user types a SA in the manual input and confirms, **When** submitted,
   **Then** the UI re-fetches `GET /api/v1/rgds/{name}/access?saNamespace=kro-prod&saName=kro-operator`
   with the override values, and renders the permission matrix for that SA
4. **Given** a manual SA override is active, **When** rendered, **Then** the banner
   shows `Namespace: kro-prod · Service account: kro-operator (manually specified)`

---

### User Story 3 — SA display format is human-readable (Priority: P2)

The SA format `kro/kro` is replaced with labeled fields (closes issue #133).

**Acceptance Scenarios**:

1. **Given** `serviceAccount` is `"kro-system/kro"`, **When** rendered, **Then**
   the banner shows the namespace and service account name as separately labeled
   elements, not as raw `namespace/name` string
2. **Given** a tooltip or `title` attribute, **Then** the full `namespace/name`
   value is accessible on hover for copy-paste

---

### Edge Cases

- kro Deployment not found due to restricted RBAC for kro-ui itself → show
  "Could not auto-detect" with manual input; never hardcode a guess
- Multiple kro-like Deployments in the cluster → use the first Deployment (in
  namespace priority order) that has a non-empty `serviceAccountName`
- SA override query params are present but malformed → treat as if not present
  (fall back to auto-detect or "not found" state)
- Backend discovery uses only the 2-namespace search (`kro-system`, `kro`) as
  the primary strategy; this is intentional (the kro Helm chart always uses one
  of these two namespaces by default)

---

## Requirements

### Functional Requirements

- **FR-001**: `ResolveKroServiceAccount` MUST return `("", "", false)` when no
  matching Deployment is found — it MUST NOT return any hardcoded namespace or
  name as a fallback
- **FR-002**: `GET /api/v1/rgds/{name}/access` MUST accept optional query parameters
  `saNamespace` and `saName` to allow the frontend to provide a manual SA override
- **FR-003**: When `saNamespace`+`saName` query params are provided and non-empty,
  the handler MUST use them directly (skip auto-detection)
- **FR-004**: When auto-detection fails and no manual override is provided, the
  `AccessResult` MUST have `ServiceAccount = ""` and `ServiceAccountFound = false`
- **FR-005**: The `AccessTab` frontend component MUST detect `serviceAccountFound: false`
  with empty `serviceAccount` and show a manual input form instead of the permission
  matrix
- **FR-006**: The manual input form MUST have two fields: namespace and service
  account name (separate inputs, not a single `namespace/name` string field)
- **FR-007**: On submission of the manual form, the frontend re-fetches the access
  endpoint with `?saNamespace=<ns>&saName=<name>` query params
- **FR-008**: The SA display banner MUST show namespace and name as separately
  labeled elements (not raw `namespace/name` slash format)
- **FR-009**: The detection source MUST be indicated: `(auto-detected)` or
  `(manually specified)`
- **FR-010**: All styles MUST use CSS tokens from `tokens.css`

### Non-Functional Requirements

- **NFR-001**: No hardcoded SA names, namespaces, or SA name guesses anywhere in
  backend or frontend code (constitution §XIII)
- **NFR-002**: TypeScript strict mode MUST pass
- **NFR-003**: Existing unit tests for `CheckPermissions`, `FetchEffectiveRules`,
  `ComputeAccessResult` MUST continue to pass with no modification (they already
  use `kro-system/kro` as fixture values, which is fine — they test the logic, not
  the detection)
- **NFR-004**: New unit test for `ResolveKroServiceAccount` "no deployment found"
  case: MUST return `("", "", false)`

### Key Components Changed

- **`internal/k8s/rbac.go`**: Remove hardcoded fallback from `ResolveKroServiceAccount`;
  return `("", "", false)` when not found
- **`internal/api/handlers/access.go`**: Accept optional `saNamespace` + `saName`
  query params; skip auto-detection when provided; handle empty SA result
- **`web/src/components/AccessTab.tsx`**: Show manual input form when
  `serviceAccountFound: false` and `serviceAccount === ""`; update SA banner format
- **`internal/k8s/rbac_test.go`**: Add test case for "no deployment found" returning
  empty strings
- **`web/src/components/AccessTab.test.tsx`**: Add test cases for manual input form
  and new banner format

---

## Testing Requirements

### Backend Unit Tests

```go
// internal/k8s/rbac_test.go — new test case
{
  name: "no kro deployment found returns empty strings and found=false",
  // setup: no deployments in kro-system or kro namespaces
  // check: ns="", name="", found=false
}
```

### Frontend Tests

```typescript
// web/src/components/AccessTab.test.tsx — new test cases
it('shows manual input form when serviceAccountFound=false and serviceAccount=""')
it('re-fetches with saNamespace and saName params on manual form submit')
it('shows (auto-detected) indicator when serviceAccountFound=true')
it('shows (manually specified) indicator after manual override')
it('shows labeled namespace and SA name, not raw slash format')
```

---

## Success Criteria

- **SC-001**: `ResolveKroServiceAccount` never returns a hardcoded SA name
- **SC-002**: When auto-detect fails, AccessTab shows manual override form
- **SC-003**: Manual override re-fetches with correct query params
- **SC-004**: SA display uses labeled format (not raw `kro/kro`)
- **SC-005**: `go test -race ./...` passes
- **SC-006**: `tsc --noEmit` passes
