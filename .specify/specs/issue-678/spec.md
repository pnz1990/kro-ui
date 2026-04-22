# Spec: issue-678 — SECURITY.md post-donation update (27.23)

> Status: Active | Created: 2026-04-22

## Design reference

- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future`
- **Implements**: 27.23 — SECURITY.md post-donation update: add
  `## Post-Donation Security Policy` section documenting the planned
  security reporting route change upon kubernetes-sigs donation (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: `SECURITY.md` MUST contain a `## Post-Donation Security Policy`
section (or equivalent heading) that documents the planned update to route
security reports through `security@kubernetes.io` upon donation to
kubernetes-sigs.
Violation: the section is absent.

**O2**: The section MUST explicitly reference `security@kubernetes.io` as
the reporting route post-donation.
Violation: the email address is not mentioned.

**O3**: The section MUST make clear this is a **pre-donation placeholder**
that will be updated when the donation PR is filed — not an already-active
policy.
Violation: the section implies this policy is already in effect.

**O4**: The design doc `docs/design/27-stage3-kro-tracking.md` MUST have
the donation-readiness 27.23 item updated from `🔲 Future` to `✅ Present`.
Violation: the design doc donation-readiness 27.23 still shows `🔲`.

---

## Zone 2 — Implementer's judgment

- Use a `## Post-Donation Security Policy` heading followed by a brief
  note explaining that the current GitHub Security Advisories URL will be
  replaced with `security@kubernetes.io` / kubernetes-sigs process.
- Keep it short — this is documentation, not code.
- Cross-reference the OWNERS file and GOVERNANCE.md for completeness.

---

## Zone 3 — Scoped out

- Updating the *existing* `## Reporting a Vulnerability` section — that
  section correctly describes the current state (GitHub Security Advisories).
  Only the post-donation section is added.
- Filing the actual donation PR — that is a separate human-gated process.
