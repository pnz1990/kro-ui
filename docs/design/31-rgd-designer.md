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
- ✅ Designer: CEL expression linter — `lintCEL(expr, context)` pure-TS function in `web/src/lib/cel-linter.ts` detects unclosed string literals, unclosed `${...}` templates, unclosed brackets, and bare string literals in boolean-result contexts; debounced inline error hint (`CELLintHint` component) rendered below `readyWhen` and `includeWhen` CEL inputs with `--color-status-error` styling and `role="alert"` accessibility; 32 unit tests; zero new dependencies (spec issue-721, 🔲→✅ 2026-04)
- ✅ Designer: apply-to-cluster action — `POST /api/v1/rgds/apply` handler applies a RGD YAML via SSA with field manager `kro-ui`; gated behind `canApplyRGDs` feature gate (default false); handler validates kind + apiVersion before apply; returns 201 on create, 200 on update, 403 when gate disabled, 400 for invalid YAML; `applyRGD()` in `api.ts`; "Apply to cluster" button in YAMLPreview when `onApply` prop is set and `canApplyRGDs` capability is true; 6 unit tests cover all response codes (spec issue-713, 🔲→✅ 2026-04)
- 🔲 Designer apply feedback: post-apply reconciliation status — after clicking "Apply to cluster" (PR #752), the UI shows a toast "Applied successfully" but then goes silent; the operator has no way to know if kro accepted the RGD and started reconciling or if it failed validation post-apply; add a post-apply polling loop (max 30s, 2s interval) that watches the applied RGD's `GraphAccepted` condition and displays the result inline in the YAML Preview tab: "✓ RGD accepted and compiling" or "✗ Compile error: <message>"; this closes the apply→feedback loop that is currently broken — the designer applies but the operator must manually navigate to the detail page to see the result; this is the reliability lens applied to the product feature itself (reliability lens, 2026-04-23)
- 🔲 Designer onboarding: empty-state "what is this?" guidance — when a user visits `/author` for the first time with no draft saved, they see an empty form with no context; add a collapsible "What is an RGD?" banner at the top of the Designer (localStorage key `kro-ui-designer-intro-v1`) that explains in 3 bullet points: (1) an RGD defines a set of Kubernetes resources as a unit; (2) you define a schema (inputs) and resources (outputs); (3) kro manages the lifecycle of all defined resources; link to kro.run/docs; this addresses the onboarding lens: a new kro-ui user visiting the designer today gets a blank form with no explanation of what they're building (onboarding lens, 2026-04-23)
- 🔲 Designer validation error recovery suggestions — the YAML validation panel (PR #273) shows validation errors but does not suggest fixes; when a CEL linter error fires (PR #743) for a known pattern (e.g. `resource.spec.field` without `.?` safe navigation), add a one-line "Did you mean: resource.spec.?field?" suggestion below the error; these suggestions are pattern-matched from a static map of common CEL mistakes in kro (the linter already knows the error type); this is self-improvement applied to the designer surface: the system detects the mistake and should improve the author's understanding, not just report the error (self-improvement lens, 2026-04-23)
- 🔲 Designer schema completeness indicator — the schema field editor (PR #144) allows adding fields but gives no feedback on whether the schema is "complete" relative to the resources that reference it; add a "schema coverage" indicator in the Schema tab that counts: (1) how many resource template fields reference `schema.spec.*` values, (2) how many of those references have a corresponding field defined in the schema; show as "N/M schema fields covered"; if coverage < 100%, highlight the uncovered resource references in the YAML preview with a yellow underline; this is the loop honesty lens applied to the designer: the designer today lets you build an incomplete schema silently — the system knows about the coverage gap but hides it (loop honesty lens, 2026-04-23)

---

## Zone 1 — Obligations
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

