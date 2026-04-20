# Spec 532 — Donation Readiness Checklist (27.7)

## Design reference
- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future`
- **Implements**: 27.7 — Donation readiness checklist: CNCF sandbox criteria, kubernetes-sigs contribution guide, DCO sign-off enforcement, security policy file, OWNERS file (🔲 → ✅)

---

## Zone 1 — Obligations

**O1 — OWNERS file exists at repo root.**
An `OWNERS` file in the kubernetes-sigs OWNERS format must exist with:
- `approvers:` list containing `pnz1990`
- `reviewers:` list containing `pnz1990`

**O2 — DCO sign-off enforcement is active.**
A GitHub Actions workflow or configuration must enforce DCO sign-off on PRs.
The recommended approach: add the `DCO` GitHub App via `.github/workflows/dco.yml`
or document DCO requirement in CONTRIBUTING.md with a note that PRs must include
`Signed-off-by: Name <email>` in commit messages per
https://developercertificate.org/.

**O3 — CONTRIBUTING.md documents DCO requirement.**
The `CONTRIBUTING.md` must have a section explaining DCO sign-off:
- What DCO is (Developer Certificate of Origin)
- That `git commit -s` generates the sign-off automatically
- That this is required for upstream donation compatibility

**O4 — Design doc updated.**
`docs/design/27-stage3-kro-tracking.md` must have 27.7 moved from 🔲 to ✅ Present.

---

## Zone 2 — Implementer's judgment

- OWNERS file format: kubernetes-sigs standard (approvers/reviewers lists, no emeritus yet)
- DCO enforcement: add a workflow with `dco-check` action OR document as manual requirement.
  The `probot/dco` app requires GitHub App installation which is out of scope here.
  Use a simple CI check in a new workflow file instead.
- CONTRIBUTING.md: add the DCO section before the existing "Development Workflow" section.

---

## Zone 3 — Scoped out

- CNCF sandbox application (requires governance maturity beyond this PR)
- GOVERNANCE.md (needs actual governance model definition)
- OWNERS_ALIASES file (single maintainer, not needed yet)
- CLA (replaced by DCO for kubernetes-sigs projects)
