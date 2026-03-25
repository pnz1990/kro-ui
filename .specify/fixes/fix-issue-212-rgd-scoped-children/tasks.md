# Fix: GetInstanceChildren fans out to all API types — throttling on EKS/GKE

**Issue(s)**: #212
**Branch**: fix/issue-212-rgd-scoped-children
**Labels**: bug

## Root Cause

ListChildResources enumerates all ~90–200 API types and fans out one goroutine
per type with a 2s deadline. On EKS, custom-resource List calls take ~1.1–1.5s
due to throttling. With 90+ concurrent goroutines the throttled calls routinely
exceed 2s and are dropped, producing empty/incomplete children lists.

## Files changed

- internal/k8s/rgd.go — ListChildResourcesForRGD, rgdResourceGVRs, listWithLabelSelector
- internal/api/handlers/instances.go — GetInstanceChildren reads ?rgd=
- internal/api/handlers/discover.go — wrapper updated

## Tasks

### Phase 1 — Fix
- [x] Extract listWithLabelSelector from ListChildResources
- [x] Add package-level gvrEntry type (removed local)
- [x] Add rgdResourceGVRs: extract GVKs from spec.resources[].template
- [x] Add ListChildResourcesForRGD: scoped fan-out with full-discovery fallback
- [x] Update GetInstanceChildren to read ?rgd= and pass to listChildResources
- [x] Update discover.go wrapper signature

### Phase 2 — Tests
- [x] TestRGDResourceGVRs: namespaced, deduplicate, cluster-scoped, missing fields
- [x] TestListChildResourcesForRGD: scoped, fallback-on-error, fallback-on-empty-rgd

### Phase 3 — Verify
- [x] go vet ./...
- [x] go test -race ./internal/...
