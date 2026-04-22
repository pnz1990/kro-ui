# 31 — RGD Designer

> Status: Active | Created: 2026-04-20
> Applies to: pnz1990/kro-ui

---

## What the RGD Designer covers

The RGD Designer is the authoring surface for creating and editing ResourceGroupDefinitions:
the /author route, the generate form, YAML preview, CEL/schema editing, validation, and the
optimization advisor. It is the primary tool for developers creating new kro workloads.

---

## Present (✅)

- ✅ RGD YAML generator: instance form, batch mode, YAML preview (PR #144, 2026-04)
- ✅ Generate form polish: required field indicator, aria-required (PR #144, 2026-04)
- ✅ RGD Designer nav: /author promoted to nav, New RGD mode removed, live DAG preview (PR #206, 2026-04)
- ✅ Global /author route + New RGD top bar entrypoint (PR #181, 2026-04)
- ✅ RGD Designer full feature coverage: all 5 node types, includeWhen, readyWhen CEL, schema field editor (PR #144, 2026-04)
- ✅ RGD Designer YAML validation, editable YAML panel, expanded optimization advisor (PR #273, 2026-04)
- ✅ forEach collapse suggestions in catalog (optimization advisor) (PR #78, 2026-04)
- ✅ CEL highlighter: pure TS kro CEL/schema tokenizer (PR #34, 2026-04)
- ✅ RGD validation linting: surface validation conditions in the UI (PR #50, 2026-04)
- ✅ Designer: import existing RGD from cluster (load from live cluster → editable form) (issue #542, 2026-04)
- ✅ E2E journey for Designer cluster import panel: Playwright journey 082 covers toggle open, RGD list population, select + Load, form state replacement (issue #619, 2026-04)

## Future (🔲)

- ✅ Designer: node library — click-to-add from common resource templates (NodeLibrary component, GH #543)
- ✅ Designer: collaboration mode — share designer URL with readonly view (DesignerShareButton + DesignerReadonlyBanner, GH #544)
- ✅ Designer axe-core coverage: journey 074 Step 7 runs WCAG 2.1 AA blocking axe-core assertion on `/author`; tab bar (role=tablist/tab, aria-selected), form inputs, and interactive elements are all in scope; SVG excluded as complex widget; upgraded from non-blocking to blocking in PR #689 (issue #683, 2026-04)
- ✅ Designer: `localStorage` persistence of in-progress RGD draft — auto-save (debounced 2s) to `kro-ui-designer-draft` key; "Restore draft?" banner on next visit with Restore/Discard actions; disabled in readonly/shared-URL mode (PR #647, 2026-04)
- ✅ Designer tab focus restoration: tab bar with Schema/Resources/YAML/Preview tabs; active tab and selected DAG node persisted to `sessionStorage` (`kro-ui-designer-tab-state`) so navigating away and returning restores last working context; readonly/shared-URL mode is excluded from persistence (issue #684, 2026-04)
- 🔲 Designer: CEL expression linter — inline error highlighting and suggestion overlay for CEL expressions in readyWhen/includeWhen fields; uses the existing pure-TS CEL tokenizer (`@/lib/highlighter.ts`) to detect unmatched brackets, unresolved field references (checked against the current schema), and unsupported kro CEL functions; shows inline squiggle underlines with hover tooltip; no new runtime CEL evaluator — static analysis only; consistent with Zone 1 O2 requirement that CEL MUST use the kro-specific tokenizer (issue #721)
- 🔲 Designer: apply-to-cluster action — "Apply to cluster" button in the Designer YAML panel that POSTs the current RGD YAML to a new backend endpoint `POST /api/v1/rgds` which calls `dynamic.Resource(gvr).Apply(ctx, ...)`; guarded by a confirmation dialog showing the target cluster context and namespace; response shows the applied resource's UID, resourceVersion, and any validation errors from the kube-apiserver; only active when the cluster supports RGD creation (kro capabilities check); operator must have create/update RBAC for the kro.run group (issue #713)

---

## Zone 1 — Obligations

**O1**: Designer MUST validate RGD YAML before showing an apply/export button — invalid YAML must block submission.
**O2**: CEL expressions MUST be highlighted with the kro-specific tokenizer — not generic YAML highlighting.
**O3**: The live DAG preview MUST update within 2s of schema changes without a page reload.

---

## Zone 2 — Implementer's judgment

- YAML editor: CodeMirror with kro CEL extension is the established choice; do not replace without benchmarking.
- Optimization advisor: suggestion thresholds (e.g. forEach collapse at N resources) are configurable via feature flags.

---

## Zone 3 — Scoped out

- Server-side RGD template storage (browser-local only for now)
- AI-assisted YAML generation (deferred — no LLM integration in kro-ui)

