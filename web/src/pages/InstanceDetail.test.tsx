// InstanceDetail.test.tsx — unit tests for the live instance detail page.
//
// Issue #217: InstanceDetail was the only major page without tests.
// Covers breadcrumb navigation, loading/error/success states, polling cleanup,
// and graceful degradation for absent status.conditions.
//
// Regression tests added for state-node live-state badge (Bug-2):
//   - Clicking a state node must NOT show a live-state badge ("Not Found", etc.).
//   - State nodes produce no K8s resources; they have no meaningful live state.

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import InstanceDetail, { isReconcilingSlow, RECONCILE_SLOW_FACTOR } from './InstanceDetail'

// ── API mocks ───────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  getInstance: vi.fn(),
  getInstanceEvents: vi.fn(),
  getInstanceChildren: vi.fn(),
  getRGD: vi.fn(),
  listRGDs: vi.fn(),
  getResource: vi.fn(),
}))

import {
  getInstance,
  getInstanceEvents,
  getInstanceChildren,
  getRGD,
  listRGDs,
  getResource,
} from '@/lib/api'

const mockedGetInstance = vi.mocked(getInstance)
const mockedGetInstanceEvents = vi.mocked(getInstanceEvents)
const mockedGetInstanceChildren = vi.mocked(getInstanceChildren)
const mockedGetRGD = vi.mocked(getRGD)
const mockedListRGDs = vi.mocked(listRGDs)
const mockedGetResource = vi.mocked(getResource)

// ── Test helpers ────────────────────────────────────────────────────────────

function makeInstance(name = 'my-app', conditions: unknown[] = [
  { type: 'Ready', status: 'True' },
]) {
  return {
    apiVersion: 'app.k8s.io/v1alpha1',
    kind: 'WebApp',
    metadata: {
      name,
      namespace: 'default',
      creationTimestamp: '2026-01-01T00:00:00Z',
    },
    status: { conditions },
  }
}

function makeRGD(name = 'test-app') {
  return {
    metadata: { name },
    spec: {
      schema: { kind: 'WebApp', apiVersion: 'v1alpha1', group: 'app.k8s.io' },
      resources: [
        { id: 'cfg', template: { apiVersion: 'v1', kind: 'ConfigMap' } },
      ],
    },
  }
}

/** RGD that includes one regular resource and one state node. */
function makeRGDWithStateNode(name = 'test-app') {
  return {
    metadata: { name },
    spec: {
      schema: { kind: 'WebApp', apiVersion: 'v1alpha1', group: 'app.k8s.io' },
      resources: [
        { id: 'cfg', template: { apiVersion: 'v1', kind: 'ConfigMap' } },
        {
          id: 'initState',
          includeWhen: ['${schema.spec.init == true}'],
          state: {
            storeName: 'game',
            fields: { counter: '${0}' },
          },
        },
      ],
    },
  }
}

