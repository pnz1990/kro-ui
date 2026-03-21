import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RGDDetail from './RGDDetail'

vi.mock('@/lib/api', () => ({
  getRGD: vi.fn(),
}))

import { getRGD } from '@/lib/api'
const mockedGetRGD = vi.mocked(getRGD)

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

  // ── T034c: ?tab=instances shows instances placeholder ────────────────

  it('T034c: ?tab=instances shows instances placeholder content', async () => {
    renderDetail('?tab=instances')
    await waitFor(() =>
      expect(screen.getByTestId('tab-instances')).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(screen.queryByTestId('dag-svg')).not.toBeInTheDocument()
    // Placeholder text is shown
    expect(screen.getByText(/Instance list coming in spec 004/i)).toBeInTheDocument()
  })

  // ── T034d: Invalid tab falls back to Graph ────────────────────────────

  it('T034d: ?tab=invalid falls back to Graph tab', async () => {
    renderDetail('?tab=invalid')
    await waitFor(() =>
      expect(screen.getByTestId('tab-graph')).toHaveAttribute('aria-selected', 'true'),
    )
    expect(screen.getByTestId('dag-svg')).toBeInTheDocument()
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
})
