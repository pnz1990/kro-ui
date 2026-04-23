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
- 🔲 Reliability: Designer apply-to-cluster action (issue #713) is the last major Designer feature gap for donation readiness — a read-only UI that can author RGD YAML but cannot apply it to the cluster requires a kubectl round-trip that breaks the developer flow; add a `POST /api/v1/rgds` endpoint that calls `dynamicClient.Resource(gvr).Create()` with the designer's generated YAML; the UI shows a "Apply to cluster" button on the YAML tab that calls this endpoint; requires updating the RBAC ClusterRole to add `create` verb on `resourcegraphdefinitions`; this is the only planned write path and must be documented explicitly in `vision.md` as an exception to the read-only constraint (date: 2026-04-23)
- 🔲 Onboarding: CEL expression linter (PR #743) covers syntax errors but not semantic errors — a new user writing their first `readyWhen` expression will produce syntactically valid but semantically incorrect CEL (e.g. `status.ready` instead of `status.conditions[0].status == "True"`); add a "CEL examples" expandable section on the readyWhen and includeWhen inputs with 3 copy-paste-ready examples from the kro docs; these are static strings, no API call required; this converts the linter from an error catcher into a learning tool (date: 2026-04-23)
- 🔲 Visibility: Designer has no E2E journey for the CEL linter (issue #744 open) — issue #744 is the pending work item; without E2E coverage a regression in `lintCEL()` or the `CELLintHint` component will pass CI; the journey should assert: (1) invalid CEL expression shows inline error with `role="alert"`, (2) valid CEL expression shows no error, (3) error clears when expression is corrected; should be in chunk-8 or chunk-9 to keep E2E suite parallelism balanced (date: 2026-04-23)
- 🔲 Self-improvement: the optimization advisor threshold (forEach collapse at N resources) is controlled by a feature flag but the feature flag is never tested in CI — a PR that changes `OPTIMIZATION_THRESHOLD` from 3 to 300 would pass all CI checks; add a unit test in `web/src/lib/features.test.ts` that asserts the default threshold value and that the advisor fires at that threshold with the `optimization-candidate` stress fixture; this is a regression guard for the primary catalog insight in kro-ui (date: 2026-04-23)

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

