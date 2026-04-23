# Tasks: issue-721 — Designer: CEL expression linter

## Pre-implementation
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-721 && GOPROXY=direct GONOSUMDB="*" go build ./... 2>&1 | tail -3` — expected: 0 exit (no output)
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-721/web && bun run typecheck 2>&1 | tail -5` — expected: 0 errors

## Implementation

### Step 1 — Create `web/src/lib/cel-linter.ts`
- [AI] Write pure TS `lintCEL(expr: string): CELDiagnostic[]` function covering:
  unclosed string literals, unclosed `${...}`, bare string literal without operator.
  Export `CELDiagnostic` interface and `lintCEL` function.
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-721/web && bun run typecheck 2>&1 | grep cel-linter` — expected: no output (no errors)

### Step 2 — Write unit tests in `web/src/lib/cel-linter.test.ts`
- [AI] Write Vitest tests for all O7 cases (empty, valid, each error class).
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-721/web && bun vitest run src/lib/cel-linter.test.ts 2>&1 | tail -10` — expected: all tests pass

### Step 3 — Add lint UI to `RGDAuthoringForm.tsx`
- [AI] Add debounced lint state (300ms useEffect + useState) for:
  - `readyWhen` rows in the resources list
  - `includeWhen` field per resource
  Render `.rgd-authoring-form__cel-error` below each CEL input when diagnostics present.
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-721/web && bun run typecheck 2>&1 | tail -5` — expected: 0 errors

### Step 4 — Add CSS tokens for error styling
- [AI] Add `.rgd-authoring-form__cel-error` style to `RGDAuthoringForm.css`
  using `--color-status-error` token. Add `role="alert"` to error container.
- [CMD] `grep -n 'cel-error' /home/runner/work/kro-ui/kro-ui.issue-721/web/src/components/RGDAuthoringForm.css` — expected: at least 1 match

### Step 5 — Update design doc
- [AI] Add `🔲 Designer: CEL expression linter` to `✅ Present` in `docs/design/31-rgd-designer.md`

## Post-implementation
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-721 && go vet ./...` — expected: no output
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-721/web && bun vitest run 2>&1 | tail -5` — expected: all tests pass
