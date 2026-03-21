# Tasks: CEL / Schema Syntax Highlighter

**Input**: Design documents from `/specs/006-cel-highlighter/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests are explicitly required by the spec (Testing Requirements: "required before merge"). Test tasks are included with TDD approach.

**Organization**: Tasks are grouped by user story. US1 (tokenizer + component) is the MVP. US2 (theme switching) is CSS-only and verifies the CSS variable approach.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

All frontend source files are under `web/src/`. Tests are co-located with source (`*.test.ts`). E2E tests are under `test/e2e/journeys/`.

---

## Phase 1: Setup

**Purpose**: Install Vitest, configure test infrastructure, verify project builds

- [x] T001 Install Vitest as dev dependency — run `bun add -d vitest` in `web/` and add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `web/package.json`
- [x] T002 Configure Vitest — add `test` block to `web/vite.config.ts` with `globals: false`, `environment: "node"`, `include: ["src/**/*.test.ts"]`
- [x] T003 Verify setup — run `bun run test` in `web/` (should pass with 0 tests found, no errors); run `bun run typecheck` (should pass)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define types and constants that both user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create `web/src/lib/highlighter.ts` with exported types `TokenType` (9-member string union including `"plain"`) and `Token` interface (`{ type: TokenType; text: string }`), plus constants `KRO_KEYWORDS`, `SCHEMA_TYPES`, `SCHEMA_KEYWORDS` as `ReadonlySet<string>` per data-model.md. Export a stub `tokenize` function that returns `[{ type: "plain" as const, text: yaml }]` for any input. Ensure `bun run typecheck` passes.

**Checkpoint**: Types and constants defined. Stub tokenize() compiles and is importable.

---

## Phase 3: User Story 1 — Developer reads RGD YAML with correct highlighting (Priority: P1) MVP

**Goal**: `tokenize()` correctly classifies all 8 token types in kro YAML. `KroCodeBlock` renders highlighted tokens using CSS variables. Copy-to-clipboard works.

**Independent Test**: Run `bun run test` in `web/` — all tokenizer unit tests pass. Run `bun run typecheck` — zero errors. Render the test-app RGD YAML in `KroCodeBlock` and confirm CEL expressions, kro keywords, YAML keys, SimpleSchema, and comments are visually distinct.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T005 [P] [US1] Write CEL expression unit tests in `web/src/lib/highlighter.test.ts` — test `tokenize("name: ${foo.bar}")` produces `celExpression` token; test `${expr}` with nested dots and comparison operators like `${ns.status.phase == "Active"}`; test unclosed `${` falls back to plain text; test `${` inside comment is not treated as CEL
- [x] T006 [P] [US1] Write kro keyword unit tests in `web/src/lib/highlighter.test.ts` — test `readyWhen:`, `forEach:`, `includeWhen:`, `template:`, `id:`, `externalRef:`, `scope:`, `types:` each tokenize as `kroKeyword`; test `apiVersion:` tokenizes as `yamlKey` (not `kroKeyword`); test kro keyword after whitespace indentation is still `kroKeyword`
- [x] T007 [P] [US1] Write SimpleSchema unit tests in `web/src/lib/highlighter.test.ts` — test `string` in value position → `schemaType`; test `integer` in value position → `schemaType`; test `string | default=primary` produces all 4 schema token types plus plain `=`; test `integer | min=1 | max=10` with multiple pipe segments; test `"string"` (quoted) is NOT treated as schemaType
- [x] T008 [P] [US1] Write comment and edge case unit tests in `web/src/lib/highlighter.test.ts` — test `# comment` → `comment` token; test inline comment after YAML value; test empty string input → empty array; test completeness invariant (`tokens.map(t => t.text).join("") === input`) on multi-line kro YAML from test fixture
- [x] T009 [P] [US1] Write performance unit test in `web/src/lib/highlighter.test.ts` — create `generateLargeYaml(lines: number)` helper that produces realistic kro YAML; test `tokenize(generateLargeYaml(500))` completes in under 10ms using `performance.now()`

### Implementation for User Story 1

- [x] T010 [US1] Implement `tokenize()` core algorithm in `web/src/lib/highlighter.ts` — line-by-line processing with intra-line character scanning per research.md architecture: (1) comment detection: line trimmed starts with `#` → entire line is `comment`, (2) CEL expression: `${` opens span, first `}` closes, unclosed → plain text, (3) key detection: `word:` at key position → check KRO_KEYWORDS set for `kroKeyword` else `yamlKey`, (4) SimpleSchema: after `:` if first value word is in SCHEMA_TYPES → enter schema mode for rest of value parsing `|` as `schemaPipe`, constraint keywords as `schemaKeyword`, `=value` as `schemaValue`, (5) everything else → `plain`. Adjacent same-type tokens must be merged. No `any`, no `@ts-ignore`. Verify all T005-T009 tests pass.
- [x] T011 [P] [US1] Create `web/src/components/KroCodeBlock.css` — token color classes: `.token-cel-expression { color: var(--hl-cel-expression); }` for all 9 types (8 highlighted + `.token-plain` inheriting `--color-text`); `.kro-code-block` container with `position: relative`; `.kro-code-block-pre` with `background: var(--color-surface-3)`, `border-radius: var(--radius)`, `border: 1px solid var(--color-border-subtle)`, `font-family: var(--font-mono)`, `font-size: 13px`, `overflow-x: auto`, `padding: 16px`, `tabindex` styles; `.kro-code-block-header` with title bar styles; `.kro-code-block-copy` button positioned top-right with `var(--transition-fast)` hover effect; `.kro-code-block-title` for title text
- [x] T012 [US1] Implement `KroCodeBlock` component in `web/src/components/KroCodeBlock.tsx` — import `tokenize` from `@/lib/highlighter` and `./KroCodeBlock.css`; accept props `{ code, language?, title? }` per contracts/component.md; call `tokenize(code)` and render each token as `<span className={`token-${type}`}>` inside `<pre><code>`; add `data-testid="kro-code-block"` on root div; render title bar with copy button when `title` prop is provided; when no title, float copy button inside pre; copy button uses `navigator.clipboard.writeText(code)` with `copied` state (2s timeout) and inline SVG icons (copy → check); add `aria-label` toggling `"Copy code"` / `"Copied!"`; add `tabindex="0"` on `<pre>` for keyboard scrolling; also add `span.token-cel` alias class on celExpression tokens for E2E test selector compatibility
- [x] T013 [US1] Run `bun run typecheck` in `web/` — verify zero TypeScript errors with strict mode
- [x] T014 [US1] Run `bun run test` in `web/` — verify all unit tests pass (T005-T009)

**Checkpoint**: Tokenizer fully implemented and tested. KroCodeBlock renders highlighted YAML. All unit tests pass. TypeScript strict mode clean.

---

## Phase 4: User Story 2 — Highlighting works in both dark and light mode (Priority: P2)

**Goal**: Token colors switch automatically via CSS custom properties when theme changes. No re-tokenization needed.

**Independent Test**: In a browser, toggle `data-theme="light"` on `<html>` and verify token colors change. Specifically, CEL expressions shift from `#93c5fd` to `#3b6fd4`.

### Implementation for User Story 2

- [x] T015 [US2] Verify CSS variable resolution in `web/src/tokens.css` — confirm all 8 `--hl-*` variables exist in both `:root` (dark) and `[data-theme="light"]` blocks with correct hex values per design spec 000. Confirm `KroCodeBlock.css` uses `var(--hl-*)` exclusively (no hardcoded hex). No code changes expected — this is a verification task. If any variable is missing or mismatched, add/fix it.
- [x] T016 [US2] Verify `KroCodeBlock` does not hardcode any color values or subscribe to theme state — review `web/src/components/KroCodeBlock.tsx` for any hex literals, `getComputedStyle` calls, or theme context consumption. Component should be purely CSS-variable-driven. Fix if any violations found.

**Checkpoint**: Theme switching verified. CSS variables handle dark/light mode. No component changes needed.

---

## Phase 5: E2E Journey

**Purpose**: End-to-end validation that highlighted tokens render with correct computed CSS colors in a real browser

- [x] T017 Write E2E journey `test/e2e/journeys/006-cel-highlighting.spec.ts` — implement 5-step journey per spec: (1) navigate to `/rgds/test-app?tab=yaml`, assert `[data-testid="kro-code-block"]` visible; (2) locate first `span.token-cel-expression` (or `span.token-cel`), use `page.evaluate()` + `getComputedStyle()` to assert computed color is `rgb(147, 197, 253)` (`#93c5fd` dark mode); (3) locate first `span.token-kro-keyword`, assert color is `rgb(214, 211, 209)` (`#d6d3d1`); (4) locate first `span.token-yaml-key`, assert color is `rgb(168, 162, 158)` (`#a8a29e`); (5) click `[data-testid="code-block-copy-btn"]`, assert clipboard contains raw YAML via `page.evaluate(() => navigator.clipboard.readText())`

**Checkpoint**: E2E journey file created and ready to run against kind cluster.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, build verification

- [x] T018 Run full typecheck from repo root — `bun run typecheck` in `web/` passes with zero errors
- [x] T019 Run full unit test suite — `bun run test` in `web/` passes with all tests green
- [x] T020 Verify `bun run build` in `web/` succeeds — production build with no warnings or errors; confirm `web/dist/` output is valid
- [x] T021 Verify `go build ./cmd/kro-ui/` from repo root succeeds — Go binary embeds `web/dist/` via `go:embed`; no build errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Vitest installed)
- **US1 (Phase 3)**: Depends on Phase 2 (types and constants defined)
- **US2 (Phase 4)**: Depends on Phase 3 (KroCodeBlock implemented)
- **E2E (Phase 5)**: Depends on Phase 3 (component exists for browser testing)
- **Polish (Phase 6)**: Depends on Phases 3 and 4

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2). This is the MVP — standalone and independently testable.
- **User Story 2 (P2)**: Depends on US1 completion (needs KroCodeBlock CSS file to verify). Primarily a verification task.

