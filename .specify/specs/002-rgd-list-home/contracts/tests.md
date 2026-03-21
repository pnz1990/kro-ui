# Test Contracts: RGD List — Home Page

**Spec**: `002-rgd-list-home`
**Date**: 2026-03-20

---

## Testing Framework

- **Runner**: Vitest 4.x
- **DOM**: jsdom 29.x
- **Components**: @testing-library/react 16.x
- **Matchers**: @testing-library/jest-dom (via vitest entry point)
- **Style**: No snapshot tests. Assertion-based with RTL queries.

---

## Unit Tests: `format.ts`

**File**: `web/src/lib/format.test.ts`

### `formatAge` tests

```
describe('formatAge')
  it('returns Unknown for empty string')
  it('returns Unknown for invalid date string')
  it('returns 0s for future timestamp')
  it('returns seconds for <1 minute elapsed')
  it('returns minutes for <1 hour elapsed')
  it('returns hours for <1 day elapsed')
  it('returns days for >=1 day elapsed')
```

Note: Tests must use `vi.useFakeTimers()` and `vi.setSystemTime()` for
deterministic `Date.now()`.

### `extractReadyStatus` tests

```
describe('extractReadyStatus')
  it('returns ready when Ready=True condition exists')
  it('returns error when Ready=False condition exists')
  it('returns unknown when Ready=Unknown condition exists')
  it('returns unknown when no Ready condition in array')
  it('returns unknown when conditions is not an array')
  it('returns unknown when status field is missing')
  it('returns unknown for empty object')
  it('includes reason and message when present')
  it('returns empty reason and message when absent')
```

### `extractRGDName` tests

```
describe('extractRGDName')
  it('returns name from metadata')
  it('returns empty string when metadata missing')
  it('returns empty string when name is not a string')
```

### `extractRGDKind` tests

```
describe('extractRGDKind')
  it('returns kind from spec.schema.kind')
  it('returns empty string when spec missing')
  it('returns empty string when schema missing')
  it('returns empty string when kind is not a string')
```

### `extractResourceCount` tests

```
describe('extractResourceCount')
  it('returns length of spec.resources array')
  it('returns 0 when spec missing')
  it('returns 0 when resources is not an array')
```

### `readyStateColor` tests

```
describe('readyStateColor')
  it('returns --color-status-ready for ready')
  it('returns --color-status-error for error')
  it('returns --color-status-unknown for unknown')
```

---

## Unit Tests: `StatusDot`

**File**: `web/src/components/StatusDot.test.tsx`

```
describe('StatusDot')
  it('renders green dot when state is ready')
    → assert: element has class 'status-dot--ready'
  it('renders red dot when state is error')
    → assert: element has class 'status-dot--error'
  it('renders gray dot when state is unknown')
    → assert: element has class 'status-dot--unknown'
  it('shows reason and message in title tooltip')
    → assert: title attribute contains reason and message
  it('shows state label in title when no reason')
    → assert: title attribute contains state label
  it('has appropriate aria-label for accessibility')
    → assert: aria-label contains state description
```

---

## Unit Tests: `Home`

**File**: `web/src/pages/Home.test.tsx`

### Test Setup

All Home tests must wrap the component in `<MemoryRouter>` because RGDCard
uses `<Link>`. API calls are mocked via `vi.mock('@/lib/api')`.

```
describe('Home')
  it('shows skeleton cards while loading')
    → mock listRGDs to return a never-resolving promise
    → assert: 3 skeleton cards visible (aria-hidden="true")

  it('renders one card per RGD item')
    → mock listRGDs to resolve with 3 items
    → assert: 3 elements with data-testid="rgd-card-*"

  it('shows empty state when items is empty')
    → mock listRGDs to resolve with { items: [], metadata: {} }
    → assert: text "No ResourceGraphDefinitions found"
    → assert: link to kro.run/docs

  it('shows error state and retry button on fetch failure')
    → mock listRGDs to reject with Error('connection refused')
    → assert: text "connection refused"
    → assert: button "Retry" is visible

  it('retries fetch when Retry button is clicked')
    → mock listRGDs to reject first, resolve second
    → click Retry button
    → assert: cards render on second call

  it('renders card names correctly')
    → mock listRGDs with known metadata.name values
    → assert: data-testid="rgd-name" elements contain expected names
```

