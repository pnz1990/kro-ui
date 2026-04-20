# Spec: 27.1 — kro Release Tracking Automation

> Issue: #523
> Branch: feat/issue-523
> Design ref: `docs/design/27-stage3-kro-tracking.md`

## Design reference

- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future`
- **Implements**: 27.1 — kro release tracking automation (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1 — A GitHub Actions workflow checks for new kro releases automatically.**
The workflow must query `https://api.github.com/repos/kubernetes-sigs/kro/releases/latest`
and compare the latest tag to the current version in `go.mod`. If newer, it opens a
`feat(kro-vX.Y.Z): support new kro features` issue in this repo (deduplicated).

**O2 — The check runs on a schedule without human intervention.**
The workflow trigger includes `schedule: cron: "0 9 * * 1"` (weekly Monday 09:00 UTC)
or equivalent. Manual trigger via `workflow_dispatch` must also be supported.

**O3 — Duplicate issues are suppressed.**
If an open issue titled `feat(kro-...): kro vX.Y.Z support` already exists, the workflow
must not create another one. The check must use `gh issue list --search` to verify.

**O4 — The workflow fails safe.**
If the GitHub API is rate-limited or unreachable, the workflow exits 0 (non-fatal).
It must not block CI or create noise from transient network failures.

**O5 — otherness-config.yaml is updated with anchor upstream version tracking.**
`anchor.upstream_version_file: go.mod` and `anchor.upstream_version_pattern: kubernetes-sigs/kro`
are added so SM §4g-anchor-upstream tracks local version changes when go.mod is updated.

---

## Zone 2 — Implementer's judgment

- Workflow frequency: weekly (Monday 09:00 UTC) is sufficient for kro release cadence.
  kro does not release more than once per week.
- Issue label: use existing `kind/enhancement,priority/medium,kro-ui` labels.
- Version comparison: semantic versioning comparison using Python's `packaging.version`
  or simple tuple comparison on `(major, minor, patch)` — no new dependencies needed.
- The workflow uses `GITHUB_TOKEN` (no secrets needed — public API).

---

## Zone 3 — Scoped out

- Automated PR to upgrade go.mod (that is a separate workflow and out of scope for 27.1)
- Parsing kro changelogs or release notes (out of scope — a human reads the opened issue)
- Checking pre-release or RC versions (only stable releases trigger issues)
- Per-CRD field diffing (out of scope for 27.1 — that's 27.2+)
