// InstanceDetail.test.tsx — unit tests for the live instance detail page.
//
// Issue #217: InstanceDetail was the only major page without tests.
// Covers breadcrumb navigation, loading/error/success states, polling cleanup,
// and graceful degradation for absent status.conditions.

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import InstanceDetail from './InstanceDetail'

// ── API mocks ───────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  getInstance: vi.fn(),
  getInstanceEvents: vi.fn(),
  getInstanceChildren: vi.fn(),
  getRGD: vi.fn(),
  listRGDs: vi.fn(),
}))

import {
  getInstance,
  getInstanceEvents,
  getInstanceChildren,
  getRGD,
  listRGDs,
} from '@/lib/api'

const mockedGetInstance = vi.mocked(getInstance)
const mockedGetInstanceEvents = vi.mocked(getInstanceEvents)
const mockedGetInstanceChildren = vi.mocked(getInstanceChildren)
const mockedGetRGD = vi.mocked(getRGD)
const mockedListRGDs = vi.mocked(listRGDs)

// ── Test helpers ────────────────────────────────────────────────────────────

function makeInstance(name = 'my-app', conditions: unknown[] = [
  { type: 'Ready', status: 'True' },
]) {
  return {
    apiVersion: 'app.k8s.io/v1alpha1',
    kind: 'WebApp',
    metadata: {
      name,
      namespace: 'default',
      creationTimestamp: '2026-01-01T00:00:00Z',
    },
    status: { conditions },
  }
}

function makeRGD(name = 'test-app') {
  return {
    metadata: { name },
    spec: {
      schema: { kind: 'WebApp', apiVersion: 'v1alpha1', group: 'app.k8s.io' },
      resources: [
        { id: 'cfg', template: { apiVersion: 'v1', kind: 'ConfigMap' } },
      ],
    },
  }
}

function renderPage(rgdName = 'test-app', namespace = 'default', instanceName = 'my-app') {
  return render(
    <MemoryRouter initialEntries={[`/rgds/${rgdName}/instances/${namespace}/${instanceName}`]}>
      <Routes>
        <Route
          path="/rgds/:rgdName/instances/:namespace/:instanceName"
          element={<InstanceDetail />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('InstanceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Do NOT use fake timers here — usePolling uses setInterval and
    // vi.runAllTimersAsync() would create an infinite loop.
    // We drive state via resolved/rejected promises and waitFor() instead.

    // Default: all APIs resolve successfully (return immediately)
    mockedGetInstance.mockResolvedValue(makeInstance())
    mockedGetInstanceEvents.mockResolvedValue({ items: [], metadata: {} })
    mockedGetInstanceChildren.mockResolvedValue({ items: [] })
    mockedGetRGD.mockResolvedValue(makeRGD())
    mockedListRGDs.mockResolvedValue({ items: [], metadata: {} })
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  it('renders the breadcrumb nav immediately (before data resolves)', () => {
    mockedGetInstance.mockReturnValue(new Promise(() => {}))
    mockedGetInstanceEvents.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
  })

  // ── Breadcrumbs ────────────────────────────────────────────────────────────

  it('renders breadcrumb with Overview → rgdName → Instances → instanceName', async () => {
    renderPage('test-app', 'default', 'my-app')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/')
    })

    expect(screen.getByRole('link', { name: 'test-app' })).toHaveAttribute('href', '/rgds/test-app')
    expect(screen.getByRole('link', { name: 'Instances' })).toHaveAttribute(
      'href',
      '/rgds/test-app?tab=instances',
    )
    // Instance name appears as aria-current="page" breadcrumb item (no link)
    expect(screen.getByText('my-app', { selector: '.breadcrumb-current' })).toBeInTheDocument()
  })

  // ── Page title ─────────────────────────────────────────────────────────────

  it('sets document.title to "<instanceName> / <rgdName> — kro-ui"', async () => {
    renderPage('test-app', 'default', 'my-app')
    await waitFor(() => expect(document.title).toBe('my-app / test-app — kro-ui'))
  })

  // ── Success renders ────────────────────────────────────────────────────────

  it('renders the instance-detail-page testid after data loads', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('instance-detail-page')).toBeInTheDocument()
    })
  })

  // ── Graceful degradation — absent conditions ───────────────────────────────

  it('does not render "Pending" text when status.conditions is absent', async () => {
    mockedGetInstance.mockResolvedValue(makeInstance('my-app', []))
    renderPage()
    await waitFor(() => screen.getByTestId('instance-detail-page'))
    expect(screen.queryByText('Pending')).not.toBeInTheDocument()
  })

  // ── Error state ────────────────────────────────────────────────────────────

  it('renders page structure even when poll fails', async () => {
    mockedGetInstance.mockRejectedValue(new Error('not found'))
    mockedGetInstanceEvents.mockRejectedValue(new Error('not found'))
    renderPage()
    // Breadcrumb must always render
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
    })
  })

  // ── Polling interval cleanup ───────────────────────────────────────────────

  it('cleans up intervals on unmount — no unhandled state updates', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = renderPage()
    await waitFor(() => screen.getByTestId('instance-detail-page'))

    unmount()

    // At least one clearInterval should fire (children interval + tick interval)
    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })
})
