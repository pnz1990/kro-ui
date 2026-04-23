# Spec: issue-713 — Designer: Apply to Cluster Action

## Design reference
- **Design doc**: `docs/design/31-rgd-designer.md`
- **Section**: `§ Future`
- **Implements**: Designer: apply-to-cluster action (🔲 → ✅)

---

## Zone 1 — Obligations

**O1**: A new `POST /api/v1/rgds/apply` endpoint MUST accept a raw YAML body containing a ResourceGraphDefinition and apply it to the cluster via server-side apply (SSA) with field manager `kro-ui`.

**O2**: The endpoint MUST return HTTP 201 when a new RGD was created, HTTP 200 when an existing RGD was updated, HTTP 400 for invalid YAML, HTTP 403 when `canApplyRGDs` is false (not enabled), and HTTP 503 for cluster errors.

**O3**: The `canApplyRGDs` capability flag MUST default to `false` in `Baseline()`. The endpoint MUST check this flag and return 403 with a clear error message when false.

**O4**: The Designer YAML tab MUST show an "Apply to cluster" button when `canApplyRGDs` is true. The button MUST be absent (not just disabled) when the capability is false.

**O5**: The `YAMLPreview` component MUST accept an optional `onApply` callback prop. When provided + `canApplyRGDs` is true, the "Apply to cluster" button is rendered.

**O6**: The apply response MUST include the name of the created/updated RGD so the frontend can link to the detail page.

**O7**: The backend MUST parse the YAML body into an `unstructured.Unstructured` and validate that `apiVersion == kro.run/v1alpha1` and `kind == ResourceGraphDefinition` before applying. Invalid types return HTTP 400.

---

## Zone 2 — Implementer's judgment

- SSA vs create/replace: SSA with field manager `kro-ui` is the correct approach. SSA handles create + update in one call, conflicts are the RGD controller's problem.
- The capability flag is stored in `KroCapabilities.FeatureGates["canApplyRGDs"]`. The backend sets this when the capability is detected (currently always false — a human must explicitly enable it via kro-ui config in a future phase; for now it's false by default so no RGDs can be accidentally applied).
- The Apply button shows a loading state and success/error feedback inline (same pattern as Validate).

---

## Zone 3 — Scoped out

- Automatic detection of write permissions to enable `canApplyRGDs` (future item)
- `kubectl apply` dry-run pre-check before the actual apply (overkill for v1 — ValidateRGD already does static validation)
- Update-in-place RGD editing from the list page
