# Spec: Community outreach for second OWNERS approver (27.24)

## Design reference
- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future` (Community outreach)
- **Implements**: 27.24 — open a GitHub Discussion for community outreach to recruit a second OWNERS approver

---

## Zone 1 — Obligations (falsifiable)

1. A GitHub issue titled "Community: seeking a second project approver for donation readiness" is
   opened in the pnz1990/kro-ui repository, explaining the donation requirement and inviting kro
   community members to participate.

2. The issue body includes:
   - The kubernetes-sigs donation requirement (>= 2 approvers)
   - What the role of approver means (merge access, code review, issue triage)
   - The path to qualification: review 3+ substantive PRs over a reasonable period
   - A concrete call to action: comment on the issue if interested
   - A reference to GOVERNANCE.md for the full process

3. The design doc `docs/design/27-stage3-kro-tracking.md` has item 27.24 moved from 🔲 to ✅
   with a reference to the outreach issue URL.

4. The OWNERS file and GOVERNANCE.md are **not modified** — this spec only opens outreach;
   actual OWNERS changes happen when a candidate qualifies (weeks/months later).

---

## Zone 2 — Implementer's judgment

- The tone of the issue should be welcoming and informative, not urgent.
- The issue should briefly describe what kro-ui is for newcomers.
- Whether to cross-post to kubernetes-sigs/kro issues or Slack is left to the human maintainer;
  this spec only opens the GitHub issue as a starting point.

---

## Zone 3 — Scoped out

- Identifying a specific candidate by name (that requires human judgment over weeks)
- Modifying OWNERS to add a second approver (blocked on a real person agreeing and qualifying)
- Emailing the kubernetes-sigs/kro maintainer list (requires human action outside GitHub)
- Automating the qualification process
