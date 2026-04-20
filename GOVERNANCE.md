# kro-ui Governance

kro-ui is a [CNCF](https://cncf.io) adjacent project targeting donation to
[kubernetes-sigs/kro](https://github.com/kubernetes-sigs/kro). This document
describes the project governance until it moves under `kubernetes-sigs`.

Once donated, this file will be replaced by the `kubernetes-sigs` org-level
governance (see [kubernetes/community](https://github.com/kubernetes/community)).

---

## Roles

### Approvers

Approvers have write access to the repository and can merge pull requests.
They are listed in the [OWNERS](./OWNERS) file.

**Current approvers:**

| GitHub handle | Affiliation |
|---------------|-------------|
| @pnz1990      | Independent |

Approvers are responsible for:
- Reviewing and merging pull requests
- Triaging issues and setting priorities
- Guiding the technical direction of the project
- Ensuring CI/CD pipelines remain healthy
- Coordinating releases

### Reviewers

Reviewers are trusted contributors who review pull requests but do not have
merge access. They are listed in the `reviewers` section of [OWNERS](./OWNERS).

**Current reviewers:** see [OWNERS](./OWNERS).

### Contributors

Anyone who opens a pull request or issue is a contributor. Contributors do not
need special permissions to participate.

---

## Decision-Making

Decisions are made by consensus among approvers. For significant changes:

1. Open a GitHub issue to propose and discuss the change.
2. Allow at least 5 business days for feedback from maintainers.
3. A change is approved when at least one approver approves the PR and no
   approver objects within the discussion period.

For minor changes (docs, dependency bumps, small bug fixes), a single approver
approval is sufficient.

---

## Becoming a Reviewer

Contributors who have made meaningful contributions (documentation, bug fixes,
features, or reviews) over 3+ months may be nominated as reviewers.

To become a reviewer:
1. Express interest in an issue or by contacting an existing approver.
2. An existing approver opens a PR to add you to [OWNERS](./OWNERS).
3. The PR is approved by consensus of existing approvers.

---

## Becoming an Approver

Reviewers who demonstrate sustained, high-quality contributions over 6+ months
may be nominated as approvers.

To become an approver:
1. An existing approver nominates you via a PR to [OWNERS](./OWNERS).
2. All existing approvers must approve the nomination PR.

---

## Release Management

Releases follow [Semantic Versioning](https://semver.org/). Any approver may
cut a release:

1. Tag the commit: `git tag vX.Y.Z`
2. Push the tag: `git push origin vX.Y.Z`
3. The `release.yml` GitHub Actions workflow handles the rest (Docker image,
   goreleaser binary archives, GitHub release notes).

Release notes are auto-generated from merged PR titles. The release manager
reviews and edits them for clarity before publishing.

---

## Code of Conduct

This project follows the
[Kubernetes Community Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Changes to Governance

This document may be amended by a PR with approval from all current approvers.

---

## Transitioning to kubernetes-sigs

When the project is accepted for donation to `kubernetes-sigs/kro`, this
governance will be superseded by the `kubernetes-sigs` org governance. At that
point:
- The OWNERS file will be migrated to the upstream repository.
- This GOVERNANCE.md will be replaced with a pointer to the upstream governance.
- The existing approvers will be listed as initial approvers in the upstream
  OWNERS file, subject to org approval.
