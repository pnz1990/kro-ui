import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RGDDetail from './RGDDetail'

vi.mock('@/lib/api', () => ({
  getRGD: vi.fn(),
  listRGDs: vi.fn(),
  listInstances: vi.fn(),
}))

import { getRGD, listRGDs, listInstances } from '@/lib/api'
const mockedGetRGD = vi.mocked(getRGD)
const mockedListRGDs = vi.mocked(listRGDs)
const mockedListInstances = vi.mocked(listInstances)

/** Minimal RGD object with one NodeTypeResource. */
function makeRGD(name = 'test-app') {
  return {
    apiVersion: 'kro.run/v1alpha1',
    kind: 'ResourceGraphDefinition',
    metadata: { name },
    spec: {
      schema: { kind: 'WebApp', apiVersion: 'v1alpha1', group: 'test.dev' },
      resources: [
        {
          id: 'appNamespace',
          template: {
            apiVersion: 'v1',
            kind: 'Namespace',
            metadata: { name: '${schema.spec.appName}' },
          },
        },
      ],
    },
    status: { conditions: [] },
  }
}

/** Minimal K8sList with instance items. */
function makeInstanceList(items: Array<{ name: string; namespace: string; ready?: boolean }>) {
  return {
    metadata: {},
    items: items.map(({ name, namespace, ready }) => ({
      metadata: { name, namespace, creationTimestamp: '2026-01-01T00:00:00Z' },
      status: {
        conditions: ready !== undefined
          ? [{ type: 'Ready', status: ready ? 'True' : 'False', reason: 'TestReason', message: 'test msg' }]
          : [],
      },
    })),
  }
}

/**
 * Render RGDDetail with an optional initial URL search string.
 * Uses MemoryRouter with a route that provides the :name param.
 */
