# Tasks for Spec 530 — Performance Budget

## Phase 1: Setup
- [x] Read spec.md, design doc, constitution
- [ ] [CMD] Check if @lhci/cli is feasible in GitHub Actions

## Phase 2: Playwright Journey
- [ ] [AI] Write test/e2e/journeys/080-performance-budget.spec.ts
- [ ] [CMD] Register 080 in playwright.config.ts chunk-9 testMatch pattern

## Phase 3: GitHub Actions Perf Workflow
- [ ] [AI] Write .github/workflows/perf.yml with Lighthouse/timing CI check

## Phase 4: Design Doc Update
- [ ] [AI] Move 27.4 from 🔲 Future to ✅ Present in docs/design/27-stage3-kro-tracking.md

## Phase 5: Validate
- [ ] [CMD] go vet ./...
- [ ] [CMD] cd web && bun run typecheck
- [ ] [CMD] cd test/e2e && bun run tsc --noEmit (if applicable)

## Phase 6: Commit and PR
- [ ] [CMD] git add specific files && git commit && git push
- [ ] [CMD] gh pr create
