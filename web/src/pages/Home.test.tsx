import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'

vi.mock('@/lib/api', () => ({
  listRGDs: vi.fn(),
  getControllerMetrics: vi.fn(() => Promise.resolve({
    watchCount: null,
    gvrCount: null,
    queueDepth: null,
    workqueueDepth: null,
    scrapedAt: '2026-03-22T00:00:00Z',
  })),
}))

import { listRGDs } from '@/lib/api'

const mockedListRGDs = vi.mocked(listRGDs)

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  )
}

function makeItem(name: string, kind?: string) {
  const k = kind ?? (name.charAt(0).toUpperCase() + name.slice(1))
  return {
    metadata: { name, creationTimestamp: '2026-03-15T10:00:00Z' },
    spec: { schema: { kind: k }, resources: [{}] },
    status: { conditions: [{ type: 'Ready', status: 'True' }] },
  }
}

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows skeleton cards while loading', () => {
    // Never-resolving promise keeps loading state
    mockedListRGDs.mockReturnValue(new Promise(() => {}))
    const { container } = renderHome()
    // Count only the RGD skeleton cards (not MetricsStrip skeleton cells).
    const skeletons = container.querySelectorAll('.skeleton-card')
    expect(skeletons.length).toBe(3)
  })

  it('renders one card per RGD item', async () => {
    mockedListRGDs.mockResolvedValue({
      items: [makeItem('app-a'), makeItem('app-b'), makeItem('app-c')],
      metadata: {},
    })
    renderHome()
    await waitFor(() => {
      expect(screen.getByTestId('rgd-card-app-a')).toBeInTheDocument()
      expect(screen.getByTestId('rgd-card-app-b')).toBeInTheDocument()
      expect(screen.getByTestId('rgd-card-app-c')).toBeInTheDocument()
    })
  })

  it('shows empty state when items is empty', async () => {
    mockedListRGDs.mockResolvedValue({ items: [], metadata: {} })
    renderHome()
    await waitFor(() => {
      expect(
        screen.getByText(/No ResourceGraphDefinitions found/),
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Learn about kro')).toHaveAttribute(
      'href',
      'https://kro.run/docs',
    )
  })

  it('shows error state and retry button on fetch failure', async () => {
    mockedListRGDs.mockRejectedValue(new Error('connection refused'))
    renderHome()
    await waitFor(() => {
      expect(screen.getByText('connection refused')).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('retries fetch when Retry button is clicked', async () => {
    const user = userEvent.setup()

    // First call fails
    mockedListRGDs.mockRejectedValueOnce(new Error('failed'))
    renderHome()

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    // Second call succeeds
    mockedListRGDs.mockResolvedValueOnce({
      items: [makeItem('recovered')],
      metadata: {},
    })

    await user.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByTestId('rgd-card-recovered')).toBeInTheDocument()
    })
  })

  it('renders card names correctly', async () => {
    mockedListRGDs.mockResolvedValue({
      items: [makeItem('web-service'), makeItem('worker-pool')],
      metadata: {},
    })
    renderHome()
    await waitFor(() => {
      const names = screen.getAllByTestId('rgd-name')
      expect(names[0]).toHaveTextContent('web-service')
      expect(names[1]).toHaveTextContent('worker-pool')
    })
  })

  // ── Search filter tests ────────────────────────────────────────────────
  // Note: search is debounced at 300ms; assertions use waitFor to allow the
  // debounce to fire before checking the DOM.

  it('filters cards by name when typing in the search box', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [makeItem('alpha'), makeItem('beta'), makeItem('gamma')],
      metadata: {},
    })
    renderHome()

    await waitFor(() => {
      expect(screen.getByTestId('rgd-card-alpha')).toBeInTheDocument()
    })

    const searchInput = screen.getByRole('searchbox')
    await user.type(searchInput, 'alp')

    await waitFor(() => {
      expect(screen.getByTestId('rgd-card-alpha')).toBeInTheDocument()
      expect(screen.queryByTestId('rgd-card-beta')).not.toBeInTheDocument()
      expect(screen.queryByTestId('rgd-card-gamma')).not.toBeInTheDocument()
    })
  })

  it('filters cards by kind when typing in the search box', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [makeItem('web-app', 'WebApp'), makeItem('worker', 'WorkerPool')],
      metadata: {},
    })
    renderHome()

    await waitFor(() => {
      expect(screen.getByTestId('rgd-card-web-app')).toBeInTheDocument()
    })

    const searchInput = screen.getByRole('searchbox')
    await user.type(searchInput, 'workerpool')

    await waitFor(() => {
      expect(screen.queryByTestId('rgd-card-web-app')).not.toBeInTheDocument()
      expect(screen.getByTestId('rgd-card-worker')).toBeInTheDocument()
    })
  })

  it('shows no-results message when search matches nothing', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [makeItem('alpha'), makeItem('beta')],
      metadata: {},
    })
    renderHome()

    await waitFor(() => {
      expect(screen.getByTestId('rgd-card-alpha')).toBeInTheDocument()
    })

    const searchInput = screen.getByRole('searchbox')
    await user.type(searchInput, 'zzznomatch')

    await waitFor(() => {
      expect(screen.queryByTestId('rgd-card-alpha')).not.toBeInTheDocument()
      expect(screen.getByText(/No ResourceGraphDefinitions match/)).toBeInTheDocument()
    })
  })

  it('restores full grid when search is cleared via SearchBar clear button', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [makeItem('alpha'), makeItem('beta')],
      metadata: {},
    })
    renderHome()

    await waitFor(() => {
      expect(screen.getByTestId('rgd-card-alpha')).toBeInTheDocument()
    })

    const searchInput = screen.getByRole('searchbox')
    await user.type(searchInput, 'alp')

    await waitFor(() => {
      expect(screen.queryByTestId('rgd-card-beta')).not.toBeInTheDocument()
    })

    // Use the SearchBar's built-in clear button (aria-label "Clear search")
    const clearBtn = screen.getByRole('button', { name: 'Clear search' })
    await user.click(clearBtn)

    await waitFor(() => {
      expect(screen.getByTestId('rgd-card-alpha')).toBeInTheDocument()
      expect(screen.getByTestId('rgd-card-beta')).toBeInTheDocument()
    })
  })

  it('shows count indicator matching filtered results', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [makeItem('alpha'), makeItem('beta'), makeItem('gamma')],
      metadata: {},
    })
    renderHome()

    await waitFor(() => {
      // Initially shows all 3
      expect(screen.getByText('3 of 3')).toBeInTheDocument()
    })

    const searchInput = screen.getByRole('searchbox')
    await user.type(searchInput, 'alp')

    await waitFor(() => {
      expect(screen.getByText('1 of 3')).toBeInTheDocument()
    })
  })
})