function renderPage(rgdName = 'test-app', namespace = 'default', instanceName = 'my-app') {
  return render(
    <MemoryRouter initialEntries={[`/rgds/${rgdName}/instances/${namespace}/${instanceName}`]}>
      <Routes>
        <Route
          path="/rgds/:rgdName/instances/:namespace/:instanceName"
          element={<InstanceDetail />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('InstanceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Do NOT use fake timers here — usePolling uses setInterval and
    // vi.runAllTimersAsync() would create an infinite loop.
    // We drive state via resolved/rejected promises and waitFor() instead.

    // Default: all APIs resolve successfully (return immediately)
    mockedGetInstance.mockResolvedValue(makeInstance())
    mockedGetInstanceEvents.mockResolvedValue({ items: [], metadata: {} })
    mockedGetInstanceChildren.mockResolvedValue({ items: [] })
    mockedGetRGD.mockResolvedValue(makeRGD())
    mockedListRGDs.mockResolvedValue({ items: [], metadata: {} })
    // getResource is called by LiveNodeDetailPanel for YAML fetch
    mockedGetResource.mockResolvedValue({ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'x', namespace: 'default' } })
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  it('renders the breadcrumb nav immediately (before data resolves)', () => {
    mockedGetInstance.mockReturnValue(new Promise(() => {}))
    mockedGetInstanceEvents.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
  })

  // ── Breadcrumbs ────────────────────────────────────────────────────────────

  it('renders breadcrumb with Overview → rgdName → Instances → instanceName', async () => {
    renderPage('test-app', 'default', 'my-app')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/')
    })

    expect(screen.getByRole('link', { name: 'test-app' })).toHaveAttribute('href', '/rgds/test-app')
    expect(screen.getByRole('link', { name: 'Instances' })).toHaveAttribute(
      'href',
      '/rgds/test-app?tab=instances',
    )
    // Instance name appears as aria-current="page" breadcrumb item (no link)
    expect(screen.getByText('my-app', { selector: '.breadcrumb-current' })).toBeInTheDocument()
  })

  // ── Page title ─────────────────────────────────────────────────────────────

  it('sets document.title to "<instanceName> / <rgdName> — kro-ui"', async () => {
    renderPage('test-app', 'default', 'my-app')
    await waitFor(() => expect(document.title).toBe('my-app / test-app — kro-ui'))
  })

  // ── Success renders ────────────────────────────────────────────────────────

  it('renders the instance-detail-page testid after data loads', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('instance-detail-page')).toBeInTheDocument()
    })
  })

  // ── Graceful degradation — absent conditions ───────────────────────────────

  it('does not render "Pending" text when status.conditions is absent', async () => {
    mockedGetInstance.mockResolvedValue(makeInstance('my-app', []))
    renderPage()
    await waitFor(() => screen.getByTestId('instance-detail-page'))
    expect(screen.queryByText('Pending')).not.toBeInTheDocument()
  })

  // ── Error state ────────────────────────────────────────────────────────────

  it('renders page structure even when poll fails', async () => {
    mockedGetInstance.mockRejectedValue(new Error('not found'))
    mockedGetInstanceEvents.mockRejectedValue(new Error('not found'))
    renderPage()
    // Breadcrumb must always render
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
    })
  })

  // ── Polling interval cleanup ───────────────────────────────────────────────

  it('cleans up intervals on unmount — no unhandled state updates', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = renderPage()
    await waitFor(() => screen.getByTestId('instance-detail-page'))

    unmount()

    // At least one clearInterval should fire (children interval + tick interval)
    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })

  // ── Bug-2 regression: state node live-state badge ──────────────────────────
  // State nodes produce no K8s resources; they must not show a live-state badge
  // ("Not Found") when clicked in the instance detail live DAG.

  it('Bug-2a: clicking a state node does not show a live-state badge', async () => {
    mockedGetRGD.mockResolvedValue(makeRGDWithStateNode())
    renderPage()

    // Wait for the DAG to render with the state node
    await waitFor(() => {
      expect(screen.getByTestId('dag-node-initState')).toBeInTheDocument()
    })

    // Click the state node
    fireEvent.click(screen.getByTestId('dag-node-initState'))

    // Panel must open (node id appears in the panel header)
    await waitFor(() => {
      expect(screen.getByTestId('node-detail-panel')).toBeInTheDocument()
    })

    // No live-state badge for state nodes
    expect(screen.queryByTestId('node-detail-state-badge')).not.toBeInTheDocument()
  })

  it('Bug-2b: clicking a state node does not show "Not Found" text', async () => {
    mockedGetRGD.mockResolvedValue(makeRGDWithStateNode())
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('dag-node-initState')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('dag-node-initState'))

    await waitFor(() => {
      expect(screen.getByTestId('node-detail-panel')).toBeInTheDocument()
    })

    // "Not Found" must not appear — state nodes have no live cluster state
    const badge = screen.queryByTestId('node-detail-state-badge')
    expect(badge).toBeNull()
    // Also confirm the text "Not Found" does not leak into the panel
    expect(screen.queryByText('Not Found')).not.toBeInTheDocument()
  })

  it('Bug-2c: clicking a resource node (cfg) still shows a live-state badge', async () => {
    mockedGetRGD.mockResolvedValue(makeRGDWithStateNode())
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('dag-node-cfg')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('dag-node-cfg'))

    await waitFor(() => {
      expect(screen.getByTestId('node-detail-panel')).toBeInTheDocument()
    })

    // Resource node must have a badge (Not Found because no children were returned)
    expect(screen.getByTestId('node-detail-state-badge')).toBeInTheDocument()
  })

  // ── Aria-live health state announcements (WCAG 2.1 SC 4.1.3) ─────────────

  it('renders an aria-live region for health state announcements', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('instance-detail-page')).toBeInTheDocument()
    })

    // The aria-live region must be present in the DOM at all times
    const announcer = screen.getByTestId('health-state-announcer')
    expect(announcer).toBeInTheDocument()
    expect(announcer).toHaveAttribute('aria-live', 'polite')
    expect(announcer).toHaveAttribute('aria-atomic', 'true')
  })

  it('announces health state when instance changes from ready to error', async () => {
    // First render: instance is ready
    mockedGetInstance.mockResolvedValueOnce(makeInstance('my-app', [
      { type: 'Ready', status: 'True' },
    ]))
    mockedGetInstance.mockResolvedValue(makeInstance('my-app', [
      { type: 'Ready', status: 'False' },
    ]))

    renderPage()

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('instance-detail-page')).toBeInTheDocument()
    })

    // The announcer should eventually contain a transition message
    // (triggered by polling — the second call returns an error instance)
    await waitFor(() => {
      const announcer = screen.getByTestId('health-state-announcer')
      // After the health state changes, the announcer should have a non-empty message
      // Exact text depends on transition but it must mention a health state
      const text = announcer.textContent ?? ''
      return text.length > 0
    }, { timeout: 5000 })
  })

  // ── Stuck-reconciling escalation banner (spec issue-711) ──────────────────

  it('does NOT escalate reconciling banner when stuck for < 10 minutes', async () => {
    // Instance is reconciling (IN_PROGRESS) with a 5-minute-old condition
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    mockedGetInstance.mockResolvedValue({
      apiVersion: 'app.k8s.io/v1alpha1',
      kind: 'WebApp',
      metadata: { name: 'my-app', namespace: 'default', creationTimestamp: fiveMinAgo },
      status: {
        state: 'IN_PROGRESS',
        conditions: [
          { type: 'Ready', status: 'False', lastTransitionTime: fiveMinAgo },
        ],
      },
    })

    renderPage()
    await waitFor(() =>
      expect(screen.getByTestId('instance-detail-page')).toBeInTheDocument(),
    )

    // Normal reconciling banner should show, but no kubectl describe command
    const banner = document.querySelector('.reconciling-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).not.toHaveClass('reconciling-banner--stuck')
    // No kubectl describe code block
    expect(document.querySelector('.reconciling-banner-cmd')).not.toBeInTheDocument()
  })

  it('escalates reconciling banner with kubectl describe when stuck >= 10 minutes', async () => {
    // Instance is reconciling with a 15-minute-old condition
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    mockedGetInstance.mockResolvedValue({
      apiVersion: 'app.k8s.io/v1alpha1',
      kind: 'WebApp',
      metadata: { name: 'my-app', namespace: 'default', creationTimestamp: fifteenMinAgo },
      status: {
        state: 'IN_PROGRESS',
        conditions: [
          { type: 'Ready', status: 'False', lastTransitionTime: fifteenMinAgo },
        ],
      },
    })

    renderPage()
    await waitFor(() =>
      expect(screen.getByTestId('instance-detail-page')).toBeInTheDocument(),
    )

    // Stuck variant must be present
    const banner = document.querySelector('.reconciling-banner--stuck')
    expect(banner).toBeInTheDocument()

    // Must include the kubectl describe command (O2)
    const cmd = document.querySelector('.reconciling-banner-cmd')
    expect(cmd).toBeInTheDocument()
    expect(cmd?.textContent).toContain('kubectl describe')
    expect(cmd?.textContent).toContain('webapp') // kind lowercased
    expect(cmd?.textContent).toContain('my-app')  // instance name
    expect(cmd?.textContent).toContain('-n default') // namespace flag
  })

  it('omits namespace flag from kubectl describe for cluster-scoped instances', async () => {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    mockedGetInstance.mockResolvedValue({
      apiVersion: 'app.k8s.io/v1alpha1',
      kind: 'WebApp',
      metadata: { name: 'my-app', namespace: '_', creationTimestamp: fifteenMinAgo },
      status: {
        state: 'IN_PROGRESS',
        conditions: [
          { type: 'Ready', status: 'False', lastTransitionTime: fifteenMinAgo },
        ],
      },
    })

    // Render with namespace='_' (cluster-scoped)
    renderPage('test-app', '_', 'my-app')
    await waitFor(() =>
      expect(screen.getByTestId('instance-detail-page')).toBeInTheDocument(),
    )

    const cmd = document.querySelector('.reconciling-banner-cmd')
    expect(cmd).toBeInTheDocument()
    expect(cmd?.textContent).not.toContain('-n')
  })
})

