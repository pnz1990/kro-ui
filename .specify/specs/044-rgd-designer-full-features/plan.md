# Implementation Plan: 044-rgd-designer-full-features

**Branch**: `044-rgd-designer-full-features` | **Date**: 2026-03-26 | **Spec**: `.specify/specs/044-rgd-designer-full-features/spec.md`
**Input**: GH Issue #270 — RGD Designer feature parity, full kro feature coverage

---

## Summary

The RGD Designer at `/author` currently covers only ~20% of kro's feature
surface: flat metadata, scalar spec fields, and resource templates with empty
`spec: {}` bodies. This spec closes all critical and high-severity gaps by
extending `RGDAuthoringState`, `generateRGDYAML`, `rgdAuthoringStateToSpec`,
and `RGDAuthoringForm` to support: resource template body editing, `status`
fields with CEL expressions, `includeWhen`/`readyWhen` conditionals, `forEach`
collections, `externalRef` (scalar + collection), `scope: Cluster`, and spec
field validation constraints.

No backend changes. No new npm or Go dependencies.

---

## Technical Context

**Language/Version**: TypeScript 5.x + React 19 + Vite (frontend only)
**Primary Dependencies**: React 19, react-router-dom v7, Vite — no new deps
**Storage**: N/A — all state is local React `useState`
**Testing**: Vitest + @testing-library/react
**Target Platform**: Browser (WebApp embedded in Go binary)
**Project Type**: Web application — frontend-only spec
**Performance Goals**: Form → YAML preview round-trip < 16ms (synchronous after debounce)
**Constraints**: No new npm dependencies; no hardcoded hex/rgba; TypeScript strict 0 errors
**Scale/Scope**: Single page form; no scale concerns — purely local state

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|---|---|---|
| §II Cluster Adaptability — upstream kro only | ✅ PASS | No fork-only fields; all new features (`forEach`, `externalRef`, `readyWhen`, `includeWhen`, `scope`) are in upstream kro docs |
| §III Read-Only — no mutating API calls | ✅ PASS | Designer is purely client-side; no API calls at all |
| §V Simplicity — no new dependencies | ✅ PASS | Template body is raw `<textarea>` passthrough; no YAML parser needed |
| §IX Theme — no hardcoded colors | ✅ PASS | All CSS uses `tokens.css` custom properties |
| §XIII UX Standards — keyboard accessible | ✅ PASS | All form controls use native HTML elements (keyboard-accessible by default) |
| §XII Graceful degradation | ✅ PASS | Template parse failure → DAG falls back to `template:{}`, no crash |

No violations. No complexity tracking required.

---

## Project Structure

### Documentation (this feature)

```text
specs/044-rgd-designer-full-features/
├── plan.md              # This file
├── research.md          # ✅ Phase 0 complete
├── data-model.md        # ✅ Phase 1 complete
├── quickstart.md        # ✅ Phase 1 complete
├── contracts/
│   └── ui-contracts.md  # ✅ Phase 1 complete
└── tasks.md             # Phase 2 (run /speckit.tasks)
```

### Source Code (affected files only)

```text
web/src/lib/generator.ts                    # Type extensions + function extensions
web/src/components/RGDAuthoringForm.tsx     # Form extensions
web/src/components/RGDAuthoringForm.css     # CSS for new form sections
web/src/lib/generator.test.ts               # New test cases
web/src/components/RGDAuthoringForm.test.tsx # New test cases (if exists)
web/src/pages/AuthorPage.tsx                # No changes expected
```

No new files required. All changes to existing files.

---

## Phase 0: Research

**Status**: ✅ Complete — see `research.md`

Key decisions resolved:
1. Template body: raw `<textarea>` passthrough (no YAML parser — none available without new dep)
2. CEL inputs: plain `<input type="text">` with monospace font + `CEL` badge (no overlay highlighting)
3. Resource type: three-way `<select>` — "Managed" / "Collection (forEach)" / "External ref"
4. forEach: `forEachIterators: { _key, variable, expression }[]`
5. externalRef: "By name" vs "By selector" radio within externalRef mode
6. Template YAML → DAG: pass as `template._raw` string for `walkTemplate` string extraction
7. `scope` toggle: radio in Metadata section
8. Status fields: new section below Spec Fields, `(name, expression)` rows

---

## Phase 1: Design

**Status**: ✅ Complete

### data-model.md
Extended entities:
- `AuthoringField` + constraints (`enum`, `min`, `max`, `pattern`)
- `AuthoringStatusField` (new): `{ id, name, expression }`
- `ForEachIterator` (new): `{ _key, variable, expression }`
- `AuthoringExternalRef` (new): `{ apiVersion, kind, namespace, name, selectorLabels }`
- `AuthoringResource` extended: `resourceType`, `templateYaml`, `includeWhen`, `readyWhen`, `forEachIterators`, `externalRef`
- `RGDAuthoringState` extended: `scope`, `statusFields`

Pure functions extended:
- `buildSimpleSchemaStr` — appends constraint modifiers
- `rgdAuthoringStateToSpec` — maps new resource types to DAG-compatible spec shape
- `generateRGDYAML` — serializes all new fields

### contracts/ui-contracts.md
- `RGDAuthoringForm` layout diagram with new sections
- `data-testid` contracts for all new elements
- YAML output contracts (what each mode produces)
- DAG node type contracts

### quickstart.md
- Dev server setup
- Implementation order (7 steps, always-buildable)
- Acceptance checklist

---

## Re-check: Constitution Check post-design

All gates still pass. No new patterns introduced that would violate constitution:
- All CSS token references identified in contracts
- No new React context or state management libraries
- Template body is gracefully degraded (no crash on invalid YAML)
- All 5 upstream kro node types are covered — no fork-only concepts
