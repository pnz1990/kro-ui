# tasks — issue-534: RGD list bulk export

## Phase 1 — Read context
- [x] [CMD] Read AGENTS.md, constitution, design doc 28
- [x] [AI]  Confirm delete is out of scope (read-only constraint); export only
- [x] [AI]  Write spec.md

## Phase 2 — Frontend implementation
- [ ] [AI]  Add selection state to Home.tsx: `selectionMode`, `selectedNames` Set
- [ ] [AI]  Add checkbox overlay to RGDCard (prop: `selectable`, `selected`, `onToggle`)
- [ ] [AI]  Add selection toolbar to Home.tsx: "Select", "Select all", "Export YAML" button
- [ ] [AI]  Implement `exportSelectedRGDs()`: fetch full RGD YAML per name, strip fields, concat, download
- [ ] [AI]  CSS for checkbox overlay, toolbar styles using tokens

## Phase 3 — Tests
- [ ] [AI]  Unit test RGDCard with selectable prop
- [ ] [AI]  Unit test Home selection logic / export function

## Phase 4 — Validate
- [ ] [CMD] make build (bun typecheck + go build)
- [ ] [CMD] GOPROXY=direct GONOSUMDB="*" go test ./... -race -count=1
- [ ] [CMD] go vet ./...

## Phase 5 — Ship
- [ ] [AI]  Update docs/design/28-rgd-display.md (🔲 → ✅)
- [ ] [AI]  Commit and push
- [ ] [AI]  Open PR