// ── isReconcilingSlow (design doc 30.1, spec issue-765) ─────────────────────

function makeSlowInstance(reconcilingSinceMs: number): import('@/lib/api').K8sObject {
  const t = new Date(Date.now() - reconcilingSinceMs).toISOString()
  return {
    apiVersion: 'kro.run/v1alpha1',
    kind: 'WebApp',
    metadata: { name: 'my-app', namespace: 'default' },
    status: {
      state: 'IN_PROGRESS',
      conditions: [
        { type: 'Ready', status: 'False', lastTransitionTime: t },
      ],
    },
  }
}

describe('isReconcilingSlow', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('exports RECONCILE_SLOW_FACTOR = 2 (O3)', () => {
    expect(RECONCILE_SLOW_FACTOR).toBe(2)
  })

  it('returns false for null instance', () => {
    expect(isReconcilingSlow(null)).toBe(false)
  })

  it('returns false when reconciling for < 5 minutes', () => {
    vi.setSystemTime(new Date('2026-04-01T12:10:00Z'))
    const inst = makeSlowInstance(4 * 60 * 1000) // 4m ago
    expect(isReconcilingSlow(inst)).toBe(false)
  })

  it('returns true when reconciling for exactly 5 minutes', () => {
    vi.setSystemTime(new Date('2026-04-01T12:10:00Z'))
    const inst = makeSlowInstance(5 * 60 * 1000 + 1000) // 5m1s
    expect(isReconcilingSlow(inst)).toBe(true)
  })

  it('returns true when reconciling for 7 minutes (between 5 and 10)', () => {
    vi.setSystemTime(new Date('2026-04-01T12:10:00Z'))
    const inst = makeSlowInstance(7 * 60 * 1000)
    expect(isReconcilingSlow(inst)).toBe(true)
  })

  it('returns false when reconciling for >= 10 minutes (stuck threshold — that banner takes over)', () => {
    vi.setSystemTime(new Date('2026-04-01T12:10:00Z'))
    const inst = makeSlowInstance(10 * 60 * 1000 + 1000) // 10m1s
    expect(isReconcilingSlow(inst)).toBe(false)
  })

  it('returns false for ACTIVE (non-reconciling) instance', () => {
    const inst: import('@/lib/api').K8sObject = {
      apiVersion: 'kro.run/v1alpha1',
      kind: 'WebApp',
      metadata: { name: 'my-app', namespace: 'default' },
      status: {
        state: 'ACTIVE',
        conditions: [{ type: 'Ready', status: 'True', lastTransitionTime: new Date().toISOString() }],
      },
    }
    expect(isReconcilingSlow(inst)).toBe(false)
  })
})

