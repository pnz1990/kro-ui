# Spec: Partial-RBAC / Restricted-Namespace Testing (issue-574 / 27.12)

> Status: Draft | Author: otherness[bot] | Date: 2026-04-21

## Design reference
- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future`
- **Implements**: 27.12 — Partial-RBAC / restricted-namespace testing (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1** — `ListAllInstances` (GET /api/v1/instances) MUST return HTTP 200 even when one
or more RGD list calls return a Forbidden error. The response MUST include:
  - `items`: all instances from successfully-fetched RGDs
  - `total`: count of items returned
  - `rbacHidden`: count of RGDs whose instance list was skipped due to Forbidden / RBAC error
  (Violation: any 5xx response when any single RGD list returns Forbidden)

**O2** — `ListInstances` (GET /api/v1/rgds/{name}/instances) MUST return HTTP 200 with an
empty items list when the list call returns a Forbidden error, together with a
`warning` field set to `"insufficient permissions"`.
  (Violation: 500 response on Forbidden from the k8s API)

**O3** — When `rbacHidden > 0`, the `/instances` page and the RGD detail Instances tab
MUST display a visible inline note: "N RGDs hidden — insufficient permissions".
  (Violation: no visible indicator when rbacHidden > 0)

**O4** — The Go unit test suite MUST include a test case where:
  (a) One RGD returns Forbidden on instance list → `rbacHidden` = 1 in ListAllInstances response
  (b) ListInstances returns 200+empty with `warning` on Forbidden

**O5** — The E2E journey (test/e2e/journeys/074-partial-rbac.spec.ts) MUST:
  Mock a 403/Forbidden error on one RGD's instance list endpoint via MSW or direct
  API interception, then verify:
  - The `/instances` page renders without error
  - The "N RGDs hidden" indicator is visible

---

## Zone 2 — Implementer's judgment

- Which pages show the indicator: `/instances` (InstancesPage) and RGD detail Instances tab
- Indicator style: inline note below the filter bar, using existing `--color-text-muted` token
- rbacHidden count: incremented when the error string contains "forbidden" (case-insensitive)
  OR when k8s.io/apimachinery IsAccessDenied or IsForbidden returns true
- No new design tokens needed — use existing muted text styling

---

## Zone 3 — Scoped out

- Per-namespace RBAC breakdown (which specific namespaces are hidden)
- Server-side RBAC remediation suggestions
- Changes to AccessTab / RBAC visualizer (different feature)
- ListRGDs endpoint RBAC handling (different endpoint)

---

## Tasks

- [x] Write spec
- [ ] Backend: add `RBACHidden int` to `ListAllInstancesResponse`; increment on Forbidden errors
- [ ] Backend: `ListInstances` returns 200 + `warning: "insufficient permissions"` on Forbidden
- [ ] Backend: Go unit tests for both handlers (O4)
- [ ] Frontend: `ListAllInstancesResponse` type adds `rbacHidden?`; `ListInstances` response adds `warning?`
- [ ] Frontend: show "N RGDs hidden — insufficient permissions" when `rbacHidden > 0` on `/instances` page
- [ ] Frontend: show same indicator on RGD detail Instances tab when warning is set
- [ ] E2E: add journey 074-partial-rbac.spec.ts (O5)
- [ ] Update design doc 27-stage3-kro-tracking.md (🔲 → ✅)
- [ ] Build, test, lint, commit, open PR
