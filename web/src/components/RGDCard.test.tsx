import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RGDCard from './RGDCard'
import type { K8sObject } from '@/lib/api'

// Prevent real network calls; keep the promise pending so we can inspect
// the initial render before any async state update.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    listInstances: vi.fn(() => new Promise(() => {})),
  }
})

function renderCard(rgd: K8sObject) {
  return render(
    <MemoryRouter>
      <RGDCard rgd={rgd} />
    </MemoryRouter>,
  )
}

function makeRGD(overrides: Record<string, unknown> = {}): K8sObject {
  return {
    metadata: {
      name: 'test-app',
      creationTimestamp: '2026-03-15T10:00:00Z',
    },
    spec: {
      schema: { kind: 'TestApp' },
      resources: [{}, {}, {}],
    },
    status: {
      conditions: [
        { type: 'Ready', status: 'True', reason: 'OK', message: 'All good' },
      ],
    },
    ...overrides,
  }
}

describe('RGDCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('displays RGD name', () => {
    renderCard(makeRGD())
    expect(screen.getByTestId('rgd-name')).toHaveTextContent('test-app')
  })

  it('displays kind badge when kind exists', () => {
    renderCard(makeRGD())
    expect(screen.getByTestId('rgd-kind')).toHaveTextContent('TestApp')
  })

  it('omits kind badge when kind is missing', () => {
    renderCard(makeRGD({ spec: { resources: [] } }))
    expect(screen.queryByTestId('rgd-kind')).not.toBeInTheDocument()
  })

  it('displays resource count', () => {
    renderCard(makeRGD())
    expect(screen.getByText(/3 resources/)).toBeInTheDocument()
  })

  it('displays formatted age', () => {
    renderCard(makeRGD())
    // 2026-03-15 to 2026-03-20 = 5 days
    expect(screen.getByText('5d')).toBeInTheDocument()
  })

  it('renders Graph link with correct href', () => {
    renderCard(makeRGD())
    const link = screen.getByTestId('btn-graph')
    expect(link).toHaveAttribute('href', '/rgds/test-app')
  })

  it('renders Instances link with correct href', () => {
    renderCard(makeRGD())
    const link = screen.getByTestId('btn-instances')
    expect(link).toHaveAttribute('href', '/rgds/test-app?tab=instances')
  })

  it('URL-encodes special characters in name', () => {
    renderCard(
      makeRGD({
        metadata: {
          name: 'app/with spaces',
          creationTimestamp: '2026-03-15T10:00:00Z',
        },
      }),
    )
    const link = screen.getByTestId('btn-graph')
    expect(link).toHaveAttribute('href', '/rgds/app%2Fwith%20spaces')
  })

  it('renders correct status dot state', () => {
    const { container } = renderCard(makeRGD())
    const dot = container.querySelector('.status-dot')
    expect(dot).toHaveClass('status-dot--ready')
  })

  // Regression: #262 — chipLoading must be initialised to Boolean(name) so that
  // HealthChip does NOT flash a skeleton shimmer when the card has no name.
  it('does not render health-chip skeleton on first render when name is absent', () => {
    const { container } = renderCard(
      makeRGD({ metadata: { creationTimestamp: '2026-03-15T10:00:00Z' } }),
    )
    // When name is empty, chipLoading starts false → no skeleton element
    expect(container.querySelector('.health-chip--skeleton')).not.toBeInTheDocument()
  })

  it('renders health-chip skeleton on first render when name is present', () => {
    const { container } = renderCard(makeRGD())
    // When name is non-empty, chipLoading starts true → skeleton visible before fetch
    expect(container.querySelector('.health-chip--skeleton')).toBeInTheDocument()
  })
})
