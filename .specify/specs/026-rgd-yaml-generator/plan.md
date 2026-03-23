# Implementation Plan: RGD YAML Generator

**Branch**: `026-rgd-yaml-generator` | **Date**: 2026-03-23 | **Spec**: `.specify/specs/026-rgd-yaml-generator/spec.md`
**Input**: Feature specification from `.specify/specs/026-rgd-yaml-generator/spec.md`

## Summary

Add a "Generate" tab to the RGD detail page providing three YAML generation
modes: (1) an interactive form-per-field instance manifest builder with live
YAML preview, (2) a batch generator that produces multi-document YAML from
a variable-per-line table, and (3) a guided RGD authoring mode that scaffolds
a new `ResourceGraphDefinition` YAML from user-defined kind, spec fields, and
resource templates. All generation is client-side. Reuses existing `SchemaDoc`,
`buildSchemaDoc`, `parseSimpleSchema`, `KroCodeBlock`, and `toYaml` infrastructure
from spec `020-schema-doc-generator`.

## Technical Context

**Language/Version**: Go 1.25 (backend, no changes needed) / TypeScript 5.x + React 19
**Primary Dependencies**: React 19, React Router v7, Vite (all already present); no new npm deps
**Storage**: N/A — all state is local React `useState`; no persistence
**Testing**: Vitest (frontend unit tests), `go test -race` (backend — no changes)
**Target Platform**: Browser (modern evergreen); single binary embedding via `go:embed`
**Project Type**: Frontend feature addition to existing web-service dashboard
**Performance Goals**: Form → YAML preview round-trip <16ms (synchronous, one React render cycle)
**Constraints**: No new npm dependencies (§V); no backend changes (all client-side); read-only (§III)
**Scale/Scope**: Works on any RGD regardless of number of spec fields (tested mentally at 20+)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| §I Iterative-First | PASS | Spec 020 merged; this is the next independent spec |
| §II Cluster Adaptability | PASS | Reads schema from already-loaded RGD; no hardcoded field paths; degrades gracefully for unknown types |
| §III Read-Only | PASS | Zero mutating API calls; all generation is client-side string building |
| §IV Single Binary | PASS | No new assets; embedded via existing go:embed setup |
| §V Simplicity | PASS | No new npm deps; plain React state; reuses existing lib functions |
| §VI Go Standards | N/A | No backend changes needed |
| §VII Testing | PASS | Unit tests required: `generator.test.ts`, `GenerateTab.test.tsx` |
| §VIII Commit Conventions | PASS | Will use `feat(web): add Generate tab with instance/batch/rgd-authoring modes` |
| §IX Theme | PASS | All CSS must use `tokens.css` tokens; no inline hex/rgba |
| §X Licensing | PASS | No new Go files (no copyright headers needed); frontend files have no header requirement |
| §XI API Performance | N/A | No new API endpoints |
| §XII Graceful Degradation | PASS | Missing kind → falls back to RGD metadata.name; unknown field types → free-text input; no spec fields → valid minimal YAML |
| §XIII UX Standards | PASS | Tab accessible via `?tab=generate`; page title updated; copy UX matches spec 020 KroCodeBlock pattern |

**Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
.specify/specs/026-rgd-yaml-generator/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── generate-tab.md  # Component API contracts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
web/src/
├── lib/
│   └── generator.ts          # NEW: generateInstanceYAML, generateRGDYAML, parseBatchRow
│   └── generator.test.ts     # NEW: unit tests for generator.ts
├── components/
│   ├── GenerateTab.tsx        # NEW: top-level Generate tab; owns mode state
│   ├── GenerateTab.css        # NEW
│   ├── GenerateTab.test.tsx   # NEW
│   ├── InstanceForm.tsx       # NEW: per-field form for instance generation
│   ├── InstanceForm.css       # NEW
│   ├── BatchForm.tsx          # NEW: textarea-driven batch manifest generator
│   ├── BatchForm.css          # NEW
│   ├── RGDAuthoringForm.tsx   # NEW: guided RGD YAML scaffolder
│   ├── RGDAuthoringForm.css   # NEW
│   ├── YAMLPreview.tsx        # NEW: read-only YAML + Copy YAML + Copy kubectl apply
│   └── YAMLPreview.css        # NEW
└── pages/
    └── RGDDetail.tsx          # MODIFIED: add "generate" tab, import GenerateTab
    └── RGDDetail.css          # MODIFIED: minor tab-bar adjustments if needed
```

**Structure Decision**: Frontend-only changes. Backend unchanged. New components
in `web/src/components/`; new pure-function lib module in `web/src/lib/generator.ts`.
Follows Option 2 (web app) but only the frontend layer is modified.

## Complexity Tracking

> No constitution violations — this section is not required.
