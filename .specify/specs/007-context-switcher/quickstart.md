# Quickstart: Context Switcher

**Feature**: 007-context-switcher
**Date**: 2026-03-20

## Overview

This feature adds a dropdown to the TopBar that lets operators switch
kubeconfig contexts without restarting the server. The backend API is fully
implemented — the remaining work is the frontend `ContextSwitcher` component,
its integration into `TopBar`/`Layout`, and tests.

---

## Prerequisites

- kro-ui running with a kubeconfig containing 2+ contexts
- `bun` installed for frontend development
- Existing specs 001–006 merged (002 specifically provides the TopBar)

## Quick Verification

### Backend (already done)

```bash
# Verify backend tests pass
make tidy
go test -race ./internal/k8s/... ./internal/api/handlers/...

# Start the server
make build && bin/kro-ui serve

# Test context list
curl http://localhost:40107/api/v1/contexts | jq

# Test context switch
curl -X POST http://localhost:40107/api/v1/contexts/switch \
  -H 'Content-Type: application/json' \
  -d '{"context": "your-other-context"}' | jq
```

### Frontend (to implement)

```bash
cd web
bun install
bun run dev          # starts Vite dev server with API proxy
bun run typecheck    # TypeScript strict check
bun run test         # Vitest unit tests
```

## Integration Scenario

### Happy Path: Switch Context

1. User opens kro-ui at `http://localhost:40107`
2. TopBar shows the active context name (e.g., `minikube`)
3. User clicks the context name area → dropdown opens
4. Dropdown lists all contexts; active one has a checkmark
5. User clicks `production` → dropdown closes, spinner shown in trigger
6. POST `/api/v1/contexts/switch` with `{"context": "production"}`
7. On 200: TopBar updates to `production`, Home page RGD list refetches
8. New RGD data from `production` cluster renders in the card grid

### Error Path: Unreachable Context

1. User selects a context whose cluster is unreachable
2. POST returns 400 with error message
3. Trigger button shows error text (red, `--color-error`)
4. TopBar context name stays on the previous context
5. Error clears on next dropdown open

### Edge: Long EKS ARN

1. Context name is `arn:aws:eks:us-west-2:123456789012:cluster/staging`
2. TopBar shows `…/staging` (extracted suffix after last `/`)
3. Full ARN visible in `title` tooltip on hover

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `web/src/components/ContextSwitcher.tsx` | CREATE | Dropdown component |
| `web/src/components/ContextSwitcher.css` | CREATE | Dropdown styles |
| `web/src/components/ContextSwitcher.test.tsx` | CREATE | Unit tests |
| `web/src/components/TopBar.tsx` | UPDATE | Integrate ContextSwitcher |
| `web/src/components/TopBar.css` | UPDATE | Positioning for switcher |
| `web/src/components/TopBar.test.tsx` | UPDATE | Adjust for new interface |
| `web/src/components/Layout.tsx` | UPDATE | Pass contexts + onSwitch |
| `web/src/components/Layout.test.tsx` | UPDATE | Test switch flow |
| `test/e2e/journeys/007-context-switcher.spec.ts` | CREATE | E2E journey |
