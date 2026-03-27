---
description: "Fetch all details for a new kro version and create a comprehensive GitHub issue covering every change kro-ui needs to support it. Usage: /support-kro-version 0.10.0  or  /support-kro-version  (auto-detects latest)"
---

## User Input

```text
$ARGUMENTS
```

## Parse Arguments

1. **Extract target version** from `$ARGUMENTS`.
   - Strip any leading `v` (`v0.10.0` → `0.10.0`)
   - If empty: run the following and pick the newest tag that is newer than the
     currently pinned version:
     ```bash
     curl -sL https://api.github.com/repos/kubernetes-sigs/kro/releases/latest
     ```
   - Store as `$TARGET_VERSION` (e.g. `0.10.0`), `$TARGET_TAG` (e.g. `v0.10.0`)

2. **Detect currently pinned version** from `go.mod`:
   ```bash
   grep "kubernetes-sigs/kro" go.mod
   ```
   Store as `$CURRENT_VERSION` (e.g. `0.9.0`).

3. **Guard**: if `$TARGET_VERSION == $CURRENT_VERSION`, stop and report:
   "kro-ui is already at v$CURRENT_VERSION. Pass a newer version number."

---

## Load Project Context (run once, keep in memory)

4. Read all of the following files — they are required to produce an accurate issue:
   - `AGENTS.md` — architecture rules, spec inventory, known anti-patterns, key file locations
   - `.specify/memory/constitution.md` — non-negotiable rules that constrain every change
   - `go.mod` — current Go dependency versions
   - `internal/k8s/capabilities.go` — current capabilities detection logic and `Baseline()`
   - `internal/k8s/client.go` — hardcoded label/group constants
   - `web/src/lib/features.ts` — TypeScript capability baseline (`BASELINE`)
   - `web/src/lib/api.ts` — `KroCapabilities` TypeScript type
   - `web/src/lib/dag.ts` — node type detection, forEach handling, `extractForEachDisplay`
   - `web/src/lib/highlighter.ts` — known keywords, CEL tokenizer
   - `web/src/components/DocsTab.tsx` — schema documentation rendering
   - `web/src/components/RGDCard.tsx` — RGD card data extraction
   - `web/src/pages/RGDDetail.tsx` — detail header, tab structure
   - `web/src/pages/RGDDetail.tsx:1-50` (imports)
   - `test/e2e/setup/global-setup.ts` — fallback version constants
   - `test/e2e/fixture-state.ts` — fixture readiness state shape

5. **Count skipped E2E tests**:
   ```bash
   grep -r "test\.skip\|\.skip(" test/e2e/journeys/ --include="*.ts" | wc -l
   ```
   Store as `$SKIPPED_TESTS`.

6. **Load existing open issues** to avoid creating duplicates:
   ```bash
   gh issue list --state open --limit 50 --json number,title
   ```

---

## Fetch kro Release Intelligence

7. **Get the GitHub release notes** for `$TARGET_TAG`:
   ```bash
   curl -sL "https://api.github.com/repos/kubernetes-sigs/kro/releases/tags/$TARGET_TAG"
   ```
   Extract: `body` (release notes markdown), `published_at`, `name`.

8. **If release notes are sparse or absent**, fetch the CHANGELOG:
   ```bash
   curl -sL "https://raw.githubusercontent.com/kubernetes-sigs/kro/$TARGET_TAG/CHANGELOG.md" 2>/dev/null | head -300
   ```

9. **Fetch the git diff summary** between the two versions to enumerate changed packages:
   ```bash
   curl -sL "https://api.github.com/repos/kubernetes-sigs/kro/compare/v$CURRENT_VERSION...$TARGET_TAG"
   ```
   From the response, extract:
   - `files` changed (names only — look for `api/`, `pkg/graph/`, `pkg/cel/`, `pkg/features/`, `pkg/metrics/`)
   - `commits` — titles (reveal KREPs, feature flags, breaking changes)
   - Total `ahead_by` commit count

10. **Fetch key changed source files** (≤5 most relevant, based on step 9 diff):
    For each of `api/v1alpha1/resourcegraphdefinition_types.go`,
    `pkg/graph/node.go`, `pkg/features/features.go`, `pkg/cel/`, `pkg/graph/builder.go`:
    ```bash
    curl -sL "https://raw.githubusercontent.com/kubernetes-sigs/kro/$TARGET_TAG/<file_path>"
    ```
    Compare against the current versions in the local Go module cache:
    ```bash
    find ~/go/pkg/mod/github.com/kubernetes-sigs/kro@v$CURRENT_VERSION -name "*.go" -path "*<pattern>*" 2>/dev/null | head -3
    ```
    Focus on:
    - New fields on `ResourceGraphDefinitionSpec`, `SchemaSpec`, `ResourceSpec`
    - New `NodeType` constants in `pkg/graph/node.go`
    - New feature gate names in `pkg/features/features.go`
    - New CEL functions or macros in `pkg/cel/`
    - New API groups (e.g. `internal.kro.run`) from `api/` directory listing