function renderDetail(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/rgds/test-app${search}`]}>
      <Routes>
        <Route path="/rgds/:name" element={<RGDDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RGDDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetRGD.mockResolvedValue(makeRGD())
    // Default: empty RGD list (chain detection returns no chainable nodes)
    mockedListRGDs.mockResolvedValue({ metadata: {}, items: [] })
    // Default: empty instance list (overridden in specific tests)
    mockedListInstances.mockResolvedValue(makeInstanceList([]))
  })

  // ── T034a: Default tab is Graph ───────────────────────────────────────

  it('T034a: default tab is Graph when no ?tab param', async () => {
    renderDetail()
    await waitFor(() =>
      expect(screen.getByTestId('tab-graph')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('tab-graph')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('tab-instances')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('tab-yaml')).toHaveAttribute('aria-selected', 'false')
    // DAG SVG should be rendered
    expect(screen.getByTestId('dag-svg')).toBeInTheDocument()
  })

  // ── T034b: ?tab=yaml shows YAML content ──────────────────────────────

  it('T034b: ?tab=yaml shows YAML tab content', async () => {
    renderDetail('?tab=yaml')
    await waitFor(() =>
      expect(screen.getByTestId('tab-yaml')).toHaveAttribute('aria-selected', 'true'),
    )
    expect(screen.getByTestId('kro-code-block')).toBeInTheDocument()
    expect(screen.queryByTestId('dag-svg')).not.toBeInTheDocument()
  })

  // ── T034d: Invalid tab falls back to Graph ────────────────────────────

  it('T034d: ?tab=invalid falls back to Graph tab', async () => {
    renderDetail('?tab=invalid')
    await waitFor(() =>
      expect(screen.getByTestId('tab-graph')).toHaveAttribute('aria-selected', 'true'),
    )
    expect(screen.getByTestId('dag-svg')).toBeInTheDocument()
  })

  // ── T034g: ?tab=validation shows ValidationTab ────────────────────────

  it('T034g: ?tab=validation shows Validation tab content', async () => {
    renderDetail('?tab=validation')
    await waitFor(() =>
      expect(screen.getByTestId('tab-validation')).toHaveAttribute('aria-selected', 'true'),
    )
    expect(screen.getByTestId('validation-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('dag-svg')).not.toBeInTheDocument()
  })

  // ── T034e: Node click opens NodeDetailPanel ────────────────────────────

  it('T034e: clicking a DAG node opens NodeDetailPanel', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByTestId('dag-svg')).toBeInTheDocument())

    // Panel is not visible before click
    expect(screen.queryByTestId('node-detail-panel')).not.toBeInTheDocument()

    // Click the root node
    fireEvent.click(screen.getByTestId('dag-node-schema'))

    // Panel should now be visible
    expect(screen.getByTestId('node-detail-panel')).toBeInTheDocument()
  })

  // ── T034f: Close panel hides NodeDetailPanel ──────────────────────────

  it('T034f: clicking close button hides NodeDetailPanel', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByTestId('dag-svg')).toBeInTheDocument())

    // Open panel by clicking a node
    fireEvent.click(screen.getByTestId('dag-node-schema'))
    expect(screen.getByTestId('node-detail-panel')).toBeInTheDocument()

    // Close it
    fireEvent.click(screen.getByTestId('node-detail-close'))
    expect(screen.queryByTestId('node-detail-panel')).not.toBeInTheDocument()
  })

  // ── Instances tab tests ───────────────────────────────────────────────

  it('T040a: ?tab=instances renders instance table with one row per item', async () => {
    mockedListInstances.mockResolvedValue(
      makeInstanceList([
        { name: 'prod-01', namespace: 'default', ready: true },
        { name: 'staging-01', namespace: 'staging', ready: false },
      ]),
    )
    renderDetail('?tab=instances')

    await waitFor(() =>
      expect(screen.getByTestId('instance-table')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('instance-row-prod-01')).toBeInTheDocument()
    expect(screen.getByTestId('instance-row-staging-01')).toBeInTheDocument()
  })

  it('T040b: shows empty state when items list is empty', async () => {
    mockedListInstances.mockResolvedValue(makeInstanceList([]))
    renderDetail('?tab=instances')

    await waitFor(() =>
      expect(screen.getByTestId('instance-empty-state')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('instance-table')).not.toBeInTheDocument()
  })

  it('T040c: shows error state on fetch failure with retry button', async () => {
    mockedListInstances.mockRejectedValue(new Error('cluster unreachable'))
    renderDetail('?tab=instances')

    await waitFor(() =>
      expect(screen.getByTestId('instance-error-state')).toBeInTheDocument(),
    )
    expect(screen.getByText(/cluster unreachable/i)).toBeInTheDocument()
    expect(screen.getByTestId('btn-retry')).toBeInTheDocument()
  })

  it('T040d: namespace filter pre-selected when ?namespace= is in URL', async () => {
    mockedListInstances.mockResolvedValue(
      makeInstanceList([{ name: 'prod-01', namespace: 'default', ready: true }]),
    )
    renderDetail('?tab=instances&namespace=default')

    await waitFor(() =>
      expect(screen.getByTestId('namespace-filter')).toBeInTheDocument(),
    )
    expect(
      (screen.getByTestId('namespace-filter') as HTMLSelectElement).value,
    ).toBe('default')
  })
})

// ── T028: Breadcrumb rendering (spec 025) ─────────────────────────────────

/**
 * Render RGDDetail with optional router state (for breadcrumb testing).
 */
function renderDetailWithState(routerState?: Record<string, unknown>) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/rgds/test-app', state: routerState }]}
    >
      <Routes>
        <Route path="/rgds/:name" element={<RGDDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RGDDetail breadcrumb (spec 025 T028)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetRGD.mockResolvedValue(makeRGD())
    mockedListRGDs.mockResolvedValue({ metadata: {}, items: [] })
    mockedListInstances.mockResolvedValue(makeInstanceList([]))
  })

  it('shows breadcrumb when location.state.from is set', async () => {
    renderDetailWithState({ from: 'chain-parent' })
    await waitFor(() =>
      expect(screen.getByTestId('rgd-breadcrumb')).toBeInTheDocument(),
    )
    const link = screen.getByTestId('rgd-breadcrumb-link')
    expect(link).toBeInTheDocument()
    expect(link.textContent).toContain('chain-parent')
  })

  it('breadcrumb link points to the originating RGD', async () => {
    renderDetailWithState({ from: 'chain-parent' })
    await waitFor(() =>
      expect(screen.getByTestId('rgd-breadcrumb-link')).toBeInTheDocument(),
    )
    const link = screen.getByTestId('rgd-breadcrumb-link') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/rgds/chain-parent')
  })

  it('breadcrumb is absent when location.state is null', async () => {
    renderDetailWithState(undefined)
    await waitFor(() =>
      expect(screen.getByTestId('tab-graph')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('rgd-breadcrumb')).toBeNull()
  })

  it('breadcrumb is absent when location.state.from is empty string', async () => {
    renderDetailWithState({ from: '' })
    await waitFor(() =>
      expect(screen.getByTestId('tab-graph')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('rgd-breadcrumb')).toBeNull()
  })
})
