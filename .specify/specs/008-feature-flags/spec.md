# Feature Specification: Feature Flag System

**Spec**: `008-feature-flags`
**Created**: 2026-03-20
**Status**: Draft
**Depends on**: `001-server-core` (merged)
**Constitution ref**: §II (Cluster Adaptability — kro evolves rapidly)

---

## Context

kro is evolving rapidly. New features land in upstream `kubernetes-sigs/kro`
frequently, some behind feature gates. The kro-ui must:

1. **Support only upstream features by default** — no fork-specific concepts
2. **Adapt to what the connected cluster actually has** — discover which kro
   version and feature gates are active via the API server, not hardcoding
3. **Allow experimentation** — provide a clean way to enable upcoming/alpha
   features without shipping broken UI to users with older kro versions
4. **Never break on unknown data** — if a future kro version adds a new field,
   kro-ui renders it gracefully rather than crashing

---

## The problem in concrete terms

### Upstream alpha features (off by default in kro)

From `pkg/features/features.go` in kro `v1alpha1`:

| Feature gate | Description | Default |
|---|---|---|
| `CELOmitFunction` | Enables `omit()` CEL function in templates | Alpha, **off** |
| `InstanceConditionEvents` | Emits K8s Events on condition transitions | Alpha, **off** |

If a user's cluster has `--feature-gates=CELOmitFunction=true`, kro-ui should
highlight `omit()` calls in the CEL highlighter. If not, `omit()` is just plain text.

### Upcoming features (not yet in upstream)

The following concepts are either in design proposals or in forks and may land
in a future kro release. kro-ui needs to be able to add UI support for them
**without a full rewrite**:

| Concept | Current status | Expected in |
|---|---|---|
| `GraphRevision` CRD | Not in upstream | Possibly kro v0.10+ |
| `spec.schema.types` custom type reuse | In upstream `v1alpha1` | Already present |
| `spec.schema.scope = "Cluster"` | In upstream `v1alpha1` | Already present |
| Cluster-scoped instance support | In upstream `v1alpha1` | Already present |
| Additional CEL libraries (`lists`, `Quantity`) | Merged March 2026 | Present in latest |

### Fork features (NOT upstream, must not be enabled by default)

| Concept | Status |
|---|---|
| `specPatch` / state nodes | Fork-only, not in `kubernetes-sigs/kro` |
| `stateFields` | Fork-only |

---

## Design: three-layer feature system

### Layer 1: Server-side kro version detection

The Go server detects what the connected kro installation supports by querying
the API server. This is the ground truth — no manual configuration needed.

```
GET /api/v1/kro/capabilities
→ {
    "version": "0.9.1",
    "apiVersion": "kro.run/v1alpha1",
    "featureGates": {
      "CELOmitFunction": false,
      "InstanceConditionEvents": false
    },
    "knownResources": ["resourcegraphdefinitions"],
    "schema": {
      "hasForEach": true,
      "hasExternalRef": true,
      "hasExternalRefSelector": true,
      "hasScope": true,
      "hasTypes": true
    }
  }
```

Detection mechanism (in priority order):
1. Query the kro controller's `--feature-gates` via the kro leader-election
   ConfigMap annotations (if present)
2. Check `kro.run/v1alpha1` CRD annotations for capability markers
3. Introspect the RGD CRD's OpenAPI schema to detect known fields
4. Fall back to conservative baseline: only features confirmed in `v1alpha1`
   schema are enabled

### Layer 2: Frontend feature flags (derived from capabilities)

The frontend receives the capabilities object and uses it to gate UI features:

```typescript
// web/src/lib/features.ts
interface KroCapabilities {
  version: string
  featureGates: {
    CELOmitFunction: boolean
    InstanceConditionEvents: boolean
    [key: string]: boolean  // forward-compatible: unknown gates are ignored
  }
  schema: {
    hasForEach: boolean
    hasExternalRef: boolean
    hasExternalRefSelector: boolean
    hasScope: boolean
    hasTypes: boolean
  }
}

// Usage in components:
const { capabilities } = useCapabilities()
if (capabilities.featureGates.CELOmitFunction) {
  // highlight omit() in CEL expressions
}
```

### Layer 3: Experimental features (opt-in, clearly labelled)

A `?experimental=true` query parameter (or a dev-only toggle in the settings
panel) enables rendering of features that are not yet in upstream kro but are
under active development. These are:

- Clearly labelled with an "⚗ Experimental" badge in the UI
- Off by default in production
- Documented in this spec with their expected upstream landing version

This layer is for **kro contributors and early adopters** who are testing
features on dev clusters with unofficial patches.

---

## User Scenarios & Testing

### User Story 1 — Server reports capabilities of connected kro (Priority: P1)

The Go server probes the connected cluster and reports what kro features are
available. The frontend uses this to gate UI features.

**Acceptance Scenarios**:

