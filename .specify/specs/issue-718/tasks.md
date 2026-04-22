# Tasks: issue-718 — Namespace instance count summary

## Pre-implementation
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-718 && GOPROXY=direct GONOSUMDB="*" go vet ./...` — expected: 0 exit

## Implementation
- [AI] Add `namespaceSummary` computed value to Instances.tsx
- [AI] Render namespace summary section below health filters
- [AI] Add CSS for `.instances-page__ns-summary` and `.instances-page__ns-pill*`
- [AI] Add unit tests covering: no summary (1 ns), summary (>1 ns), counts, error badges, click filter, hidden when ns filter active

## Post-implementation
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-718/web && npx tsc --noEmit 2>&1 | grep -c "error TS"` — expected: 1 (pre-existing vitest)
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-718 && GOPROXY=direct GONOSUMDB="*" go vet ./...` — expected: 0 exit
