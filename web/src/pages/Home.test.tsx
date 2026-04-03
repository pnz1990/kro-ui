// Home.test.tsx — Overview SRE Dashboard (spec 062)
// Tests widget rendering, data mapping, and key UI states.

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'
import type { AllInstancesResponse, ControllerMetrics, K8sList, KroCapabilities } from '@/lib/api'

// ── Mock API ────────────────────────────────────────────────────────────

const mockListAllInstances = vi.fn()
const mockListRGDs = vi.fn()
const mockGetControllerMetrics = vi.fn()
const mockGetCapabilities = vi.fn()
const mockListEvents = vi.fn()

vi.mock('@/lib/api', () => ({
  listAllInstances: (...args: unknown[]) => mockListAllInstances(...args),
  listRGDs: (...args: unknown[]) => mockListRGDs(...args),
  getControllerMetrics: (...args: unknown[]) => mockGetControllerMetrics(...args),
  getCapabilities: (...args: unknown[]) => mockGetCapabilities(...args),
  listEvents: (...args: unknown[]) => mockListEvents(...args),
}))

// ── Helpers ─────────────────────────────────────────────────────────────

function makeCapabilities(version = 'v0.9.0'): KroCapabilities {
  return {
    version, apiVersion: 'kro.run/v1alpha1', featureGates: {},
    knownResources: [], isSupported: true,
    schema: { hasForEach: true, hasExternalRef: true, hasExternalRefSelector: true, hasScope: true, hasTypes: true, hasGraphRevisions: true },
  }
}

function makeMetrics(): ControllerMetrics {
  return { watchCount: 42, gvrCount: 10, queueDepth: 0, workqueueDepth: 0, scrapedAt: '2026-04-01T00:00:00Z' }
}

function emptyInstancesResponse(): AllInstancesResponse {
  return { items: [], total: 0 }
}

function emptyList(): K8sList {
  return { items: [], metadata: {} }
}

function setupDefaultMocks() {
  mockListAllInstances.mockResolvedValue(emptyInstancesResponse())
  mockListRGDs.mockResolvedValue(emptyList())
  mockGetControllerMetrics.mockResolvedValue(makeMetrics())
  mockGetCapabilities.mockResolvedValue(makeCapabilities())
  mockListEvents.mockResolvedValue(emptyList())
}

function renderHome() {
  return render(<MemoryRouter><Home /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupDefaultMocks()
})

// ── Smoke test ──────────────────────────────────────────────────────────

describe('Home (Overview)', () => {
  it('renders without crashing', async () => {
    renderHome()
    await waitFor(() => expect(screen.getByTestId('overview-refresh')).toBeInTheDocument())
  })

  it('sets page title to Overview — kro-ui', async () => {
    renderHome()
    await waitFor(() => expect(document.title).toBe('Overview — kro-ui'))
  })
})

// ── Widget containers ───────────────────────────────────────────────────

describe('widget containers', () => {
  it('renders all 7 widget testids after load', async () => {
    renderHome()
    await waitFor(() => {
      expect(screen.getByTestId('widget-instances')).toBeInTheDocument()
      expect(screen.getByTestId('widget-metrics')).toBeInTheDocument()
      expect(screen.getByTestId('widget-rgd-errors')).toBeInTheDocument()
      expect(screen.getByTestId('widget-reconciling')).toBeInTheDocument()
      expect(screen.getByTestId('widget-top-erroring')).toBeInTheDocument()
      expect(screen.getByTestId('widget-events')).toBeInTheDocument()
      expect(screen.getByTestId('widget-activity')).toBeInTheDocument()
    })
  })
})

// ── W-1: Instance Health distribution ──────────────────────────────────

describe('W-1 Instance Health', () => {
  it('shows correct counts for mixed-state instances', async () => {
    mockListAllInstances.mockResolvedValue({
      total: 4,
      items: [
        { name: 'a', namespace: 'ns', kind: 'X', rgdName: 'r', state: 'ACTIVE', ready: 'True', creationTimestamp: '' },
        { name: 'b', namespace: 'ns', kind: 'X', rgdName: 'r', state: 'ACTIVE', ready: 'True', creationTimestamp: '' },
        { name: 'c', namespace: 'ns', kind: 'X', rgdName: 'r', state: 'IN_PROGRESS', ready: '', creationTimestamp: '' },
        { name: 'd', namespace: 'ns', kind: 'X', rgdName: 'r', state: 'ACTIVE', ready: 'False', creationTimestamp: '' },
      ],
    })
    renderHome()
    await waitFor(() => {
      expect(screen.getByTestId('instance-health-widget')).toBeInTheDocument()
      // Total count shown
      expect(screen.getByTestId('instance-health-widget').textContent).toContain('4')
    })
  })

  it('shows "No instances" empty state when total is 0', async () => {
    renderHome()
    await waitFor(() => {
      expect(document.querySelector('.ihw__empty')).toHaveTextContent('No instances')
    })
  })
})

// ── W-3: RGD Compile Errors ─────────────────────────────────────────────

describe('W-3 RGD Compile Errors', () => {
  it('shows clean state when no RGDs have errors', async () => {
    mockListRGDs.mockResolvedValue({
      items: [{
        metadata: { name: 'my-rgd' },
        status: { conditions: [{ type: 'Ready', status: 'True' }] },
      }],
      metadata: {},
    })
    renderHome()
    await waitFor(() => {
      expect(screen.getByText(/compile cleanly/i)).toBeInTheDocument()
    })
  })

  it('shows list of erroring RGDs when errors exist', async () => {
    mockListRGDs.mockResolvedValue({
      items: [{
        metadata: { name: 'broken-rgd' },
        status: { conditions: [{ type: 'Ready', status: 'False', reason: 'CompileError', message: 'bad CEL' }] },
      }],
      metadata: {},
    })
    renderHome()
    await waitFor(() => {
      expect(screen.getByText('broken-rgd')).toBeInTheDocument()
    })
  })
})