---

## Unit Tests: `RGDCard`

**File**: `web/src/components/RGDCard.test.tsx`

### Test Setup

Must wrap in `<MemoryRouter>` for `<Link>` components.

```
describe('RGDCard')
  it('displays RGD name')
    → pass K8sObject with metadata.name='test-app'
    → assert: text 'test-app' visible

  it('displays kind badge when kind exists')
    → pass K8sObject with spec.schema.kind='TestApp'
    → assert: text 'TestApp' visible

  it('omits kind badge when kind is missing')
    → pass K8sObject without spec.schema.kind
    → assert: no element with data-testid="rgd-kind"

  it('displays resource count')
    → pass K8sObject with spec.resources array of length 3
    → assert: text containing '3' visible

  it('displays formatted age')
    → use vi.useFakeTimers(), pass known creationTimestamp
    → assert: age text matches expected format

  it('renders Graph link with correct href')
    → pass K8sObject with name='test-app'
    → assert: Link points to '/rgds/test-app'

  it('renders Instances link with correct href')
    → pass K8sObject with name='test-app'
    → assert: Link points to '/rgds/test-app?tab=instances'

  it('URL-encodes special characters in name')
    → pass K8sObject with name containing special chars
    → assert: Link href is properly encoded

  it('renders correct status dot state')
    → pass K8sObject with Ready=True condition
    → assert: status dot has 'ready' class
```

---

## Unit Tests: `SkeletonCard`

**File**: `web/src/components/SkeletonCard.test.tsx`

```
describe('SkeletonCard')
  it('renders with aria-hidden for accessibility')
    → assert: root element has aria-hidden="true"

  it('renders placeholder elements')
    → assert: placeholder line elements exist
```

---

## Unit Tests: `TopBar`

**File**: `web/src/components/TopBar.test.tsx`

```
describe('TopBar')
  it('displays context name')
    → pass contextName='minikube'
    → assert: text 'minikube' visible

  it('truncates long context names')
    → pass contextName longer than 40 chars
    → assert: displayed text ends with '…'
    → assert: title attribute contains full name

  it('does not truncate short context names')
    → pass contextName='minikube'
    → assert: displayed text equals 'minikube'
    → assert: title attribute equals 'minikube'

  it('displays kro-ui branding')
    → assert: text 'kro-ui' visible
    → assert: logo img exists
```

---

## Unit Tests: `Layout`

**File**: `web/src/components/Layout.test.tsx`

### Test Setup

Must use `<MemoryRouter>` with routes defined to verify Outlet rendering.
Mock `listContexts` from api.ts.

```
describe('Layout')
  it('renders child route via Outlet')
    → set up MemoryRouter with Layout wrapping a test child component
    → mock listContexts to resolve
    → assert: child component content is visible

  it('renders TopBar with context name')
    → mock listContexts to resolve with active='minikube'
    → assert: TopBar displays 'minikube'

  it('handles context fetch failure gracefully')
    → mock listContexts to reject
    → assert: TopBar renders (with empty context name)
    → assert: child route still renders (no blocking error)
```

---

## E2E Journey

**File**: `test/e2e/journeys/002-home-page.spec.ts`

See spec.md "E2E User Journey" section for the full journey definition.
The E2E test is a separate concern from unit tests and runs against a real
kind cluster with a real kro installation.

Tests covered by E2E (NOT duplicated in unit tests):
- Full page load with real API
- React Router navigation (Graph/Instances buttons)
- Browser Back button behavior
- Context name display from real kubeconfig

Tests NOT covered by E2E (unit tests only):
- Skeleton/loading/error/empty states
- Status dot color for all 3 states
- Tooltip content
- Edge cases (missing fields, special characters)