### Within User Story 1

- Tests (T005-T009) MUST be written FIRST and confirmed to fail
- T010 (tokenize implementation) makes tests pass — depends on T005-T009 existing
- T011 (CSS) and T010 (tokenizer) can run in parallel — different files
- T012 (component) depends on T010 (tokenizer) and T011 (CSS)
- T013-T014 (verification) depend on T010 and T012

### Parallel Opportunities

- T005, T006, T007, T008, T009 (all test files) can run in parallel — they are separate `describe` blocks in the same file but can be written simultaneously
- T010 and T011 can run in parallel — tokenizer logic and CSS are different files
- T015 and T016 can run in parallel — both are verification tasks on different files

---

## Parallel Example: User Story 1

```bash
# Write all test describe blocks simultaneously:
Task T005: "CEL expression tests in web/src/lib/highlighter.test.ts"
Task T006: "kro keyword tests in web/src/lib/highlighter.test.ts"
Task T007: "SimpleSchema tests in web/src/lib/highlighter.test.ts"
Task T008: "Comment and edge case tests in web/src/lib/highlighter.test.ts"
Task T009: "Performance test in web/src/lib/highlighter.test.ts"

# After tests exist, implement in parallel:
Task T010: "Implement tokenize() in web/src/lib/highlighter.ts"
Task T011: "Create KroCodeBlock.css in web/src/components/KroCodeBlock.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Vitest)
2. Complete Phase 2: Foundational (types + constants)
3. Complete Phase 3: User Story 1 (tokenizer + component + tests)
4. **STOP and VALIDATE**: `bun run test` passes, `bun run typecheck` passes, render test YAML visually
5. Deploy/demo if ready — this alone delivers the core highlighter

### Incremental Delivery

1. Setup + Foundational → Test infrastructure ready
2. User Story 1 → Tokenizer works, component renders, unit tests pass (MVP!)
3. User Story 2 → Theme switching verified, CSS variables confirmed
4. E2E Journey → Browser-level validation ready for CI
5. Polish → Full build pipeline verified

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- All tests are in a single file (`highlighter.test.ts`) but organized by `describe` blocks
- The tokenizer has ZERO runtime dependencies — it is a pure function
- CSS variables in `tokens.css` are already defined — no new CSS variables needed
- `specPatch` MUST NOT appear in the keyword list (constitution §II)
- Commit after each phase completion using Conventional Commits: `feat(highlighter): ...`