11. **Check for new CRDs** in the target version:
    ```bash
    curl -sL "https://api.github.com/repos/kubernetes-sigs/kro/contents/config/crd/bases?ref=$TARGET_TAG"
    ```
    Compare the list of CRD files against:
    ```bash
    curl -sL "https://api.github.com/repos/kubernetes-sigs/kro/contents/config/crd/bases?ref=v$CURRENT_VERSION"
    ```
    New CRD files = new resource types kro-ui needs to detect and potentially surface.

---

## Deep Analysis — Classify Every Change

12. **For each change discovered** in steps 7–11, classify it into one of:

    | Category | Examples |
    |----------|---------|
    | **🔴 Breaking** | Renamed label keys, removed condition types, changed field paths, renamed API groups |
    | **🟡 New API field** | New field on RGD spec/status (e.g. `scope`, `types`, `lastIssuedRevision`) |
    | **🟢 New CRD** | New kro-managed resource type (e.g. `GraphRevision`) |
    | **🔵 New feature gate** | New entry in `pkg/features/features.go` |
    | **⚪ New CEL function** | New library or macro in `pkg/cel/` |
    | **🏗 Infrastructure** | Version string updates, fixture regeneration, E2E skip removal |

    For each classified change, determine its kro-ui impact using the project context
    from step 4. Concretely map each change to:

    - Which Go files need updating (`internal/k8s/capabilities.go`, handlers, etc.)
    - Which TypeScript/React files need updating (`api.ts`, `features.ts`, component files)
    - Whether new E2E journeys are needed
    - Whether existing E2E `test.skip` guards can be removed
    - Whether the `make dump-fixtures` command needs to be re-run
    - Whether `AGENTS.md`, `README.md`, or spec docs need updating

13. **Identify hardcoded version strings** that need bumping:
    ```bash
    grep -rn "0\.$CURRENT_VERSION\|v0\.$CURRENT_VERSION\|FALLBACK.*$CURRENT_VERSION" \
      test/e2e/setup/global-setup.ts scripts/ README.md Makefile \
      --include="*.ts" --include="*.sh" --include="*.md" --include="Makefile" 2>/dev/null
    ```

---

## Draft the GitHub Issue

14. **Compose the issue body** using this exact structure (fill in all `<...>` with real content):

