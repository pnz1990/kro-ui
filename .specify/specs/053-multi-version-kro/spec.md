# Feature Specification: Multi-Version kro Support

**Feature Branch**: `053-multi-version-kro`
**Created**: 2026-03-28
**Status**: Merged (PR #322)

---

## Context

kro-ui is a multi-cluster dashboard. Different clusters may run different kro versions:
- Cluster A: kro v0.8.5 (current)
- Cluster B: kro v0.9.0 (new features)
- Cluster C: kro v1.0.0 (hypothetical future)

This creates three challenges:

1. **Feature availability**: kro v0.9.0 introduced GraphRevision, cluster-scoped RGDs,
   CEL comprehensions, `omit()`. kro v0.8.x has none of these. The UI must gate
   these features cleanly and show clear messaging when connecting to older kro versions.

2. **Minimum supported version**: We need a declared baseline. Any kro version
   below the minimum should show a clear "unsupported kro version" warning rather
   than silently failing or showing broken UI.

3. **Version-aware documentation**: When a user hovers over a feature that's
   unavailable, the tooltip should say "requires kro v0.9.0+" not just be absent.

---

## Design

### Minimum Supported Version

Declare `MINIMUM_KRO_VERSION = "0.8.0"` as a constant in the capabilities layer.
Any cluster running kro < 0.8.0 shows a yellow banner:
"kro v0.X.Y is below the minimum supported version (v0.8.0). Some features
may not work correctly. Upgrade kro to v0.8.0+ for full support."

Rationale for v0.8.0 baseline:
- `kro.run/node-id` labels (our state map key) were introduced in v0.8.0
- forEach collections require v0.7.0+
- v0.6.x and earlier have fundamentally different schema structures

### Version-gated feature table

| Feature | Min version | Gate in capabilities |
|---------|-------------|---------------------|
| forEach collections | v0.7.0 | `hasForEach` (already exists) |
| External refs | v0.7.0 | `hasExternalRef` (already exists) |
| `kro.run/node-id` labels | v0.8.0 | minimum baseline |
| Cluster-scoped RGDs | v0.9.0 | `hasScope` (already exists) |
| GraphRevision CRD | v0.9.0 | `hasGraphRevisions` (already exists) |
| CEL `omit()` function | v0.9.0+ | `hasCELOmitFunction` (already exists) |
| ExternalRef selector | v0.9.0+ | `hasExternalRefSelector` (already exists) |

The capabilities system already detects most of these. What's missing:
1. The minimum version enforcement and warning banner
2. Version-aware tooltips on gated features
3. A `parseKroVersion()` utility and version comparison function

### Implementation

**Backend** (`internal/k8s/capabilities.go`):
- Add `const MinSupportedKroVersion = "0.8.0"`
- Add `IsVersionSupported(v string) bool` — semver comparison
- Add `VersionWarning(v string) string` — returns human-readable warning or ""
- `KroCapabilities.IsSupported bool` — populated by `IsVersionSupported(Version)`

**Frontend** (`web/src/lib/features.ts`):
- `useKroVersionWarning()` hook — returns null or a warning string
- Version comparison utility: `compareKroVersions(a, b string): number`
- `getFeatureMinVersion(gate: string): string` — returns min version string

**UI surfaces**:
- Global banner in `Layout.tsx` when `isSupported === false`
- Capability gate tooltips: "Requires kro v0.9.0+ — connected cluster is v0.8.5"
- Fleet cluster cards: version badge colored based on support status

---

## Success Criteria

- Connecting to a kro v0.7.x cluster shows the unsupported version banner
- kro v0.8.x cluster shows no banner (supported)
- kro v0.9.x cluster shows no banner and all features available
- Tooltips on gated features show the required version
- The `isSupported` field is present in all capabilities responses
- Version parsing handles all known formats: "v0.8.5", "0.8.5", "v1.0.0-rc.1"
