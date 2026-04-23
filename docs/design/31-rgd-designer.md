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

- 🔲 31.1 — Designer onboarding guided tour: a new user arriving at `/author` for the first time (detected via `localStorage` key `kro-ui-designer-toured`) sees a 4-step overlay tour: (1) schema field editor, (2) resource node types, (3) YAML preview + live DAG, (4) Apply to cluster; each step highlights the relevant UI region via a semi-transparent overlay; tour can be dismissed at any step and re-triggered via a "?" button; this directly addresses the onboarding gap (pressure lens 4): a new contributor reviewing kro-ui as a donation candidate needs to discover the Designer without prior context — the tour makes the feature self-documenting; no new dependencies (uses existing portal tooltip pattern)
- 🔲 31.5 — Designer discoverability from README: a kro user or donation reviewer arriving at the GitHub repo today cannot discover the Designer without reading AGENTS.md or navigating the running UI; the README does not mention `/author`, the Generate tab, or CEL expression authoring; add a "Designer" section to the README with a screenshot (or animated GIF) showing the Designer workflow: schema field editor → YAML preview → Apply to cluster; this is the "onboarding good enough?" gap applied to the most distinctive kro-ui feature — if the Designer is not visible in the first-glance README scan, a donation reviewer may not realize it exists
- 🔲 31.2 — Designer: multi-step undo/redo: the current Designer has no undo mechanism; a user who accidentally deletes a resource node or clears the schema has no recovery path other than the `localStorage` draft restore; add `useDesignerHistory` hook that maintains a stack of up to 20 serialized designer states; Ctrl+Z / Ctrl+Y / ⌘+Z / ⌘+Y bindings; undo/redo buttons in the Designer toolbar with disabled state at stack boundaries; `aria-label="Undo (Ctrl+Z)"` / `aria-label="Redo"`; stack is session-local (not persisted); this is the most frequently requested designer feature by users who have tried to author complex RGDs
- 🔲 31.3 — Designer frame-lock diagnostic: the Designer's optimization advisor currently detects forEach patterns and scope issues, but it does not detect when the designer form state is internally inconsistent in a way that CEL validation would miss (e.g. a resource node references a schema field that no longer exists after an edit); add a `validateDesignerConsistency()` check that runs on each form state change and surfaces a non-blocking "N consistency warnings" banner linking to a detail panel; this is a frame-lock prevention mechanism specific to the Designer: the authoring agent (the human) may not notice a reference became stale after an edit, and no existing check catches it
- 🔲 31.4 — Loop honesty: Designer feature predictions have been over-optimistic — PRs #713, #744, #684 all required multiple follow-up PRs (E2E journey after main feature, a11y fix after feature, tab-state persistence after navigation); add a Zone 1 obligation to this doc: every Designer Present item MUST be accompanied by (1) a journey test reference and (2) an axe-core assertion on the affected UI surface, before it is promoted from 🔲 to ✅; this ensures "designed, validated, tested" rather than "implemented, CI-passed, shipped"
- ✅ Designer: node library — click-to-add from common resource templates (NodeLibrary component, GH #543)
- ✅ Designer: collaboration mode — share designer URL with readonly view (DesignerShareButton + DesignerReadonlyBanner, GH #544)
- ✅ Designer axe-core coverage: journey 074 Step 7 runs WCAG 2.1 AA blocking axe-core assertion on `/author`; tab bar (role=tablist/tab, aria-selected), form inputs, and interactive elements are all in scope; SVG excluded as complex widget; upgraded from non-blocking to blocking in PR #689 (issue #683, 2026-04)
- ✅ Designer: `localStorage` persistence of in-progress RGD draft — auto-save (debounced 2s) to `kro-ui-designer-draft` key; "Restore draft?" banner on next visit with Restore/Discard actions; disabled in readonly/shared-URL mode (PR #647, 2026-04)
- ✅ Designer tab focus restoration: tab bar with Schema/Resources/YAML/Preview tabs; active tab and selected DAG node persisted to `sessionStorage` (`kro-ui-designer-tab-state`) so navigating away and returning restores last working context; readonly/shared-URL mode is excluded from persistence (issue #684, 2026-04)
- ✅ Designer: CEL expression linter — `lintCEL(expr, context)` pure-TS function in `web/src/lib/cel-linter.ts` detects unclosed string literals, unclosed `${...}` templates, unclosed brackets, and bare string literals in boolean-result contexts; debounced inline error hint (`CELLintHint` component) rendered below `readyWhen` and `includeWhen` CEL inputs with `--color-status-error` styling and `role="alert"` accessibility; 32 unit tests; zero new dependencies (spec issue-721, 🔲→✅ 2026-04)
- ✅ Designer: apply-to-cluster action — `POST /api/v1/rgds/apply` handler applies a RGD YAML via SSA with field manager `kro-ui`; gated behind `canApplyRGDs` feature gate (default false); handler validates kind + apiVersion before apply; returns 201 on create, 200 on update, 403 when gate disabled, 400 for invalid YAML; `applyRGD()` in `api.ts`; "Apply to cluster" button in YAMLPreview when `onApply` prop is set and `canApplyRGDs` capability is true; 6 unit tests cover all response codes (spec issue-713, 🔲→✅ 2026-04)

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

