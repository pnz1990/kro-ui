# Implementation Plan: CEL / Schema Syntax Highlighter

**Branch**: `006-cel-highlighter` | **Date**: 2026-03-20 | **Spec**: `specs/006-cel-highlighter/spec.md`
**Input**: Feature specification from `/specs/006-cel-highlighter/spec.md`

## Summary

Build a pure TypeScript tokenizer (`tokenize()`) and React component
(`KroCodeBlock`) that syntax-highlights kro YAML — CEL expressions,
kro-specific keywords, SimpleSchema annotations, and standard YAML keys — using
the 8-token type system defined in the spec. Token colors are applied
exclusively via CSS custom properties already defined in `tokens.css`. The
tokenizer has zero dependencies and must process 500-line YAML in under 10ms.

## Technical Context

**Language/Version**: TypeScript ~5.7 (strict mode enabled), React 19  
**Primary Dependencies**: None beyond React 19 (tokenizer is stdlib-only); Vitest for testing  
**Storage**: N/A  
**Testing**: Vitest (unit tests for tokenizer), Playwright (E2E journey 006)  
**Target Platform**: Browser (bundled via Vite 8, embedded in Go binary via go:embed)  
**Project Type**: Library (pure tokenizer function) + UI component (KroCodeBlock)  
**Performance Goals**: 500-line YAML tokenized in <10ms (NFR-001)  
**Constraints**: No external highlighting libraries; no `any`/`@ts-ignore`; no hardcoded hex colors; TypeScript strict mode  
**Scale/Scope**: ~300 lines tokenizer + ~100 lines component + ~200 lines tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Constitution § | Status | Notes |
|------|---------------|--------|-------|
| No external highlighting libs | §V | PASS | Custom tokenizer, zero deps |
| No CSS frameworks | §V | PASS | Plain CSS with `tokens.css` custom properties |
| No state management libraries | §V | PASS | Props-only component, no state lib |
| Token colors via CSS variables only | §IX | PASS | Uses `var(--hl-*)` from `tokens.css` |
| Dark + light mode support | §IX | PASS | CSS variables handle theme switch |
| TypeScript strict mode | §VII, NFR-002 | PASS | `tsconfig.json` already has `strict: true` |
| Pure function, fully testable | §VII | PASS | `tokenize()` is stateless, deterministic |
| Frontend tests via Vitest | §VII | PASS | Vitest to be installed as devDependency |
| No `specPatch` or fork concepts | §II | PASS | Keyword list is upstream-only |
| Read-only (no mutations) | §III | N/A | This feature has no k8s API calls |

**Result: ALL GATES PASS. No violations.**

## Project Structure

### Documentation (this feature)

```text
specs/006-cel-highlighter/
├── plan.md              # This file
├── research.md          # Phase 0 output — token color reconciliation, tokenizer design
├── data-model.md        # Phase 1 output — Token, TokenType, KroCodeBlock props
├── quickstart.md        # Phase 1 output — integration examples
├── contracts/           # Phase 1 output — tokenizer contract, component contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
web/
├── src/
│   ├── tokens.css                      # Already has --hl-* variables (8 dark + 8 light)
│   ├── lib/
│   │   ├── highlighter.ts              # NEW: tokenize(), Token, TokenType
│   │   └── highlighter.test.ts         # NEW: Vitest unit tests
│   └── components/
│       ├── KroCodeBlock.tsx            # EXISTS (stub) → full implementation
│       └── KroCodeBlock.css            # NEW: component styles
├── vitest.config.ts                    # NEW: Vitest configuration
└── package.json                        # UPDATE: add vitest devDependency + test script

test/e2e/
└── journeys/
    └── 006-cel-highlighting.spec.ts    # NEW: E2E journey
```

**Structure Decision**: This feature adds files to the existing `web/src/lib/`
and `web/src/components/` directories. No new directory structure needed. Vitest
configuration is added at the `web/` root.

## Complexity Tracking

No constitution violations — table not needed.
