# Tasks: issue-713 — Designer: Apply to Cluster Action

## Pre-implementation
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-713 && go vet ./... 2>&1 | grep -v "no matching files" | tail -5` — expected: 0 exit or empty

## Implementation

### Backend
- [AI] Add `POST /api/v1/rgds/apply` handler in `internal/api/handlers/rgds.go`
  - Parse raw YAML body → `unstructured.Unstructured`
  - Validate kind == ResourceGraphDefinition and apiVersion == kro.run/v1alpha1
  - Check canApplyRGDs capability gate; return 403 if false
  - Apply via `dynamic.Apply()` with field manager `kro-ui`, force=false
  - Return 201 on create, 200 on update with `{name, message}` body
- [AI] Register route in `internal/server/server.go`: `r.Post("/rgds/apply", h.ApplyRGD)`
- [AI] Add `canApplyRGDs` key to `Baseline().FeatureGates` with value `false`
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-713 && grep -n "ApplyRGD\|rgds/apply" internal/api/handlers/rgds.go internal/server/server.go` — expected: matches

### Frontend
- [AI] Add `applyRGD(yaml: string): Promise<ApplyRGDResult>` to `web/src/lib/api.ts`
- [AI] Add optional `onApply?` prop and `applyResult` / `applyLoading` to `YAMLPreview.tsx`
  - "Apply to cluster" button shown when `onApply` is provided
  - Shows loading state + success/error feedback
- [AI] In `AuthorPage.tsx`, wire `onApply` when `capabilities.featureGates['canApplyRGDs'] === true`
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-713 && grep -n "onApply\|applyRGD\|canApplyRGDs" web/src/lib/api.ts web/src/components/YAMLPreview.tsx web/src/pages/AuthorPage.tsx` — expected: matches

### Tests
- [AI] Write unit tests for `ApplyRGD` handler covering: happy path create (201), happy path update (200), canApplyRGDs=false (403), invalid YAML (400), wrong kind (400)
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-713 && GOPROXY=direct GONOSUMDB="*" go test ./internal/api/handlers/... -run TestApplyRGD -v 2>&1 | tail -20` — expected: PASS

## Post-implementation
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-713 && go vet ./... 2>&1 | grep -v "no matching files" | tail -5` — expected: 0 exit or empty
