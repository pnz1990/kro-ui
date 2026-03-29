import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Catalog from './Catalog'

vi.mock('@/lib/api', () => ({
  listRGDs: vi.fn(),
  listInstances: vi.fn(),
}))

import { listRGDs, listInstances } from '@/lib/api'

const mockedListRGDs = vi.mocked(listRGDs)
const mockedListInstances = vi.mocked(listInstances)

function renderCatalog() {
  return render(
    <MemoryRouter>
      <Catalog />
    </MemoryRouter>,
  )
}

function makeRGD(
  name: string,
  kind: string,
  labels: Record<string, string> = {},
  templateKinds: string[] = [],
) {
  return {
    metadata: {
      name,
      labels,
      creationTimestamp: '2026-01-15T10:00:00Z',
    },
    spec: {
      schema: { kind },
      resources: templateKinds.map((k) => ({ template: { kind: k } })),
    },
    status: { conditions: [{ type: 'Ready', status: 'True' }] },
  }
}

/** makeErrorRGD returns an RGD with Ready=False (compile error). */
function makeErrorRGD(name: string, kind: string) {
  return {
    metadata: {
      name,
      labels: {},
      creationTimestamp: '2026-01-15T10:00:00Z',
    },
    spec: {
      schema: { kind },
      resources: [],
    },
    status: {
      conditions: [
        { type: 'Ready', status: 'False', reason: 'InvalidResourceGraph', message: 'failed' },
      ],
    },
  }
}

function makeInstanceList(count: number) {
  return {
    items: Array.from({ length: count }, (_, i) => ({
      metadata: { name: `instance-${i}` },
    })),
    metadata: {},
  }
}

