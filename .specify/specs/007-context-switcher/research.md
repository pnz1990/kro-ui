# Research: Context Switcher

**Feature**: 007-context-switcher
**Date**: 2026-03-20

## Implementation Status Assessment

### Decision: Backend is complete — remaining work is frontend-only

**Rationale**: Thorough codebase analysis confirms all Go backend work specified
in the feature spec is fully implemented and tested:

- `ClientFactory.SwitchContext()` — thread-safe, `sync.RWMutex`-protected,
  validates context exists in kubeconfig, rebuilds dynamic + discovery clients
  atomically (`internal/k8s/client.go`)
- `ClientFactory.ListContexts()` — reads kubeconfig fresh, returns `[]Context`
  structs with name/cluster/user fields
- HTTP handlers — `GET /api/v1/contexts` and `POST /api/v1/contexts/switch`
  fully wired in `internal/api/handlers/contexts.go`
- Routes registered in `internal/server/server.go`
- API types defined in `internal/api/types/response.go`
- Unit tests passing: `client_test.go` (4 test funcs covering unknown context,
  valid switch, concurrent race), `contexts_test.go` (6 sub-cases: valid 200,
  empty 400, unknown 400, invalid JSON 400)

Frontend API functions also exist: `listContexts()` and `switchContext()` in
`web/src/lib/api.ts` with typed interfaces `KubeContext` and `ContextsResponse`.

**Alternatives considered**: Re-auditing backend for gaps — not needed, tests
confirm full coverage of FR-001 through FR-004.

---

## Research Topic 1: Custom Dropdown Component Pattern

### Decision: Build a custom dropdown using native HTML button + positioned div, with ARIA listbox pattern

**Rationale**: Constitution §V prohibits component libraries (Radix, shadcn,
etc.). No existing dropdown pattern exists in the codebase. The ARIA listbox
pattern (`role="listbox"` + `role="option"`) is the standard accessible pattern
for single-selection dropdowns.

**Implementation approach**:
- Trigger: `<button>` with `aria-haspopup="listbox"` and `aria-expanded`
- Menu: `<div role="listbox">` with absolutely positioned children
- Options: `<div role="option" aria-selected>` for each context
- Active context: `aria-selected="true"`, visually marked with checkmark, not
  clickable (click is no-op)
- Keyboard: ArrowUp/ArrowDown navigate, Enter selects, Escape closes
- Click-outside: `useEffect` with `mousedown` event listener on document
- Focus management: focus returns to trigger button on close

**Alternatives considered**:
- Native `<select>` element — rejected because it cannot be styled with
  `tokens.css` custom properties, and the spec requires a checkmark indicator
  on the active context and an inline loading/error state
- `<details>/<summary>` — rejected because it lacks ARIA listbox semantics and
  has inconsistent keyboard behavior across browsers

---

## Research Topic 2: Refetch Strategy After Context Switch

### Decision: Key-based remount via `<Outlet key={activeContext} />`

**Rationale**: The Home page fetches RGD data in a `useEffect` on mount.
There is no shared state, no cache, no context provider for data. Changing
the `key` prop on `<Outlet>` in `Layout.tsx` forces React to unmount all child
route components and remount them fresh, which re-triggers their `useEffect`
data fetches. This is the simplest approach that requires zero changes to
child page components.

The tasks.md already specifies this approach (T013).

**Alternatives considered**:
- React context / global event bus — rejected per §V (no state management
  libraries), and a custom event bus adds complexity with no benefit over
  key-based remount
- Passing a `refreshKey` counter prop — adds unnecessary prop drilling through
  the route tree
- `window.location.reload()` — violates FR-004 (no server restart / page reload)

---

## Research Topic 3: Context Name Truncation for EKS ARNs

### Decision: Smart truncation — extract segment after last `/`, prepend `…/`

