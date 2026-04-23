# spec: issue-717 — Lighthouse score regression comment on PRs

## Design reference
- **Design doc**: `docs/design/28-rgd-display.md`
- **Section**: `§ Future`
- **Implements**: RGD display: Lighthouse score regression comment on PRs (🔲 → ✅)

---

## Zone 1 — Obligations

**O1**: The `perf.yml` workflow MUST, on pull_request events, capture the Lighthouse
performance score for the current PR branch and compare it to the score on `main`
(fetched separately).

**O2**: A PR comment MUST be posted (or updated if already present) showing:
- The PR branch score
- The `main` baseline score
- The delta (e.g., `−5` or `+3`)
- A visual indicator: ✅ when delta ≥ 0 or regression < 5 points; ⚠️ when regression
  is 5–14 points; ❌ when regression is ≥ 15 points.

**O3**: The comment MUST be idempotent: if a prior Lighthouse comment exists on the PR
(identified by a known marker string `<!-- lighthouse-diff -->`), it is updated in
place (not duplicated) using `gh pr comment --edit`.

**O4**: A missing or unparseable `main` baseline score is treated as "baseline unknown"
and the comment shows only the current score without a delta. The PR is not failed.

**O5**: The existing `Check performance score` step threshold gate (exit 1 below 45)
is preserved and unchanged.

---

## Zone 2 — Implementer's judgment

- How to fetch the `main` baseline: run a second Lighthouse audit against a second
  kro-ui binary built from `main`. Alternatively, read a stored baseline artifact
  from the last successful `main` push run. The artifact approach is lighter (no
  second binary build); use it if GitHub Actions artifact download is straightforward.
- Score computation: re-use the existing Python snippet that parses `lighthouse-report.json`.
- Comment format: compact single-line summary preferred (fits in PR review list).

---

## Zone 3 — Scoped out

- Lighthouse accessibility/SEO/best-practices category scoring
- Score history trending over multiple PRs
- Configurable thresholds via repo config file
