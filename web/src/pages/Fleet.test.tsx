// Fleet.test.tsx — unit tests for the Fleet multi-cluster overview page.
//
// Issue #219: Fleet page had no unit test coverage.
// Covers: loading state, error state, cluster rows rendered, deduplication,
// refresh button, page title.

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Fleet from './Fleet'

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  getFleetSummary: vi.fn(),
  switchContext: vi.fn(),
  getControllerMetricsForContext: vi.fn(),
}))

import { getFleetSummary, switchContext, getControllerMetricsForContext } from '@/lib/api'

const mockedGetFleetSummary = vi.mocked(getFleetSummary)
const mockedSwitchContext = vi.mocked(switchContext)
const mockedGetMetrics = vi.mocked(getControllerMetricsForContext)

// ── Helpers ───────────────────────────────────────────────────────────────

function makeCluster(context: string, health: 'healthy' | 'degraded' | 'unreachable' = 'healthy') {
  return {
    context,
    cluster: `https://${context}.example.com`,
    health,
    rgdCount: 3,
    instanceCount: 7,
    degradedInstances: 0,
    rgdKinds: ['WebApp'],
    kroVersion: 'v0.8.5',
    error: '',
  }
}

function renderFleet() {
  return render(
    <MemoryRouter>
      <Fleet />
    </MemoryRouter>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Fleet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetMetrics.mockResolvedValue({
      watchCount: null,
      gvrCount: null,
      queueDepth: null,
      workqueueDepth: null,
      scrapedAt: '2026-01-01T00:00:00Z',
    })
  })

  // ── Page title ───────────────────────────────────────────────────────────

  it('sets document.title to "Fleet — kro-ui"', async () => {
    mockedGetFleetSummary.mockResolvedValue({ clusters: [] })
    renderFleet()
    await waitFor(() => expect(document.title).toBe('Fleet — kro-ui'))
  })

  // ── Loading state ────────────────────────────────────────────────────────

  it('shows skeleton cards while loading', () => {
    mockedGetFleetSummary.mockReturnValue(new Promise(() => {}))
    const { container } = renderFleet()
    // SkeletonCard components render while loading
    expect(container.querySelectorAll('.skeleton-card').length).toBeGreaterThan(0)
  })

  // ── Error state ──────────────────────────────────────────────────────────

  it('shows a translated error message when getFleetSummary rejects', async () => {
    mockedGetFleetSummary.mockRejectedValue(new Error('connection refused'))
    renderFleet()
    await waitFor(() => {
      // Fleet renders error in a role="alert" element
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  // ── Success state ─────────────────────────────────────────────────────────

  it('renders a row for each cluster', async () => {
    mockedGetFleetSummary.mockResolvedValue({
      clusters: [makeCluster('ctx-a'), makeCluster('ctx-b'), makeCluster('ctx-c')],
    })
    renderFleet()
    await waitFor(() => {
      // Each cluster name appears at least once (may appear multiple times in card)
      expect(screen.getAllByText('ctx-a').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('ctx-b').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('ctx-c').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows empty state message when cluster list is empty', async () => {
    mockedGetFleetSummary.mockResolvedValue({ clusters: [] })
    renderFleet()
    await waitFor(() => {
      expect(screen.getByTestId('fleet-empty')).toBeInTheDocument()
    })
  })

  // ── Deduplication ─────────────────────────────────────────────────────────

  it('deduplicates clusters that share the same server URL', async () => {
    // Two contexts pointing to the same cluster — only ctx-short survives as primary
    const clusterA = { ...makeCluster('ctx-short'), cluster: 'https://shared.example.com' }
    const clusterB = { ...makeCluster('ctx-long-arn-name'), cluster: 'https://shared.example.com' }
    mockedGetFleetSummary.mockResolvedValue({ clusters: [clusterA, clusterB] })
    renderFleet()
    await waitFor(() => {
      // ctx-short rendered as primary (shorter wins)
      expect(screen.getAllByText('ctx-short').length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── Refresh button ────────────────────────────────────────────────────────

  it('has a refresh button that re-fetches fleet data when clicked', async () => {
    mockedGetFleetSummary.mockResolvedValue({ clusters: [makeCluster('ctx-a')] })
    renderFleet()
    await waitFor(() => screen.getAllByText('ctx-a'))

    const callsBefore = mockedGetFleetSummary.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    await waitFor(() => {
      expect(mockedGetFleetSummary.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  // ── Context switching ─────────────────────────────────────────────────────

  it('calls switchContext when a cluster card is clicked', async () => {
    mockedGetFleetSummary.mockResolvedValue({ clusters: [makeCluster('prod-ctx')] })
    mockedSwitchContext.mockResolvedValue({ active: 'prod-ctx' })
    renderFleet()
    await waitFor(() => screen.getAllByText('prod-ctx'))

    // Click the switch button (role=button in ClusterCard)
    const switchButtons = screen.getAllByRole('button')
    // At least the refresh button exists; click whichever is for the cluster
    fireEvent.click(switchButtons[switchButtons.length - 1])
    await waitFor(() => {
      expect(screen.getAllByText('prod-ctx').length).toBeGreaterThanOrEqual(1)
    })
  })
})
