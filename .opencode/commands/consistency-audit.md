---
description: Cross-artifact consistency audit — constitution, AGENTS.md, all specs, codebase
---

## Goal

Perform a **read-only** cross-artifact consistency audit of the entire kro-ui project. Identify inconsistencies, contradictions, terminology drift, and gaps across:

- `.specify/memory/constitution.md` (non-negotiable authority)
- `AGENTS.md` (active technology + anti-pattern registry)
- All specs in `.specify/specs/*/spec.md` (where present)
- The live codebase (`web/src/`, `internal/`)

This audit runs on `main` and covers the whole project — it is **not** scoped to a single feature branch.

---

## Execution Steps

### 1. Load Core Authority Documents

Read these files first and hold them as the reference baseline:

- `.specify/memory/constitution.md`
- `AGENTS.md`

Extract and intern:
- Every **MUST** / **MUST NOT** / **SHOULD** normative statement from the constitution, keyed by section (e.g., `III.read-only`, `V.no-css-framework`)
- Every anti-pattern row from the AGENTS.md "Known anti-patterns" table
- Every technology listed under "Active Technologies" in AGENTS.md
- The "Recent Changes" version trail

### 2. Scan Specs

For each spec found under `.specify/specs/*/spec.md`, extract:
- Technology choices (stack, libraries, CSS approach)
- Any stated MUST/SHOULD constraints
- Data entities and API surface described
- Any reference to fork-only concepts (`specPatch`, `stateFields`)

Flag if a spec:
- Contradicts a constitution MUST
- References a technology prohibited by AGENTS.md (Tailwind, Bootstrap, MUI, external state libs)
- Uses fork-only concepts
- Names a kro API field path outside the isolated mapping package

### 3. Scan Live Codebase (Targeted)

Run targeted checks against the live source — do **not** do exhaustive line-by-line reads:

**A. Token usage**
- Search `web/src/` for hardcoded `rgba(`, hex colors `#[0-9a-fA-F]{3,6}`, and `box-shadow:` not referencing a CSS variable. Flag any hits as potential token violations.

**B. State management**
- Search `web/src/` for imports of `redux`, `zustand`, `jotai`, `mobx`, `recoil`. Flag any hits.

**C. CSS framework imports**
- Search `web/src/` for `tailwind`, `bootstrap`, `@mui/`. Flag any hits.

**D. Fork-only concepts**
- Search entire repo for `specPatch` or `stateFields`. Flag any hits.

**E. Mutating API verbs**
- Search `internal/` for HTTP client calls using `PUT`, `POST`, `DELETE`, `PATCH` to the Kubernetes API. Flag any hits.

**F. Hardcoded kro field paths**
- Search `internal/` for string literals containing `spec.resources` or `spec.schema` outside of `internal/k8s/rgd.go`. Flag any hits.

**G. `document.title` coverage**
- Search `web/src/pages/` for page components missing a `document.title` assignment. Flag any page files with no `document.title`.

**H. 404 catch-all route**
- Check `web/src/main.tsx` (or router file) for a `path="*"` catch-all rendering `NotFound`. Flag if absent.

**I. Discovery caching**
- Search `internal/` for `ServerGroupsAndResources` called outside of a cached context. Flag any unbounded per-request calls.

### 4. Cross-Reference AGENTS.md Anti-Patterns vs Codebase

For each anti-pattern row in the AGENTS.md table, verify whether the anti-pattern still exists in the codebase (by targeted search). Mark each as:
- **Resolved** — no evidence found
- **Present** — evidence found, cite file:line
- **Cannot verify** — insufficient signal from search

### 5. Terminology Consistency Check

Collect all user-visible labels and internal type names for the 5 kro node types from:
- AGENTS.md "Upstream kro node types" table
- Any spec referencing node type labels
- `web/src/lib/dag.ts` (or equivalent)
- `web/src/components/` (DAG-related components)

Report any drift (e.g., a component calling a `NodeTypeCollection` node "forEach node" inconsistently vs. "forEach fan-out" in AGENTS.md).

### 6. Version Trail Check

From AGENTS.md "Recent Changes", extract the current version (`v0.4.12` as of last update). Verify:
- `internal/version/version.go` (or equivalent) is consistent
- Any hardcoded version strings in `web/src/` match

### 7. Produce Analysis Report

Output a Markdown report with this structure:

---

## Consistency Audit Report

**Audit scope**: entire project (branch: `main`)
**Reference baseline**: constitution + AGENTS.md

### Constitution Alignment

| ID | Section | Severity | Finding | Location |
|----|---------|----------|---------|----------|

### Anti-Pattern Registry Check

| Anti-pattern | Status | Evidence |
|---|---|---|

### Spec Consistency

| Spec | Finding | Severity |
|---|---|---|

### Codebase Checks

| Check | Status | Findings |
|---|---|---|

### Terminology Drift

| Concept | Constitution/AGENTS | Spec/Code | Drift? |
|---|---|---|---|

### Metrics

- Constitution rules checked: N
- Anti-patterns verified: N
- Specs scanned: N
- Codebase checks run: N
- Critical issues: N
- High issues: N
- Medium issues: N
- Low issues: N

### Next Actions

(List prioritized actions. CRITICAL issues should be resolved before the next feature spec is started.)

---

**IMPORTANT**: This is a **read-only** audit. Do not modify any files. Present the report and then ask the user if they want concrete remediation suggestions for the top issues.