1. **Given** a cluster with kro `v1alpha1` and no feature gates enabled, **When**
   `GET /api/v1/kro/capabilities` is called, **Then** it returns `CELOmitFunction: false`,
   `hasForEach: true`, `hasExternalRef: true`
2. **Given** a cluster where kro was started with `--feature-gates=CELOmitFunction=true`,
   **When** capabilities are requested, **Then** it returns `CELOmitFunction: true`
3. **Given** a future kro version that adds a `GraphRevision` CRD, **When**
   capabilities are requested, **Then** `knownResources` includes `"graphrevisions"`
   and the frontend can enable the GraphRevision tab without any code change

---

### User Story 2 — CEL highlighter respects omit() feature gate (Priority: P2)

When `CELOmitFunction=false` (default), `omit()` is plain text in the
highlighter. When `CELOmitFunction=true`, it is highlighted as a kro keyword.

**Acceptance Scenarios**:

1. **Given** `CELOmitFunction=false`, **When** YAML containing `omit(field)` is
   rendered, **Then** `omit` appears as plain YAML text, not highlighted
2. **Given** `CELOmitFunction=true`, **When** the same YAML is rendered, **Then**
   `omit` is highlighted as `--hl-kro-keyword`

---

### User Story 3 — GraphRevision tab appears automatically when CRD exists (Priority: P3)

When the connected cluster has a `GraphRevision` CRD (a future kro feature),
the RGD detail page automatically shows a "Revisions" tab showing the
GraphRevision list. No code change required.

**Acceptance Scenarios**:

1. **Given** a cluster without `GraphRevision` CRD, **When** `GET /api/v1/kro/capabilities`
   is called, **Then** `"graphrevisions"` is absent from `knownResources`, and
   the Revisions tab is not rendered
2. **Given** a cluster with `GraphRevision` CRD installed, **When** capabilities
   are requested, **Then** `"graphrevisions"` appears in `knownResources`, and
   the Revisions tab is rendered with the list fetched from the dynamic client

---

## Requirements

### Functional Requirements

- **FR-001**: `GET /api/v1/kro/capabilities` MUST return the capabilities object
  within 2 seconds; use a 30-second cache (capabilities don't change often)
- **FR-002**: Capabilities detection MUST use server-side API server discovery —
  no version string parsing, no hardcoded version comparisons
- **FR-003**: Unknown feature gates in `featureGates` MUST be ignored by the
  frontend (forward-compatible)
- **FR-004**: `specPatch` and `stateFields` MUST never appear as enabled
  capabilities — they are not upstream features
- **FR-005**: The `hasForEach`, `hasExternalRef`, `hasExternalRefSelector` fields
  MUST be detected by inspecting the `resourcegraphdefinitions` CRD OpenAPI schema
  for the presence of those field paths
- **FR-006**: The frontend `useCapabilities()` hook MUST fetch from
  `GET /api/v1/kro/capabilities` on mount with a 30-second stale-while-revalidate
  strategy; all components that need capabilities consume this hook
- **FR-007**: If capabilities endpoint fails (old kro version, no CRD), fall back
  to a conservative baseline that enables only universally-available features
  (`hasForEach: true`, `hasExternalRef: true`, all feature gates `false`)
- **FR-008**: The `?experimental=true` query parameter enables experimental UI
  features that are labelled with "⚗ Experimental" badges

### Key Entities

| File | Contents |
|------|----------|
| `internal/api/handlers/capabilities.go` | `GetCapabilities` handler |
| `internal/k8s/capabilities.go` | Capability detection logic |
| `web/src/lib/features.ts` | `KroCapabilities` type + `useCapabilities()` hook |
| `web/src/lib/featureBaseline.ts` | Conservative fallback baseline |

---

## E2E User Journey

**File**: `test/e2e/journeys/008-feature-flags.spec.ts`

```
Step 1: Capabilities endpoint returns expected baseline
  - HTTP GET /api/v1/kro/capabilities
  - Assert: status 200
  - Assert: body.schema.hasForEach === true
  - Assert: body.schema.hasExternalRef === true
  - Assert: body.featureGates.CELOmitFunction === false (default in kind cluster)
  - Assert: body.knownResources contains "resourcegraphdefinitions"

Step 2: Frontend shows ExternalRef node type (capabilities-gated)
  - Navigate to /rgds/test-app (test fixture has no externalRef)
  - Confirm no ExternalRef nodes are present — normal behavior
  - (ExternalRef node rendering tested in spec 003 unit tests with mock data)
```

---

## Success Criteria

- **SC-001**: `GET /api/v1/kro/capabilities` returns within 2s for the E2E kind cluster
- **SC-002**: `specPatch` is never listed as a capability
- **SC-003**: Frontend renders `NodeTypeCollection` (forEach) when `hasForEach: true`
- **SC-004**: CEL highlighter highlights `omit()` only when `CELOmitFunction: true`
- **SC-005**: Adding a new CRD to the cluster causes `knownResources` to include
  it on the next capabilities fetch (no server restart needed)
