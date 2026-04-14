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

## Pre-defined boundaries (copy and paste)

**UI Agent** — React frontend features and E2E journeys:
```
AGENT_NAME=UI Agent
AGENT_ID=STANDALONE-UI
SCOPE=React frontend — new components, pages, hooks, and E2E journey coverage
ALLOWED_AREAS=area/ui,area/test
ALLOWED_PACKAGES=web/src,test/e2e
DENY_PACKAGES=internal,cmd
```

**Backend Agent** — Go API handlers and k8s client:
```
AGENT_NAME=Backend Agent
AGENT_ID=STANDALONE-BACKEND
SCOPE=Go backend — API handlers, k8s dynamic client, cache, server
ALLOWED_AREAS=area/api,area/k8s
ALLOWED_PACKAGES=internal,cmd
DENY_PACKAGES=web/src,test/e2e
```

**Bug Agent** — fix open issues:
```
AGENT_NAME=Bug Agent
AGENT_ID=STANDALONE-BUGS
SCOPE=Bug fixes — resolve open kind/bug issues
ALLOWED_AREAS=area/ui,area/api,area/k8s
ALLOWED_PACKAGES=web/src,internal,cmd,test/e2e
DENY_PACKAGES=
```
