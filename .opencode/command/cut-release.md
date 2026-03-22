---
description: "Cut a new semver release: bumps version, updates README/Helm/AGENTS, creates goreleaser config if missing, tags, and pushes to trigger CI release pipeline. Usage: /cut-release  (auto-increments patch)  or  /cut-release minor  or  /cut-release major"
---

## User Input

```text
$ARGUMENTS
```

## Parse Arguments

1. **Parse bump type** from `$ARGUMENTS` (default `patch` if empty):
   - `major` → bump X in vX.Y.Z
   - `minor` → bump Y in vX.Y.Z
   - `patch` → bump Z in vX.Y.Z
   - Any other value: report error and stop

2. **Determine current version**:
   ```bash
   git tag --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1
   ```
   - If no tags exist: start at `v0.0.0`, treat next as `v0.1.0` for minor or `v1.0.0` for major

3. **Compute next version** by incrementing the appropriate component and zeroing lower components:
   - `major`: vX+1.0.0
   - `minor`: vX.Y+1.0
   - `patch`: vX.Y.Z+1

4. **Store** as `$PREV_VERSION` and `$NEXT_VERSION` (e.g. `v0.0.0` and `v0.1.0`)

---

## Pre-flight Checks

5. **Ensure on main**:
   ```bash
   git branch --show-current
   ```
   If not on `main`: stop and tell the user to switch to main first.

6. **Ensure main is up to date**:
   ```bash
   git fetch origin && git status
   ```
   If behind origin/main: stop and tell the user to pull first.

7. **Ensure clean working tree** (no uncommitted changes that should be in the release):
   - Warn if there are unstaged modifications to tracked files — ask user if they want to proceed
   - `web/dist/index.html` and `web/tsconfig.tsbuildinfo` are known build artifacts — ignore them silently

8. **Check the tag doesn't already exist**:
   ```bash
   git tag | grep -x "$NEXT_VERSION"
   ```
   If it exists: stop with "Tag $NEXT_VERSION already exists."

---

## Phase 1 — Generate Release Notes

9. **Get all commits since the last tag** (or since the beginning if no prior tag):
   ```bash
   git log $PREV_VERSION..HEAD --oneline --no-merges
   ```
   If no prior tag: `git log --oneline --no-merges`

10. **Categorize commits** by Conventional Commits prefix into sections:
    - `feat(...)` → **Features**
    - `fix(...)` → **Bug Fixes**
    - `chore(...)` → **Maintenance** (skip in user-facing notes unless notable)
    - Anything else → **Other**

11. **Draft the release body** in this format:

    ```markdown
    ## What's New in $NEXT_VERSION

    ### Features
    - <commit message without type prefix> (#PR if present in message)

    ### Bug Fixes
    - <commit message without type prefix>

    ### Maintenance
    - <commit message without type prefix>

    ---

    **Docker image**: `ghcr.io/pnz1990/kro-ui:$NEXT_VERSION`
    **Binary releases**: see Assets below

    ### Quickstart

    ```bash
    # Docker
    docker run -p 40107:40107 \
      -v ~/.kube/config:/root/.kube/config:ro \
      ghcr.io/pnz1990/kro-ui:$NEXT_VERSION

    # Helm
    helm upgrade --install kro-ui oci://ghcr.io/pnz1990/kro-ui/charts/kro-ui \
      --version $NEXT_VERSION_NO_V \
      --namespace kro-system --create-namespace
    ```

    ### Full Changelog
    https://github.com/pnz1990/kro-ui/compare/$PREV_VERSION...$NEXT_VERSION
    ```

    Store this as `$RELEASE_NOTES`.

---

## Phase 2 — Update Version Files

12. **Update `helm/kro-ui/Chart.yaml`** — set both `version` and `appVersion` to `$NEXT_VERSION_NO_V` (strip the `v` prefix):
    - Read the file, replace `version:` and `appVersion:` lines

13. **Update `README.md`** — bring Features section up to date:
    - Replace the **Features** section (between `## Features` and the next `##`) with the current complete feature list derived from merged specs (all specs in AGENTS.md marked Merged).
    - Update any Docker image tags that reference a specific version (e.g. `ghcr.io/pnz1990/kro-ui:v0.0.x` → `ghcr.io/pnz1990/kro-ui:$NEXT_VERSION`)
    - Update the API table to include all current endpoints (cross-reference `internal/server/server.go` for the authoritative list)
    - Remove any "In progress" or "Planned" items from the features section — everything is shipped

14. **Check for `.goreleaser.yaml`** — if it doesn't exist, create it:
    ```bash
    ls .goreleaser.yaml 2>/dev/null || echo "missing"
    ```
    If missing, create `.goreleaser.yaml` with the standard config for this project (see template below).

15. **Update `AGENTS.md`** — set the spec inventory entries to their final merged state, update any stale "Next" markers to "Merged".

---

## Phase 3 — Goreleaser Config (create if missing)

