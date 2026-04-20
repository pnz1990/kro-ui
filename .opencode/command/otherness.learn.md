---
description: "Learn from open-source projects and internalize patterns into otherness skills. Pass repo URLs as arguments, or run without arguments to discover targets autonomously. Safe to run periodically."
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

Read and follow `$AGENTS_PATH/otherness.learn.md`.

Pass any repo arguments from the user directly to the agent as `$ARGUMENTS`.