```markdown
## Context

kro v$TARGET_VERSION was released on <date from step 7>. This issue is the comprehensive
tracking item for everything kro-ui needs to absorb.

**Current kro-ui dependency**: `v$CURRENT_VERSION`
**Target**: `v$TARGET_VERSION`
**Release**: <GitHub release URL>
**Commits ahead**: <count from step 9>

---

## What changed in kro v$TARGET_VERSION — full feature inventory

### 🔴 Breaking / behaviour changes that affect the UI today

<For each breaking change found in step 12:>
| Change | Source | Impact on kro-ui |
|--------|--------|-----------------|
| **<change name>** | <PR/commit ref> | <specific files and what must change> |

<If none found:>
No breaking changes detected. Verify by running `make go` and `go test -race ./...` after
bumping the go.mod dependency.

---

### 🟡 New API fields on existing types

<For each new field on ResourceGraphDefinitionSpec, SchemaSpec, etc.:>
#### **`<field name>`** — <one-line description>

<2-3 sentences explaining what it does and when it's set.>

Work needed in kro-ui:
- `internal/k8s/capabilities.go`: add `Has<Field> bool` to `SchemaCapabilities`; detect
  via CRD schema introspection (same pattern as `HasScope`, `HasTypes`)
- `internal/k8s/capabilities.go` `Baseline()`: add `Has<Field>: false`
- `web/src/lib/api.ts`: add `has<Field>: boolean` to `KroCapabilities.schema`
- `web/src/lib/features.ts` `BASELINE`: add `has<Field>: false`
- `web/src/components/<Component>.tsx`: surface the field when capability is true
- `test/e2e/journeys/<NN>-kro-v<version>-upgrade.spec.ts`: E2E coverage

---

### 🟢 New CRDs

<For each new CRD found in step 11:>
#### **`<resource.group/version>`** — <kind name>

<What it represents. How kro creates/manages it. When it appears.>

Work needed:
- `internal/k8s/capabilities.go`: add `Has<Kind>s bool` to `SchemaCapabilities`;
  detect via `disc.ServerResourcesForGroupVersion("<group/version>")`
- `internal/api/handlers/<resource>.go`: **NEW FILE** — `List<Kind>s`, `Get<Kind>`
- `internal/server/server.go`: register routes
- `web/src/lib/api.ts`: add `list<Kind>s()`, `get<Kind>()` API functions
- Spec `<NNN>-<name>` (if applicable): now unblocked

---

### 🔵 New feature gates

<For each new entry in pkg/features/features.go:>
#### **`<FeatureName>`** (Alpha/Beta, default: <on/off>)

<What the feature does. Impact on kro-ui when enabled vs disabled.>

Work needed:
- `internal/k8s/capabilities.go` `Baseline()`: add `"<FeatureName>": false` to `featureGates`
- `web/src/lib/features.ts` `BASELINE.featureGates`: add `<FeatureName>: false`
- Gate any UI surface with `capabilities.featureGates.<FeatureName>`

---

### ⚪ New CEL functions / macros

<For each new CEL library/function found in pkg/cel/:>
- `web/src/lib/highlighter.ts` `KRO_KEYWORDS` or tokenizer: add `<function>` to recognised identifiers
  so CEL expressions containing it don't render as plain text
- `test/e2e/journeys/<NN>-cel-<name>.spec.ts`: regression guard

<If the upstream-cel-comprehensions fixture already covers this, note it.>

---

## Infrastructure and CI changes required

### 1. Bump fallback version strings

| File | Location | Current | Should be |
|------|----------|---------|-----------|
<For each file found in step 13:>
| `<file>` | Line <N> | `<current string>` | `"<new string>"` |

### 2. Bump `go.mod` dependency

```bash
GOPROXY=direct GONOSUMDB="*" go get github.com/kubernetes-sigs/kro@v$TARGET_VERSION
GOPROXY=direct GONOSUMDB="*" make tidy
make go
GOPROXY=direct GONOSUMDB="*" go test -race ./...
```

### 3. Regenerate upstream fixtures

All `test/e2e/fixtures/upstream-*.yaml` files are generated by `make dump-fixtures`.
Re-run after the `go.mod` bump:

```bash
GOPROXY=direct GONOSUMDB="*" make dump-fixtures
git diff test/e2e/fixtures/upstream-*.yaml   # review for structural changes
```

### 4. Remove E2E skip guards

There are currently **$SKIPPED_TESTS** skipped E2E test steps. After the `go.mod` bump
and fixture regeneration, audit each `test.skip` for version-gated features that are now
available:

```bash
grep -r "test\.skip\|\.skip(" test/e2e/journeys/ --include="*.ts" | grep -v "\.skip(!fixtureState"
```

<List specific journey files and step numbers where skips can be removed.>

---

## New E2E journeys required

| Journey file | Covers |
|-------------|--------|
| `test/e2e/journeys/<NN>-kro-v<version>-upgrade.spec.ts` | All P1 user stories above |
<Any additional specific journeys if new CRDs or features warrant their own file>

---

## Files to update — complete checklist

### Backend (Go)
- [ ] `go.mod` / `go.sum` — bump `github.com/kubernetes-sigs/kro` to `v$TARGET_VERSION`
- [ ] `internal/k8s/capabilities.go` — new `SchemaCapabilities` fields + `Baseline()` + detection goroutines
- [ ] `internal/k8s/capabilities_test.go` — new tests for each new capability
- [ ] `internal/k8s/client.go` — new GVR constants for any new CRDs
<For each new CRD:>
- [ ] `internal/api/handlers/<resource>.go` — NEW: handler file
- [ ] `internal/api/handlers/<resource>_test.go` — NEW: handler tests
- [ ] `internal/server/server.go` — register new routes

### Frontend (TypeScript/React)
- [ ] `web/src/lib/api.ts` — new fields in `KroCapabilities.schema`; new API functions
- [ ] `web/src/lib/features.ts` — `BASELINE` schema + featureGates
- [ ] `web/src/lib/features.test.ts` — baseline shape assertions
- [ ] `web/src/lib/highlighter.ts` — new CEL function identifiers (if any)
- [ ] `web/src/lib/highlighter.test.ts` — regression tests for new CEL functions
- [ ] `web/src/tokens.css` — new CSS tokens for any new badges/chips
<For each new field surfaced:>
- [ ] `web/src/components/<Component>.tsx` — render new field
- [ ] `web/src/components/<Component>.css` — badge/chip styles
- [ ] `web/src/pages/RGDDetail.tsx` — new chips in header (if status fields)
- [ ] `web/src/pages/RGDDetail.css` — chip styles

### Tests
- [ ] `internal/k8s/capabilities_test.go` — TestDetects<NewCapability>
- [ ] `web/src/lib/features.test.ts` — BASELINE field assertions
- [ ] `web/src/pages/RGDDetail.logic.test.ts` — extraction logic for new status fields (if any)
- [ ] `web/src/lib/schema.test.ts` — `buildSchemaDoc` with new schema fields (if any)

### E2E
- [ ] `test/e2e/setup/global-setup.ts` — bump `FALLBACK_VERSION`
- [ ] `test/e2e/journeys/008-feature-flags.spec.ts` — add new capability fields to type + assertions
- [ ] `test/e2e/journeys/036-rgd-detail-header.spec.ts` — new badge/chip steps (if applicable)
- [ ] `test/e2e/journeys/020-schema-doc-generator.spec.ts` — new section steps (if applicable)
- [ ] `test/e2e/journeys/<NN>-kro-v<version>-upgrade.spec.ts` — NEW: comprehensive journey
- [ ] Remove `test.skip` guards for features now available in `v$TARGET_VERSION`

### Docs & specs
- [ ] `AGENTS.md` — add spec to inventory table; update Recent Changes (`v0.X.Y` entry)
- [ ] `README.md` — update API table with new endpoints; update Features section
- [ ] `.specify/specs/009-rgd-graph-diff/spec.md` — update status if now unblocked
<For any previously blocked specs that this version unblocks:>
- [ ] `.specify/specs/<NNN>-<name>/spec.md` — update status to Unblocked

---

## Implementation approach

This work should be done in a single spec branch `<NN>-kro-v<version_underscored>-upgrade`
(e.g. `046-kro-v090-upgrade` for v0.9.0, `047-kro-v100-upgrade` for v1.0.0).

**Recommended phase order** (mirrors spec 046 which upgraded v0.8.5 → v0.9.0):

1. **Phase 1: Foundation** — `go.mod` bump, `make tidy`, `make dump-fixtures`, build passes
2. **Phase 2: Capabilities** — `SchemaCapabilities` + `Baseline()` Go + TS types + tests
3. **Phase 3: New CRD API** (if any) — handler + routes + TS client functions
4. **Phase 4: UI surface** — badges, chips, new sections (one user story per phase)
5. **Phase 5: E2E** — new journey + skip removal + existing journey updates
6. **Phase 6: Docs** — `AGENTS.md`, `README.md`, spec status updates

**Reference implementation**: spec `046-kro-v090-upgrade` (branch `046-kro-v090-upgrade`)
is the canonical example of how a kro version upgrade is done in this project.
Read `.specify/specs/046-kro-v090-upgrade/spec.md` and `tasks.md` before starting.
```

