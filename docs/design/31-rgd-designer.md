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

## Present (✅) — continued

- ✅ Designer: node library — click-to-add from common resource templates (NodeLibrary component, GH #543, PR #641)
- ✅ Designer: collaboration mode — share designer URL with readonly view (DesignerShareButton + DesignerReadonlyBanner, GH #544, PR #642)
- ✅ Designer axe-core coverage: journey 074 Step 7 WCAG 2.1 AA blocking assertion on `/author`; upgraded to blocking in PR #689 (issue #683, 2026-04)
- ✅ Designer: `localStorage` draft persistence — auto-save (debounced 2s) to `kro-ui-designer-draft`; "Restore draft?" banner; disabled in readonly mode (PR #654, 2026-04)
- ✅ Designer tab focus restoration: `sessionStorage` persistence of active tab + selected DAG node (`kro-ui-designer-tab-state`); readonly/shared-URL mode excluded (PR #688, issue #684, 2026-04)
- ✅ Designer: import existing RGD from cluster (load from live cluster → editable form, issue #542, PR #641)

## Future (🔲)

- 🔲 Designer: apply-to-cluster action — the Designer generates YAML for manual `kubectl apply`; a user already authenticated (kubeconfig loaded, kro-ui running) must context-switch to a terminal to apply; add an "Apply to cluster" button in the Designer YAML preview that POSTs the generated RGD YAML to a new `POST /api/v1/rgds` endpoint; the backend uses the dynamic client server-side apply with field manager `kro-ui`; the endpoint MUST validate against the RGD CRD schema before applying and return structured errors; this is the only mutating API kro-ui would ever have — explicitly gated behind a `canApplyRGDs` capability flag that defaults to false; this design item ensures the architecture decision (SSA vs create/replace, error surface, capability gate) is reviewed before any implementation starts
- 🔲 Designer: CEL expression linter — when a user types a CEL expression in `readyWhen` or `includeWhen` fields, the tokenizer highlights syntax but does not validate semantics; a typo like `self.spec.replicas > "3"` (comparing int to string) is silently accepted; add a client-side CEL linter that runs after debounce and surfaces type errors and undefined references using the RGD schema as the type context; must not require a server round-trip; the existing `KroCodeBlock` tokenizer (`web/src/lib/highlighter.ts`) is the foundation — extend it with a type-checking pass

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

