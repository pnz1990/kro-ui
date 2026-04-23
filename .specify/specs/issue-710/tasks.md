# Tasks: issue-710 — RGD display: kro upstream field parity SLO

## Pre-implementation

- [CMD] `cd ../kro-ui.issue-710 && grep -c "CONTRIBUTING" AGENTS.md` — expected: ≥1 (CONTRIBUTING.md is referenced)
- [CMD] `cd ../kro-ui.issue-710 && wc -l CONTRIBUTING.md` — expected: non-zero

## Implementation

- [AI] Read the full CONTRIBUTING.md to identify placement for the new SLO section
- [AI] Add "## kro Upstream Field Parity SLO" section after "Architecture Rules" in CONTRIBUTING.md
- [AI] Update docs/design/28-rgd-display.md: move kro upstream field parity SLO from 🔲 Future to ✅ Present

## Post-implementation

- [CMD] `cd ../kro-ui.issue-710 && grep -c "kro Upstream Field Parity SLO" CONTRIBUTING.md` — expected: 1
- [CMD] `cd ../kro-ui.issue-710 && grep -c "2 kro-ui releases" CONTRIBUTING.md` — expected: ≥1
- [CMD] `cd ../kro-ui.issue-710 && grep -c "kro upstream field parity SLO" docs/design/28-rgd-display.md` — expected: ≥1 (in Present section)
