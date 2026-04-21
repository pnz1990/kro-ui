# spec: Designer — Import existing RGD from cluster

> Issue: #542  
> Branch: feat/issue-542  
> Design ref: docs/design/31-rgd-designer.md § Future

---

## Design reference

- **Design doc**: `docs/design/31-rgd-designer.md`
- **Section**: `§ Future`
- **Implements**: Designer: import existing RGD from cluster (load from live cluster → editable form) (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**FR-001**: A "Load from Cluster" section MUST appear in the RGD Designer at `/author`, rendered above the existing "Import YAML" panel.

**FR-002**: The section MUST present a dropdown populated with the names of all RGDs currently live on the connected cluster (from `GET /api/v1/rgds`).

**FR-003**: After the user selects an RGD name and clicks "Load", the backend's raw RGD YAML MUST be fetched and parsed via the existing `parseRGDYAML()` function. On success the form state MUST be replaced (same contract as `YAMLImportPanel`'s `onImport`).

**FR-004**: If the cluster returns an error (network, non-200, no RGDs) the section MUST display an inline error message (not crash the page). The authoring form state MUST NOT change on error.

**FR-005**: If no RGDs exist on the cluster the dropdown MUST be empty and a "No RGDs found" message MUST be visible instead of a load button.

**FR-006**: The Load button MUST be disabled (and show a loading spinner or disabled state) while a fetch is in-flight to prevent double-submission.

**FR-007**: The component MUST NOT call `listRGDs` on mount — it MUST only fetch on an explicit user action (click on a toggle/expand button that reveals the panel).

**FR-008**: `document.title` is managed by `AuthorPage` (unchanged); this component does not set the page title.

**FR-009**: The component MUST use only CSS custom property tokens from `tokens.css` — no hardcoded hex, rgba, or Tailwind classes.

**FR-010**: The component MUST be keyboard-accessible: dropdown and Load button reachable via Tab, Load triggerable via Enter/Space.

---

## Zone 2 — Implementer's judgment

- Collapsible header pattern (expand/collapse) follows `YAMLImportPanel` conventions — reuse the same CSS class naming convention.
- The RGD YAML is already available via `GET /api/v1/rgds/{name}` returning a raw K8sObject; convert it to YAML string with the existing `toYaml()` helper from `@/lib/yaml`, then call `parseRGDYAML()`.
- Decide whether to list RGDs eagerly on expand or via a "Refresh" button inside the expanded panel (either is acceptable; eager is simpler).
- Spinner state can be a simple `loading` boolean with CSS `opacity: 0.6` — no separate spinner component needed.

---

## Zone 3 — Scoped out

- No server-side caching of fetched RGD YAML (use existing API TTL cache on backend).
- No multi-cluster support in this PR (single active context only).
- No diff/preview of imported YAML before applying.
- No undo after import (browser back button / new session clears state as before).
