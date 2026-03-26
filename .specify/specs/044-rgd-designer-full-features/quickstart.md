# Quickstart: 044-rgd-designer-full-features

**Branch**: `044-rgd-designer-full-features`
**Date**: 2026-03-26

---

## Prerequisites

- Worktree at `~/Projects/kro-ui.044-rgd-designer-full-features` (already created)
- Frontend deps already installed via wt post-create hook
- Run from the worktree root

```bash
cd ~/Projects/kro-ui.044-rgd-designer-full-features
```

---

## Dev server

```bash
make web   # starts Vite dev server on port 5173 (hot reload)
```

Navigate to `http://localhost:5173/author` to see the RGD Designer.

---

## TypeScript typecheck

```bash
cd web && bunx tsc --noEmit
```

Run after every significant change. Must pass with 0 errors before committing.

---

## Unit tests

```bash
cd web && bunx vitest run
```

Or in watch mode:
```bash
cd web && bunx vitest
```

Key test files for this spec:
- `web/src/lib/generator.test.ts` — extend to cover new fields
- `web/src/components/RGDAuthoringForm.test.tsx` — extend to cover new form sections

---

## Go build (pre-commit gate)

```bash
make go    # go vet + go test -race + go build
```

This spec has no backend changes — only run to confirm no regressions.

---

## Implementation order

Follow this order to keep the codebase always-buildable between commits:

### Step 1 — Extend TypeScript types (generator.ts)

1. Add `ForEachIterator`, `AuthoringExternalRef`, `AuthoringStatusField` interfaces
2. Extend `AuthoringField` with optional constraint fields
3. Extend `AuthoringResource` with new fields, preserve backwards-compat defaults
4. Extend `RGDAuthoringState` with `scope` and `statusFields`
5. Update `STARTER_RGD_STATE` with new default values
6. Extend `buildSimpleSchemaStr` for constraint fields
7. Extend `rgdAuthoringStateToSpec` for forEach, externalRef, includeWhen, readyWhen
8. Extend `generateRGDYAML` for all new YAML fields

Run `tsc --noEmit` and `vitest run` — all existing tests must still pass.

### Step 2 — Form: scope toggle and status fields section

1. Add Scope radio to Metadata section in `RGDAuthoringForm.tsx`
2. Add Status Fields section (mirrors Spec Fields section pattern)
3. Add `+ Add Status Field`, remove, name/expression inputs

Run the app at `/author` — existing functionality unaffected.

### Step 3 — Form: spec field constraint expansion

1. Add expand toggle to each spec field row
2. Render `enum`, `minimum`, `maximum`, `pattern` inputs when expanded

### Step 4 — Form: resource type toggle and template editor

1. Add resource type select (`managed` / `forEach` / `externalRef`) to each resource row
2. Add "Edit template" disclosure → `<textarea>` for `templateYaml`
3. Conditional rendering: forEach iterator rows when `resourceType === 'forEach'`
4. Conditional rendering: externalRef fields when `resourceType === 'externalRef'`

### Step 5 — Form: advanced options (includeWhen, readyWhen)

1. Add "Advanced options ▾" toggle per resource row
2. `includeWhen` single CEL input
3. `readyWhen` repeatable rows (add/remove)

### Step 6 — Live DAG validation

1. Open `/author`, add resources of each type
2. Verify live DAG shows correct node types (forEach = collection node, externalRef = external node)
3. Verify directed edges appear from template CEL references

### Step 7 — Unit tests

1. Extend `generator.test.ts`:
   - `generateRGDYAML` with scope, status, includeWhen, readyWhen, forEach, externalRef
   - `buildSimpleSchemaStr` with constraints
   - `rgdAuthoringStateToSpec` with forEach, externalRef produces correct DAG-ready shape
2. Extend `RGDAuthoringForm.test.tsx`:
   - Status field add/remove/update
   - Resource type toggle changes
   - Template editor open/close
   - forEach iterator add/remove
   - Advanced options toggle

---

## Acceptance checklist

Before opening PR:

- [ ] `cd web && bunx tsc --noEmit` — 0 errors
- [ ] `cd web && bunx vitest run` — all tests pass
- [ ] `make go` — 0 errors
- [ ] Open `/author` — add a Deployment with `spec.replicas: ${schema.spec.replicas}`, a forEach ConfigMap, and an externalRef. Generated YAML is valid kro YAML.
- [ ] Live DAG shows 3 different node types: resource rectangle, forEach triangle, external circle
- [ ] No hardcoded hex/rgba in any new CSS
- [ ] No new npm or Go dependencies added