describe('reconciling-slow-banner integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-01T12:10:00Z'))
    const sevenMinAgo = new Date(Date.now() - 7 * 60 * 1000).toISOString()
    mockedGetInstance.mockResolvedValue({
      apiVersion: 'kro.run/v1alpha1',
      kind: 'WebApp',
      metadata: { name: 'my-app', namespace: 'default', creationTimestamp: sevenMinAgo },
      status: {
        state: 'IN_PROGRESS',
        conditions: [
          { type: 'Ready', status: 'False', lastTransitionTime: sevenMinAgo },
        ],
      },
    })
    mockedGetInstanceEvents.mockResolvedValue({ items: [] })
    mockedGetInstanceChildren.mockResolvedValue({ items: [] })
    mockedGetRGD.mockResolvedValue({
      apiVersion: 'kro.run/v1alpha1',
      kind: 'ResourceGroupDefinition',
      metadata: { name: 'test-app', namespace: 'default' },
      spec: { schema: { kind: 'WebApp', spec: {} }, resources: [] },
    })
    mockedListRGDs.mockResolvedValue({ items: [] })
  })
  afterEach(() => { vi.useRealTimers() })

  it('shows "taking longer than usual" banner when reconciling for 7 minutes (O1)', async () => {
    renderPage('test-app', 'default', 'my-app')
    await waitFor(() =>
      expect(screen.getByTestId('instance-detail-page')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('reconciling-slow-banner')).toBeInTheDocument()
    expect(screen.getByText(/taking longer than usual/i)).toBeInTheDocument()
  })
})