// ── W-2: Controller Metrics ─────────────────────────────────────────────

describe('W-2 Controller Metrics', () => {
  it('shows metric values and kro version', async () => {
    renderHome()
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument()
      expect(screen.getByText(/kro v0\.9\.0/)).toBeInTheDocument()
    })
  })

  it('shows "Not reported" for null metric values', async () => {
    mockGetControllerMetrics.mockResolvedValue({
      watchCount: null, gvrCount: null, queueDepth: null, workqueueDepth: null, scrapedAt: '',
    })
    renderHome()
    await waitFor(() => {
      expect(screen.getAllByText('Not reported').length).toBeGreaterThan(0)
    })
  })

  it('shows widget-level error when metrics fail', async () => {
    mockGetControllerMetrics.mockRejectedValue(new Error('503'))
    renderHome()
    await waitFor(() => {
      expect(screen.getByText(/Could not load Controller Metrics/i)).toBeInTheDocument()
    })
  })
})

// ── Refresh button ──────────────────────────────────────────────────────

describe('Refresh button', () => {
  it('is visible after load', async () => {
    renderHome()
    await waitFor(() => {
      expect(screen.getByTestId('overview-refresh')).toBeInTheDocument()
    })
  })

  it('is disabled and shows "Refreshing" label while fetching', async () => {
    // Never resolves — keeps fetch in-flight
    mockListAllInstances.mockReturnValue(new Promise(() => {}))
    renderHome()
    await waitFor(() => {
      const btn = screen.getByTestId('overview-refresh')
      expect(btn).toBeDisabled()
      expect(btn.textContent).toMatch(/Refreshing/i)
    })
  })

  it('re-fetches all sources on click', async () => {
    renderHome()
    await waitFor(() => expect(screen.getByTestId('overview-refresh')).not.toBeDisabled())
    await userEvent.click(screen.getByTestId('overview-refresh'))
    expect(mockListAllInstances).toHaveBeenCalledTimes(2)
  })
})

// ── Layout toggle (removed — grid only now) ─────────────────────────────

describe('Layout toggle', () => {
  it('Overview page always uses grid layout', async () => {
    renderHome()
    await waitFor(() => expect(document.querySelector('.home__grid')).toBeInTheDocument())
  })
})

// ── W-4: Reconciling Queue ──────────────────────────────────────────────

describe('W-4 Reconciling Queue', () => {
  it('shows green empty state when no reconciling instances', async () => {
    renderHome()
    await waitFor(() => {
      expect(screen.getByText('✓ No instances reconciling')).toBeInTheDocument()
    })
  })

  it('shows amber stuck count when instances may be stuck', async () => {
    // 1 reconciling instance created 10 minutes ago
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    mockListAllInstances.mockResolvedValue({
      total: 1,
      items: [{ name: 'stuck-one', namespace: 'ns', kind: 'X', rgdName: 'r', state: 'IN_PROGRESS', ready: '', creationTimestamp: tenMinAgo }],
    })
    renderHome()
    await waitFor(() => {
      // W-4 shows the "N may be stuck > 5 min" secondary line with amber styling
      const stuck = document.querySelector('.home__reconciling-stuck')
      expect(stuck).toBeInTheDocument()
      expect(stuck!.textContent).toMatch(/may be stuck/i)
    })
  })
})

// ── W-5: Top Erroring RGDs ──────────────────────────────────────────────

describe('W-5 Top Erroring RGDs', () => {
  it('shows empty state when no error instances', async () => {
    renderHome()
    await waitFor(() => {
      expect(screen.getByText('No instance errors')).toBeInTheDocument()
    })
  })

  it('ranks RGDs by error count descending', async () => {
    mockListAllInstances.mockResolvedValue({
      total: 4,
      items: [
        { name: 'a1', namespace: 'ns', kind: 'X', rgdName: 'alpha', state: 'ACTIVE', ready: 'False', creationTimestamp: '' },
        { name: 'a2', namespace: 'ns', kind: 'X', rgdName: 'alpha', state: 'ACTIVE', ready: 'False', creationTimestamp: '' },
        { name: 'a3', namespace: 'ns', kind: 'X', rgdName: 'alpha', state: 'ACTIVE', ready: 'False', creationTimestamp: '' },
        { name: 'b1', namespace: 'ns', kind: 'X', rgdName: 'beta',  state: 'ACTIVE', ready: 'False', creationTimestamp: '' },
      ],
    })
    renderHome()
    await waitFor(() => {
      const widget = screen.getByTestId('widget-top-erroring')
      const rows = widget.querySelectorAll('.home__top-erroring-row')
      expect(rows[0].textContent).toContain('alpha')
      expect(rows[1].textContent).toContain('beta')
    })
  })
})

// ── Full-page error ─────────────────────────────────────────────────────

describe('full-page error', () => {
  it('shows full-page error only when both instances AND rgds fail', async () => {
    mockListAllInstances.mockRejectedValue(new Error('network'))
    mockListRGDs.mockRejectedValue(new Error('network'))
    renderHome()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/Could not load cluster data/i)).toBeInTheDocument()
    })
  })

  it('does NOT show full-page error when only one source fails', async () => {
    mockListAllInstances.mockRejectedValue(new Error('network'))
    // rgds succeeds
    renderHome()
    await waitFor(() => {
      expect(screen.queryByText(/Could not load cluster data/i)).not.toBeInTheDocument()
    })
  })
})
