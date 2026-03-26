import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Events from './Events'

// ── Mock api.ts ───────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  listEvents: vi.fn(),
}))

import { listEvents } from '@/lib/api'

const mockedListEvents = vi.mocked(listEvents)

// ── Helpers ───────────────────────────────────────────────────────────

function makeEventItem(overrides: {
  uid?: string
  name?: string
  instanceName?: string
  reason?: string
  type?: string
  lastTimestamp?: string
  namespace?: string
}) {
  const uid = overrides.uid ?? `uid-${Math.random().toString(36).slice(2)}`
  const instanceName = overrides.instanceName ?? 'my-app'
  return {
    metadata: {
      name: overrides.name ?? `evt-${uid}`,
      namespace: overrides.namespace ?? 'default',
      uid,
    },
    involvedObject: {
      kind: 'TestApp',
      name: instanceName,
      namespace: overrides.namespace ?? 'default',
      uid: `${instanceName}-uid`,
    },
    reason: overrides.reason ?? 'Reconciling',
    message: `Event for ${instanceName}`,
    type: overrides.type ?? 'Normal',
    lastTimestamp: overrides.lastTimestamp ?? new Date().toISOString(),
  }
}

function renderEvents(route = '/events') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Events />
    </MemoryRouter>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('Events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows loading state initially', () => {
    mockedListEvents.mockReturnValue(new Promise(() => {}))
    renderEvents()
    expect(screen.getByTestId('events-loading')).toBeInTheDocument()
  })

  it('shows empty state when no kro events returned', async () => {
    mockedListEvents.mockResolvedValue({ items: [], metadata: {} })
    renderEvents()
    await waitFor(() => {
      expect(screen.getByTestId('events-empty')).toBeInTheDocument()
    })
    expect(screen.getByText('No kro-related events found')).toBeInTheDocument()
  })

  it('renders event rows from the API response', async () => {
    mockedListEvents.mockResolvedValue({
      items: [
        makeEventItem({ reason: 'Reconciling', instanceName: 'alpha' }),
        makeEventItem({ reason: 'Ready', instanceName: 'beta' }),
      ],
      metadata: {},
    })
    renderEvents()
    await waitFor(() => {
      const rows = screen.getAllByTestId('event-row')
      expect(rows).toHaveLength(2)
    })
    expect(screen.getByText('Reconciling')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('de-duplicates events across polls by metadata.uid', async () => {
    const item = makeEventItem({ uid: 'dup-uid', reason: 'DedupeCheck' })
    mockedListEvents.mockResolvedValue({ items: [item], metadata: {} })

    renderEvents()
    await waitFor(() => {
      expect(screen.getAllByTestId('event-row')).toHaveLength(1)
    })
    // Text confirms there's exactly 1 row.
    expect(screen.getByText('DedupeCheck')).toBeInTheDocument()

    // The same uid should not create a second row on the next poll.
    // The component will keep calling listEvents on its interval;
    // all calls return the same single item — map stays at size 1.
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getAllByTestId('event-row')).toHaveLength(1)
  })

  it('adds new events without duplicating existing ones', async () => {
    const firstItem = makeEventItem({ uid: 'uid-first', reason: 'EventFirst' })
    const secondItem = makeEventItem({ uid: 'uid-second', reason: 'EventSecond' })

    // Both events from the start — simulate a poll that returns 2 events.
    mockedListEvents.mockResolvedValue({
      items: [firstItem, secondItem],
      metadata: {},
    })

    renderEvents()
    await waitFor(() => {
      expect(screen.getAllByTestId('event-row')).toHaveLength(2)
    })
    // Both events shown exactly once.
    expect(screen.getByText('EventFirst')).toBeInTheDocument()
    expect(screen.getByText('EventSecond')).toBeInTheDocument()
  })

  it('groups events by instance when "By Instance" toggle is clicked', async () => {
    const user = userEvent.setup()
    mockedListEvents.mockResolvedValue({
      items: [
        makeEventItem({ instanceName: 'alpha', uid: 'a1', reason: 'AlphaEvent1' }),
        makeEventItem({ instanceName: 'alpha', uid: 'a2', reason: 'AlphaEvent2' }),
        makeEventItem({ instanceName: 'beta', uid: 'b1', reason: 'BetaEvent1' }),
      ],
      metadata: {},
    })

    renderEvents()
    await waitFor(() => {
      expect(screen.getAllByTestId('event-row')).toHaveLength(3)
    })

    // Switch to grouped view.
    await user.click(screen.getByText('By Instance'))
    expect(screen.getByTestId('events-grouped')).toBeInTheDocument()
    const groups = screen.getAllByTestId('event-group')
    expect(groups).toHaveLength(2)
    expect(screen.getByTestId('events-grouped')).toHaveTextContent('alpha')
    expect(screen.getByTestId('events-grouped')).toHaveTextContent('beta')
  })

  it('pre-filters events by ?instance= query param', async () => {
    mockedListEvents.mockResolvedValue({
      items: [
        makeEventItem({ instanceName: 'alpha', uid: 'a1', reason: 'AlphaEvent' }),
        makeEventItem({ instanceName: 'beta', uid: 'b1', reason: 'BetaEvent' }),
      ],
      metadata: {},
    })

    renderEvents('/events?instance=alpha')
    await waitFor(() => {
      expect(screen.getAllByTestId('event-row')).toHaveLength(1)
    })
    expect(screen.getByText('AlphaEvent')).toBeInTheDocument()
    // beta's event should not appear.
    expect(screen.queryByText('BetaEvent')).not.toBeInTheDocument()
  })

  it('shows error state when fetch fails', async () => {
    mockedListEvents.mockRejectedValue(new Error('cluster unreachable'))
    renderEvents()
    await waitFor(() => {
      expect(screen.getByTestId('events-error')).toBeInTheDocument()
    })
    expect(screen.getByText(/cluster unreachable/)).toBeInTheDocument()
  })

  it('passes rgd param to listEvents when ?rgd= is set', async () => {
    mockedListEvents.mockResolvedValue({ items: [], metadata: {} })
    renderEvents('/events?rgd=my-rgd')
    await waitFor(() => {
      expect(mockedListEvents).toHaveBeenCalledWith(undefined, 'my-rgd')
    })
  })

  it('shows filter inputs pre-populated from ?instance= and ?rgd= params', async () => {
    mockedListEvents.mockResolvedValue({ items: [], metadata: {} })
    renderEvents('/events?instance=my-app&rgd=my-rgd')
    // The filter inputs are pre-populated from URL params.
    const rgdInput = screen.getByTestId('rgd-filter-input') as HTMLInputElement
    const instanceInput = screen.getByTestId('instance-filter-input') as HTMLInputElement
    expect(rgdInput.value).toBe('my-rgd')
    expect(instanceInput.value).toBe('my-app')
    // Clear filters button should appear when both filters are active
    expect(screen.getByTestId('clear-filters-btn')).toBeInTheDocument()
  })

  // ── Issue #254: instance filter uses substring match ────────────────────

  it('T254: instance filter matches partial name (substring)', async () => {
    // Two events — one with name "my-app-v2" and one with "other-app"
    const appV2Event = makeEventItem({ uid: 'u1', instanceName: 'my-app-v2' })
    const otherEvent = makeEventItem({ uid: 'u2', instanceName: 'other-app' })
    mockedListEvents.mockResolvedValue({
      items: [appV2Event, otherEvent],
      metadata: {},
    })

    // Filter by prefix "my-app" — should match "my-app-v2" but not "other-app"
    renderEvents('/events?instance=my-app')

    await waitFor(() => {
      expect(screen.queryByTestId('events-loading')).not.toBeInTheDocument()
    })

    // "my-app-v2" event should appear (partial match)
    expect(screen.getByText('Event for my-app-v2')).toBeInTheDocument()
    // "other-app" event should not appear
    expect(screen.queryByText('Event for other-app')).not.toBeInTheDocument()
  })

  it('T254b: exact instance name still matches', async () => {
    const exactEvent = makeEventItem({ uid: 'u3', instanceName: 'exact-name' })
    mockedListEvents.mockResolvedValue({ items: [exactEvent], metadata: {} })

    renderEvents('/events?instance=exact-name')

    await waitFor(() => {
      expect(screen.queryByTestId('events-loading')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Event for exact-name')).toBeInTheDocument()
  })
})
