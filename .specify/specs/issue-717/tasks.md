# Tasks: issue-717 — Lighthouse score regression comment on PRs

## Pre-implementation
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-717 && cat .github/workflows/perf.yml | wc -l` — expected: >100 (confirm file exists)

## Implementation

- [AI] Add a new workflow step to `perf.yml` that downloads the `lighthouse-report` artifact
  from the most recent successful `main` push run and extracts the baseline score.
  
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-717 && grep -n "Check performance score" .github/workflows/perf.yml` — expected: line number found

- [AI] After the "Run Lighthouse audit" step, add a "Lighthouse diff comment" step
  that:
  1. Reads the current PR score from `lighthouse-report.json`
  2. Downloads baseline artifact from last main run (via `gh run list` + `gh run download`)
  3. Computes delta and formats the comment body with the `<!-- lighthouse-diff -->` marker
  4. Posts/updates the PR comment using `gh pr comment` (create or edit existing)
  
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-717 && python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/perf.yml')); print('valid yaml')"` — expected: "valid yaml"

## Post-implementation
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-717 && python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/perf.yml')); steps=[s['name'] for s in y['jobs']['lighthouse']['steps'] if 'name' in s]; print(steps)"` — expected: list includes "Lighthouse diff comment"
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-717 && grep -c 'lighthouse-diff' .github/workflows/perf.yml` — expected: >= 1
