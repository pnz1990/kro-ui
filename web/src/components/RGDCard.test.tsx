import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RGDCard, { buildErrorHint } from './RGDCard'
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

// ── buildErrorHint unit tests (spec 056) ───────────────────────────────────────

describe('buildErrorHint', () => {
  it('returns empty string when both reason and message are empty', () => {
    expect(buildErrorHint('', '')).toBe('')
  })

  it('returns reason alone when message is empty', () => {
    expect(buildErrorHint('InvalidResourceGraph', '')).toBe('InvalidResourceGraph')
  })

  it('returns message alone when reason is empty', () => {
    expect(buildErrorHint('', 'something went wrong')).toBe('something went wrong')
  })

  it('combines reason and message with colon', () => {
    expect(buildErrorHint('SomethingFailed', 'details here')).toBe('SomethingFailed: details here')
  })

  it('truncates combined text at 80 characters', () => {
    const long = 'a'.repeat(90)
    const result = buildErrorHint('Reason', long)
    expect(result).toHaveLength(81) // 80 chars + ellipsis
    expect(result.endsWith('…')).toBe(true)
  })

  it('does not truncate text at exactly 80 characters', () => {
    const reason = 'R'
    const message = 'a'.repeat(77) // "R: " + 77 = 80 chars total
    const result = buildErrorHint(reason, message)
    expect(result).toHaveLength(80)
    expect(result.endsWith('…')).toBe(false)
  })
})

// ── RGDCard error hint rendering tests ─────────────────────────────────────────

describe('RGDCard error hint', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  function makeErrorRGD(reason: string, message: string): K8sObject {
    return {
      metadata: { name: 'broken', creationTimestamp: '2026-03-15T10:00:00Z' },
      spec: { schema: { kind: 'BrokenApp' }, resources: [{}] },
      status: {
        conditions: [
          { type: 'Ready', status: 'False', reason, message },
        ],
      },
    }
  }

  it('shows error hint on error-state card', () => {
    render(
      <MemoryRouter>
        <RGDCard rgd={makeErrorRGD('InvalidResourceGraph', 'references unknown identifiers: [j]')} />
      </MemoryRouter>
    )
    const hint = screen.getByTestId('rgd-card-error-hint')
    expect(hint).toBeInTheDocument()
    expect(hint.textContent).toContain('InvalidResourceGraph')
  })

  it('does not show error hint on ready-state card', () => {
    render(
      <MemoryRouter>
        <RGDCard rgd={makeErrorHint_ready()} />
      </MemoryRouter>
    )
    expect(screen.queryByTestId('rgd-card-error-hint')).not.toBeInTheDocument()
  })
})

function makeErrorHint_ready(): K8sObject {
  return {
    metadata: { name: 'ok-app', creationTimestamp: '2026-03-15T10:00:00Z' },
    spec: { schema: { kind: 'OkApp' }, resources: [{}] },
    status: {
      conditions: [{ type: 'Ready', status: 'True', reason: 'Ready', message: '' }],
    },
  }
}
