---
description: "Bounded standalone agent. Inject your scope in the prompt — multiple sessions can run concurrently without conflicts. Each creates its own GitHub progress issue."
---

```bash
AGENTS_PATH=$(python3 -c "
import re, os
section = None
for line in open('otherness-config.yaml'):
    s = re.match(r'^(\w[\w_]*):', line)
    if s: section = s.group(1)
    if section == 'maqa':
        m = re.match(r'^\s+agents_path:\s*[\"\'']?([^\"\'#\n]+)[\"\'']?', line)
        if m: print(os.path.expanduser(m.group(1).strip())); break
" 2>/dev/null || echo "$HOME/.otherness/agents")
```

Read and follow `$AGENTS_PATH/bounded-standalone.md`.

## How to use

Start with `/otherness.run.bounded` and paste a boundary block in your prompt.

A boundary block defines the agent's scope. The agent reads these fields and
stays within them for the entire session. Multiple boundary blocks can run
concurrently — each session owns different packages and issues.

## Boundary block format

```
AGENT_NAME=<Human-readable name, e.g. "API Agent">
AGENT_ID=STANDALONE-<SHORT-ID>
SCOPE=<One sentence describing what this agent may work on>
ALLOWED_AREAS=<comma-separated area/* labels this agent may claim>
ALLOWED_MILESTONES=<comma-separated milestone titles, or empty for all>
ALLOWED_PACKAGES=<comma-separated package/directory paths this agent may modify>
DENY_PACKAGES=<comma-separated paths this agent must never touch>
```

## Example boundaries (adapt to your project's structure)

**Feature agent** — works on a specific feature area:
```
AGENT_NAME=Feature Agent
AGENT_ID=STANDALONE-FEATURE
SCOPE=<area of the codebase this agent owns>
ALLOWED_AREAS=area/feature-name
ALLOWED_MILESTONES=v1.0
ALLOWED_PACKAGES=pkg/feature,cmd/feature
DENY_PACKAGES=pkg/core,api/v1,web/src
```

**API agent** — new endpoints and types only:
```
AGENT_NAME=API Agent
AGENT_ID=STANDALONE-API
SCOPE=API layer — new endpoints, request/response types, validation
ALLOWED_AREAS=area/api
ALLOWED_MILESTONES=
ALLOWED_PACKAGES=api/,pkg/handlers
DENY_PACKAGES=pkg/storage,web/src,cmd/
```

**Refactor agent** — clean up existing code without adding features:
```
AGENT_NAME=Refactor Agent
AGENT_ID=STANDALONE-REFACTOR
SCOPE=Refactoring only — no new features, no schema changes
ALLOWED_AREAS=area/refactor,area/chore
ALLOWED_MILESTONES=
ALLOWED_PACKAGES=pkg/
DENY_PACKAGES=api/,web/src,cmd/
```

See `boundaries/example.boundary` and `boundaries/README.md` for more detail.
