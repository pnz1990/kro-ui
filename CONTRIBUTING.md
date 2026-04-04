# Contributing to kro-ui

kro-ui follows the same contribution model as
[kubernetes-sigs/kro](https://github.com/kubernetes-sigs/kro/blob/main/CONTRIBUTING.md).
Read that guide first; the sections below describe kro-ui-specific workflow on
top of it.

## Code of Conduct

This project follows the
[Kubernetes Community Code of Conduct](https://github.com/kubernetes/community/blob/master/code-of-conduct.md).

## Before You Start

- Check the open issues and the spec inventory in [AGENTS.md](AGENTS.md) to
  understand what is already planned or in progress.
- If your change is a new feature: open an issue first and discuss it before
  writing code. New features are implemented as specs under
  `.specify/specs/<NNN-name>/spec.md`.
- If your change is a bug fix or docs update: you can open a PR directly.

## Development Workflow (spec-driven)

kro-ui uses **spec-driven development**. Every non-trivial feature has a spec
that is reviewed and approved before implementation begins.

```
1. Read AGENTS.md — understand the current spec queue and architecture
2. For new features: write a spec in .specify/specs/<NNN-name>/spec.md
3. Create a worktree:  wt switch --create <branch-name>
4. Read the spec and tasks before writing any code
5. Implement phase-by-phase, marking tasks [x] as you go
6. Run go vet + tsc --noEmit before every commit
7. Push and open a PR targeting main
```

See [AGENTS.md](AGENTS.md) for the full spec inventory and architecture rules.

### Worktree Setup (worktrunk)

```bash
# Install worktrunk if needed (see https://github.com/pnz1990/worktrunk)
wt switch --create my-branch    # creates a sibling worktree + branch
wt list                          # shows all worktrees and URLs
```

All work for a feature/fix happens inside its worktree directory.

## Running Tests

```bash
# Go — always run with -race
GOPROXY=direct GONOSUMDB="*" go test -race ./...

# TypeScript typecheck
cd web && bun run tsc --noEmit

# Frontend unit tests
cd web && bun run vitest run

# Full E2E (requires Docker)
make test-e2e
```

> **Note**: `proxy.golang.org` is blocked in the CI environment. All `go`
> commands that download modules must use `GOPROXY=direct GONOSUMDB="*"`.
> The Makefile targets already set this — prefer `make go` and `make tidy`.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short description in imperative mood, ≤72 chars

Optional body: explain WHY the change is needed, not WHAT.
Reference specs: "Implements spec 001-server-core FR-004."
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`  
**Scopes**: `api`, `k8s`, `server`, `dag`, `highlighter`, `web`, `spec`

Examples:
```
feat(k8s): add discovery cache to ClientFactory — closes #108
fix(web): use key-existence check for falsy defaults in ExampleYAML — closes #106
docs: add CONTRIBUTING.md — closes #110
```

## Pull Request Guidelines

- PRs target `main`
- CI must pass: `build`, `govulncheck`, `CodeQL`, and `e2e` are all required
- 1 approving review required (CODEOWNERS auto-assigns `@pnz1990`)
- Squash merge only — keep the commit history linear
- Reference the issue(s) closed: `Closes #N`
- Keep PRs focused: one feature or one bugfix per PR

## Architecture Rules

The [AGENTS.md](AGENTS.md) and [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
files are the authoritative sources. Key non-negotiables:

- **Read-only**: kro-ui never issues mutating Kubernetes calls
- **No CSS frameworks**: plain CSS with `web/src/tokens.css` custom properties
- **No state management libraries**: plain React state + hooks
- **Discovery must be cached**: ≥30s TTL, never per-request
- **Every handler: 5-second response budget**
- **Graceful degradation**: absent data is "Not reported", never `?` or `undefined`

## License

By contributing, you agree that your contributions will be licensed under the
[Apache License 2.0](LICENSE).
