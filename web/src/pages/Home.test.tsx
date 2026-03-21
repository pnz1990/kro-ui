import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'

vi.mock('@/lib/api', () => ({
  listRGDs: vi.fn(),
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

function makeItem(name: string) {
  return {
    metadata: { name, creationTimestamp: '2026-03-15T10:00:00Z' },
    spec: { schema: { kind: name.charAt(0).toUpperCase() + name.slice(1) }, resources: [{}] },
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
    const skeletons = container.querySelectorAll('[aria-hidden="true"]')
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
})