16. If `.goreleaser.yaml` was missing in step 14, create it:

    ```yaml
    # .goreleaser.yaml — goreleaser configuration for kro-ui binary releases.
    # Triggered by the release.yml GitHub Actions workflow on v* tags.
    version: 2

    project_name: kro-ui

    before:
      hooks:
        - make web   # build frontend into web/dist before Go build

    builds:
      - id: kro-ui
        main: ./cmd/kro-ui
        binary: kro-ui
        env:
          - CGO_ENABLED=0
          - GOPROXY=direct
          - GONOSUMDB=*
        goos:
          - linux
          - darwin
          - windows
        goarch:
          - amd64
          - arm64
        ignore:
          - goos: windows
            goarch: arm64
        ldflags:
          - -s -w
          - -X github.com/pnz1990/kro-ui/internal/version.Version={{.Version}}
          - -X github.com/pnz1990/kro-ui/internal/version.Commit={{.Commit}}
          - -X github.com/pnz1990/kro-ui/internal/version.BuildDate={{.Date}}

    archives:
      - id: kro-ui
        name_template: "kro-ui_{{ .Version }}_{{ .Os }}_{{ .Arch }}"
        format_overrides:
          - goos: windows
            formats: [zip]
        files:
          - README.md
          - LICENSE

    checksum:
      name_template: "checksums.txt"
      algorithm: sha256

    changelog:
      use: github
      sort: asc
      filters:
        exclude:
          - "^chore(deps)"
          - "^chore: update AGENTS"
          - "Merge pull request"

    release:
      github:
        owner: pnz1990
        name: kro-ui
      name_template: "kro-ui {{.Version}}"
      # Body is provided by the release workflow via GITHUB_TOKEN; goreleaser
      # appends the auto-generated changelog. The GitHub release body is set
      # separately via `gh release edit` after the workflow completes.
      draft: false
      prerelease: auto

    dockers:
      # Docker image is built and pushed by the release.yml workflow directly
      # (docker/build-push-action). Goreleaser handles binary archives only.
      []
    ```

---

## Phase 4 — Commit, Tag, Push

17. **Stage all changed files**:
    ```bash
    git add helm/kro-ui/Chart.yaml README.md AGENTS.md
    # and .goreleaser.yaml if newly created
    ```

18. **Commit**:
    ```bash
    git commit -m "chore(release): prepare $NEXT_VERSION"
    ```

19. **Tag**:
    ```bash
    git tag -a $NEXT_VERSION -m "Release $NEXT_VERSION"
    ```

20. **Push commit and tag**:
    ```bash
    git push origin main
    git push origin $NEXT_VERSION
    ```

    This triggers `.github/workflows/release.yml` which:
    - Builds frontend (`bun install && bun run build`)
    - Builds and pushes Docker image to `ghcr.io/pnz1990/kro-ui:$NEXT_VERSION` and `:latest`
    - Runs goreleaser to produce binary archives and the GitHub release

---

## Phase 5 — Post-push: Set GitHub Release Body

21. **Wait for the release to be created by CI** (goreleaser creates it), then update the release body with the drafted notes:
    ```bash
    # Poll until the release exists (max 3 minutes)
    for i in $(seq 1 18); do
      gh release view $NEXT_VERSION 2>/dev/null && break
      echo "Waiting for CI to create release... ($i/18)"
      sleep 10
    done
    ```

22. **Update the release body**:
    ```bash
    gh release edit $NEXT_VERSION --notes "$(cat <<'EOF'
    $RELEASE_NOTES
    EOF
    )"
    ```

23. **Report the release URL**:
    ```bash
    gh release view $NEXT_VERSION --web
    ```

---

## Summary Output

After completion, display:

```
## Release $NEXT_VERSION cut

**Tag**: $NEXT_VERSION
**Docker**: ghcr.io/pnz1990/kro-ui:$NEXT_VERSION
**Release**: https://github.com/pnz1990/kro-ui/releases/tag/$NEXT_VERSION

### CI pipeline triggered:
- Docker image build + push to GHCR
- Binary archives (linux/darwin/windows × amd64/arm64) via goreleaser
- GitHub Release with changelog

### Files updated:
- helm/kro-ui/Chart.yaml — version bumped to $NEXT_VERSION_NO_V
- README.md — features, API table, image tags updated
- AGENTS.md — spec inventory finalized
- .goreleaser.yaml — [created|already existed]
```

---

## Error Handling

- **Not on main**: stop — "Switch to main before cutting a release."
- **Dirty working tree with meaningful changes**: warn and ask — "Uncommitted changes detected in [files]. Include them in the release commit? (y/n)"
- **Tag already exists**: stop — "Tag $NEXT_VERSION already exists. Use a different bump type or delete the tag first."
- **Push fails**: stop and report — "Push failed. The tag has been created locally but not pushed. Fix the issue and run: git push origin $NEXT_VERSION"
- **CI release not created within 3 minutes**: skip step 22 and report — "Release not yet created by CI — run this manually once it completes: gh release edit $NEXT_VERSION --notes '...'"