---

## Create the Issue

15. **Before creating**, check for a duplicate:
    ```bash
    gh issue list --state open --search "kro v$TARGET_VERSION" --json number,title
    ```
    If a matching issue already exists: display its URL and stop — do not create a duplicate.

16. **Create the issue**:
    ```bash
    gh issue create \
      --title "kro v$TARGET_VERSION upgrade — full audit, new feature surface, CI, fixtures" \
      --body "$(cat <<'ISSUEBODY'
    <full body from step 14>
    ISSUEBODY
    )" \
      --label "enhancement"
    ```

17. **Report the result**:

    ```
    ## Issue created: kro v$TARGET_VERSION upgrade

    URL: <issue URL>
    Title: kro v$TARGET_VERSION upgrade — full audit, new feature surface, CI, fixtures

    Changes detected: <N breaking, N new fields, N new CRDs, N new feature gates, N new CEL functions>
    Files to change: <N>
    E2E skips to remove: <count>
    Hardcoded version strings to bump: <count>

    Next steps:
      1. wt switch --create <NN>-kro-v<version_underscored>-upgrade
      2. /speckit.plan (after writing spec.md)
      3. /speckit.tasks
      4. /speckit.implement
    ```

---

## Error Handling

- **GitHub API rate limited**: fall back to fetching the raw CHANGELOG from the repo instead
- **No release for `$TARGET_TAG`**: report "No release found for $TARGET_TAG — check the tag name"
- **Version already pinned**: stop with "Already at v$CURRENT_VERSION"
- **go.mod not found**: stop with "Not a kro-ui repo — go.mod not found"
- **Duplicate issue found**: report its URL and stop — never create duplicates
- **Network unavailable**: report which fetches failed and produce a partial issue with
  `[NEEDS MANUAL RESEARCH]` markers in sections that could not be auto-populated