**Rationale**: The spec (FR-010, User Story 2) says context names longer than
40 characters should be truncated to show "the most identifiable part (e.g., the
cluster name suffix after the last `/`)". EKS ARN format is:
`arn:aws:eks:us-west-2:123456789012:cluster/staging`

The truncation logic:
1. If `name.length <= 40`: show full name
2. If name contains `/`: show `…/{segment after last /}`
3. Otherwise: show first 37 chars + `…`

The full name is always in the `title` attribute for tooltip access.

The existing `TopBar.tsx` already has a simple 40-char truncation with `…`
suffix. The update will replace this with the smarter algorithm that extracts
the cluster suffix.

**Alternatives considered**:
- Middle truncation (`arn:aws:…/staging`) — more complex, less readable
- Always show last N chars — doesn't leverage the `/` structure of ARNs
- CSS `text-overflow: ellipsis` only — doesn't extract the meaningful suffix

---

## Research Topic 4: CSS Positioning and z-index

### Decision: Position dropdown absolutely relative to the TopBar context area, z-index: 100

**Rationale**: No existing z-index scale in the codebase. The dropdown is the
first (and currently only) overlay element. Using `z-index: 100` provides room
for future overlays (tooltips at 200, modals at 300) without conflicting.

Dropdown positioning:
- Parent wrapper: `position: relative`
- Dropdown panel: `position: absolute; top: 100%; right: 0`
- This places the dropdown directly below the trigger button, aligned right

Uses `--color-surface-2` (documented in tokens.css as "dropdowns, tooltips,
elevated"), `--color-border`, `--radius` for consistent styling.

**Alternatives considered**:
- `position: fixed` with manual coordinates — overkill for a top-bar dropdown
- CSS `popover` API — browser support is sufficient but adds complexity for no
  benefit in a single dropdown

---

## Research Topic 5: Loading and Error States

### Decision: Inline states within the dropdown trigger button and option list

**Rationale**: The spec requires (FR-008, FR-009):
- Loading spinner while switch is in-flight
- Error message on failure, context name does NOT change

Implementation:
- **Loading**: CSS-only spinner animation (keyframe rotate) on a small `<span>`
  inside the trigger button text area. The dropdown closes immediately when a
  context is clicked, and the trigger shows `Switching…` with spinner until the
  POST resolves.
- **Error**: Inline error text below the trigger button (not a toast — toasts
  are not in the design system yet). Red text using `--color-error`. Auto-clears
  on next dropdown open or after 5 seconds.
- **10s timeout**: The `switchContext` fetch uses `AbortController` with a
  10-second timeout per the edge case spec. On timeout, shows "Switch timed out"
  error and reverts.

**Alternatives considered**:
- Toast notification — no toast system exists yet, building one for this spec
  violates §I (iterative-first, ship smallest thing)
- Modal error dialog — overkill for a transient error
- Disable all dropdown interaction during switch — bad UX, user can't cancel or
  retry

---

## Research Topic 6: Test Strategy

### Decision: Unit tests using Vitest + @testing-library/react with vi.mock for API

**Rationale**: Matches existing test patterns in `Layout.test.tsx` and
`TopBar.test.tsx`. The test setup (`web/src/test/setup.ts`) imports
`@testing-library/jest-dom/vitest` for custom matchers. Tests use `vi.mock`
to stub API functions and `vi.mocked` for type-safe access.

Test cases for `ContextSwitcher.test.tsx` (per T007):
1. Renders all context names from mocked API response
2. Active context is marked with `aria-selected="true"`
3. Loading state visible during switch (delayed promise)
4. Error message visible on switch failure (rejected promise)
5. Calls `onSwitch` callback on successful switch

Test updates needed:
- `TopBar.test.tsx` — update for changed props interface (now receives
  `ContextSwitcher` component children instead of just a string)
- `Layout.test.tsx` — update for full context list in state and switch callback

**Alternatives considered**: None — the existing test tooling is well-established.
