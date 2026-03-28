# Feature Specification: Global Instance Search

**Feature Branch**: `058-global-instance-search`
**Created**: 2026-03-28
**Status**: In Progress

---

## Context

The current UI has no cross-RGD instance view. If you know an instance name but
not its RGD, you must scroll through 27 RGD cards. With 73+ instances across
27 RGDs, this is unusable. An operator troubleshooting a specific CR has no way
to search for it.

## Design

### Backend: `GET /api/v1/instances`

Fan-out across all active RGDs (one goroutine per RGD, 2s deadline each).
Returns a flat list of compact `InstanceSummary` objects:

```json
{
  "items": [
    {
      "name": "webapp-api-gateway",
      "namespace": "kro-ui-demo",
      "kind": "WebApp",
      "rgdName": "test-app",
      "state": "Active",
      "ready": "True",
      "creationTimestamp": "2026-03-27T10:16:00Z"
    }
  ],
  "total": 73
}
```

Cached at 10s TTL (same as per-RGD instance list).
Flushed on context switch (from spec 057).

### Frontend: `/instances` page

New top-nav link "Instances" between Fleet and Events.
Full-width sortable table: status dot | name | namespace | kind | RGD | age.
Free-text search across all 4 text fields.
Clickable rows navigate to `/rgds/{rgd}/instances/{ns}/{name}`.
RGD column is a separate link to the RGD detail page.

---

## Acceptance Criteria

- [ ] `GET /api/v1/instances` returns flat list with all active instances
- [ ] Fan-out respects 2s per-RGD timeout
- [ ] `/instances` page renders a sortable table
- [ ] Search filters by name, namespace, kind, or rgdName
- [ ] Clicking a row navigates to instance detail
- [ ] `tsc --noEmit` and `go vet` and `go test -race` pass
- [ ] E2E journey step verifies page loads with instances
