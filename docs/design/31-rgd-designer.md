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
- 🔲 Designer axe-core coverage: the `/author` page is not included in journey 074 axe-core scan; the authoring form has many interactive elements (dropdowns, text inputs, toggle buttons, CEL editor) that could have WCAG violations; add axe-core assertion for the Designer in the accessibility journey; referenced in 30-health-system.md §Accessibility audit expansion but needs explicit Designer ownership here
- 🔲 Designer: `localStorage` persistence of in-progress RGD draft — currently closing or navigating away from `/author` silently discards all edits; add `localStorage` auto-save (debounced 2s) and a "Restore draft?" prompt on next visit; a kubernetes-sigs reviewer testing the Designer would lose their work on any accidental navigation and conclude the feature is not production-ready
- 🔲 Designer tab focus restoration: navigating away from `/author` and returning resets the active tab to the first tab (Schema); React Router remounts the AuthorPage component on navigation, discarding which resource node was selected and which tab (Schema/Resources/YAML/Preview) was active; persist the active tab and selected node to `sessionStorage` so returning to `/author` within the same browser session restores the last working context; the developer anchor journey (073) exercises this path and the UX interruption would be flagged in any UX review

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

