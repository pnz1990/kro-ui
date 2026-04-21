# Spec: Partial-RBAC Instance Visibility (issue-648)

> Status: Implemented | Author: otherness[bot] | Date: 2026-04-21

## Design reference
- **Design doc**: `docs/design/29-instance-management.md`
- **Section**: `§ Future`
- **Implements**: Partial-RBAC instance visibility (🔲 → ✅)

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

**O3** — When `rbacHidden > 0`, the `/instances` page MUST display a visible inline note:
"N RGDs hidden — insufficient permissions" (`data-testid="instances-rbac-warning"`).
When `ListInstances` returns `warning: "insufficient permissions"`, the RGD detail
Instances tab MUST display a visible inline note: "Instances hidden — insufficient permissions".
(Violation: no visible indicator when rbacHidden > 0 or warning is set)

**O4** — The Go unit test suite MUST include:
- `TestListAllInstances_RBACForbiddenSetsRBACHidden`: one RGD returns Forbidden → rbacHidden=1
- `TestListAllInstances_NoRBACHiddenWhenAllSucceed`: all RGDs succeed → rbacHidden=0
- `TestIsForbiddenError`: table-driven tests for the `isForbiddenError` helper

**O5** — E2E journey 081 (`test/e2e/journeys/081-partial-rbac.spec.ts`) MUST be registered
in a `testMatch` pattern in `playwright.config.ts` and verify the full-access cluster:
- GET /api/v1/instances returns 200 with `rbacHidden` field present (defaults to 0)
- GET /api/v1/rgds/{name}/instances returns 200 with `items` field
- /instances page renders without RBAC warning in normal cluster

---

## Zone 2 — Implementer's judgment

- RBAC hidden count uses atomic int32 for goroutine-safe increment in fan-out
- Frontend advisory uses `--color-text-muted` token with `⚠` prefix
- `isForbiddenError` checks both `k8serrors.IsForbidden` and string match for proxy-wrapped errors
- RGD detail Instances tab shows singular "Instances hidden" (not "N RGDs") since the warning
  comes from a single-RGD endpoint

---

## Zone 3 — Scoped out

- Per-namespace RBAC breakdown (which namespaces are hidden)
- Server-side RBAC remediation suggestions
- Changes to AccessTab / RBAC visualizer
- ListRGDs endpoint RBAC handling