describe('Catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: instances fetch returns empty for all
    mockedListInstances.mockResolvedValue(makeInstanceList(0))
  })

  // ── Loading state ──────────────────────────────────────────────

  it('shows skeleton cards while loading', () => {
    mockedListRGDs.mockReturnValue(new Promise(() => {}))
    const { container } = renderCatalog()
    const skeletons = container.querySelectorAll('[aria-hidden="true"]')
    expect(skeletons.length).toBeGreaterThan(0)
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })

  // ── Search filter ──────────────────────────────────────────────

  it('filters by search term across name and kind', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [
        makeRGD('database', 'Database'),
        makeRGD('user-database', 'UserDatabase'),
        makeRGD('web-service', 'WebApp'),
      ],
      metadata: {},
    })

    renderCatalog()

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-database')).toBeInTheDocument()
    })

    // Type "database" — should show 2 results, hide web-service
    await user.type(screen.getByRole('searchbox'), 'database')

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-database')).toBeInTheDocument()
      expect(screen.getByTestId('catalog-card-user-database')).toBeInTheDocument()
      expect(screen.queryByTestId('catalog-card-web-service')).not.toBeInTheDocument()
    })
  })

  it('filters by schema kind (case-insensitive)', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [
        makeRGD('svc', 'WebApp'),
        makeRGD('db', 'Database'),
      ],
      metadata: {},
    })

    renderCatalog()

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-svc')).toBeInTheDocument()
    })

    await user.type(screen.getByRole('searchbox'), 'webapp')

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-svc')).toBeInTheDocument()
      expect(screen.queryByTestId('catalog-card-db')).not.toBeInTheDocument()
    })
  })

  it('shows all RGDs when search is cleared', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [makeRGD('alpha', 'Alpha'), makeRGD('beta', 'Beta')],
      metadata: {},
    })

    renderCatalog()

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-alpha')).toBeInTheDocument()
    })

    const searchInput = screen.getByRole('searchbox')
    await user.type(searchInput, 'alpha')

    await waitFor(() => {
      expect(screen.queryByTestId('catalog-card-beta')).not.toBeInTheDocument()
    })

    // Clear button should appear
    const clearBtn = screen.getByLabelText('Clear search')
    await user.click(clearBtn)

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-alpha')).toBeInTheDocument()
      expect(screen.getByTestId('catalog-card-beta')).toBeInTheDocument()
    })
  })

  // ── Label filter ───────────────────────────────────────────────

  it('filters by label selection', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [
        makeRGD('platform-svc', 'PlatformSvc', { team: 'platform' }),
        makeRGD('security-svc', 'SecuritySvc', { team: 'security' }),
      ],
      metadata: {},
    })

    renderCatalog()

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-platform-svc')).toBeInTheDocument()
    })

    // Open label filter dropdown
    await user.click(screen.getByRole('button', { name: /filter by label/i }))

    // Select team=platform — scope to the listbox to avoid matching the card label pill
    const listbox = await screen.findByRole('listbox', { name: /label filters/i })
    const option = within(listbox).getByText('team=platform')
    await user.click(option)

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-platform-svc')).toBeInTheDocument()
      expect(screen.queryByTestId('catalog-card-security-svc')).not.toBeInTheDocument()
    })
  })

  // ── Sort by instance count ──────────────────────────────────────

  it('sorts by instance count descending', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [
        makeRGD('alpha', 'Alpha'),
        makeRGD('beta', 'Beta'),
        makeRGD('gamma', 'Gamma'),
      ],
      metadata: {},
    })

    // alpha has 1 instance, beta has 10, gamma has 3
    mockedListInstances.mockImplementation((rgdName: string) => {
      const counts: Record<string, number> = { alpha: 1, beta: 10, gamma: 3 }
      return Promise.resolve(makeInstanceList(counts[rgdName] ?? 0))
    })

    renderCatalog()

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-alpha')).toBeInTheDocument()
    })

    // Change sort to "Most instances"
    const sortSelect = screen.getByRole('combobox')
    await user.selectOptions(sortSelect, 'instances')

    await waitFor(() => {
      const grid = screen.getByTestId('virtual-grid-items')
      const cards = within(grid).getAllByRole('article')
      expect(cards[0]).toHaveAttribute('data-testid', 'catalog-card-beta')
      expect(cards[1]).toHaveAttribute('data-testid', 'catalog-card-gamma')
      expect(cards[2]).toHaveAttribute('data-testid', 'catalog-card-alpha')
    })
  })

  // ── Empty state ────────────────────────────────────────────────

  it('shows empty state when no results match', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [makeRGD('my-service', 'MyService')],
      metadata: {},
    })

    renderCatalog()

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-my-service')).toBeInTheDocument()
    })

    await user.type(screen.getByRole('searchbox'), 'zzzzznotfound')

    await waitFor(() => {
      expect(screen.getByTestId('catalog-empty')).toBeInTheDocument()
      expect(screen.getByText(/No RGDs match your search/i)).toBeInTheDocument()
    })
  })

  it('shows Clear filters button in empty state when filters are active', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [makeRGD('my-service', 'MyService')],
      metadata: {},
    })

    renderCatalog()

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-my-service')).toBeInTheDocument()
    })

    await user.type(screen.getByRole('searchbox'), 'notexists')

    await waitFor(() => {
      expect(screen.getByText('Clear filters')).toBeInTheDocument()
    })

    // Click Clear filters — cards should return
    await user.click(screen.getByText('Clear filters'))

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-my-service')).toBeInTheDocument()
      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument()
    })
  })

  it('shows cluster-empty state when no RGDs exist', async () => {
    mockedListRGDs.mockResolvedValue({ items: [], metadata: {} })

    renderCatalog()

    await waitFor(() => {
      expect(screen.getByText(/No ResourceGraphDefinitions found/i)).toBeInTheDocument()
    })
  })

  // ── Instance count ─────────────────────────────────────────────

  it('shows — for instance count when fetch fails', async () => {
    mockedListRGDs.mockResolvedValue({
      items: [makeRGD('broken', 'Broken')],
      metadata: {},
    })
    mockedListInstances.mockRejectedValue(new Error('403 Forbidden'))

    renderCatalog()

    await waitFor(() => {
      const card = screen.getByTestId('catalog-card-broken')
      expect(within(card).getByTestId('catalog-card-instances')).toHaveTextContent('— instances')
    })
  })

  // ── Error state ────────────────────────────────────────────────

  it('shows error and retry button on fetch failure', async () => {
    mockedListRGDs.mockRejectedValue(new Error('connection refused'))

    renderCatalog()

    await waitFor(() => {
      expect(screen.getByText(/Cannot reach the Kubernetes API server/)).toBeInTheDocument()
    })

    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  // ── Count display ──────────────────────────────────────────────

  it('displays result count after load', async () => {
    mockedListRGDs.mockResolvedValue({
      items: [makeRGD('a', 'A'), makeRGD('b', 'B'), makeRGD('c', 'C')],
      metadata: {},
    })

    renderCatalog()

    await waitFor(() => {
      expect(screen.getByText('3 of 3')).toBeInTheDocument()
    })
  })

  // ── Status filter tests (spec 070) ─────────────────────────────

  it('status filter buttons are rendered (All, Ready, Errors)', async () => {
    mockedListRGDs.mockResolvedValue({
      items: [makeRGD('app', 'App')],
      metadata: {},
    })
    renderCatalog()

    await waitFor(() => {
      expect(screen.getByTestId('catalog-status-all')).toBeInTheDocument()
      expect(screen.getByTestId('catalog-status-ready')).toBeInTheDocument()
      expect(screen.getByTestId('catalog-status-errors')).toBeInTheDocument()
    })
    // All is active by default
    expect(screen.getByTestId('catalog-status-all')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('catalog-status-ready')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('catalog-status-errors')).toHaveAttribute('aria-pressed', 'false')
  })

  it('Errors filter shows only error-state RGDs', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [makeRGD('app-ok', 'AppOk'), makeErrorRGD('broken', 'Broken'), makeRGD('also-ok', 'AlsoOk')],
      metadata: {},
    })
    renderCatalog()

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-app-ok')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('catalog-status-errors'))

    await waitFor(() => {
      expect(screen.queryByTestId('catalog-card-app-ok')).not.toBeInTheDocument()
      expect(screen.queryByTestId('catalog-card-also-ok')).not.toBeInTheDocument()
      expect(screen.getByTestId('catalog-card-broken')).toBeInTheDocument()
    })

    // Count updates to reflect filter
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('Ready filter shows only ready-state RGDs', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [makeRGD('app-ok', 'AppOk'), makeErrorRGD('broken', 'Broken')],
      metadata: {},
    })
    renderCatalog()

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-app-ok')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('catalog-status-ready'))

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-app-ok')).toBeInTheDocument()
      expect(screen.queryByTestId('catalog-card-broken')).not.toBeInTheDocument()
    })
  })

  it('All filter restores full list after Errors filter', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [makeRGD('app-ok', 'AppOk'), makeErrorRGD('broken', 'Broken')],
      metadata: {},
    })
    renderCatalog()

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-app-ok')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('catalog-status-errors'))
    await waitFor(() => {
      expect(screen.queryByTestId('catalog-card-app-ok')).not.toBeInTheDocument()
    })

    await user.click(screen.getByTestId('catalog-status-all'))
    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-app-ok')).toBeInTheDocument()
      expect(screen.getByTestId('catalog-card-broken')).toBeInTheDocument()
    })
  })

  it('clearFilters resets status filter to All — via All button', async () => {
    const user = userEvent.setup()
    mockedListRGDs.mockResolvedValue({
      items: [makeRGD('app-ok', 'AppOk'), makeErrorRGD('broken', 'Broken')],
      metadata: {},
    })
    renderCatalog()

    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-app-ok')).toBeInTheDocument()
    })

    // Activate Errors filter
    await user.click(screen.getByTestId('catalog-status-errors'))
    await waitFor(() => {
      expect(screen.queryByTestId('catalog-card-app-ok')).not.toBeInTheDocument()
      expect(screen.getByTestId('catalog-card-broken')).toBeInTheDocument()
    })

    // Pressing All restores full list
    await user.click(screen.getByTestId('catalog-status-all'))
    await waitFor(() => {
      expect(screen.getByTestId('catalog-card-app-ok')).toBeInTheDocument()
      expect(screen.getByTestId('catalog-card-broken')).toBeInTheDocument()
    })
    expect(screen.getByTestId('catalog-status-all')).toHaveAttribute('aria-pressed', 'true')
  })
})
