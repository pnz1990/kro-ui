import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi } from 'vitest'
import Layout from './Layout'

// Mock the API module
vi.mock('@/lib/api', () => ({
  listContexts: vi.fn(),
  getVersion: vi.fn().mockResolvedValue({ version: 'v0.5.0-test', commit: 'abc', buildDate: '2026' }),
  getCapabilities: vi.fn().mockResolvedValue({
    version: 'v0.8.5', apiVersion: 'kro.run/v1alpha1',
    featureGates: {}, knownResources: [], schema: {}, isSupported: true,
  }),
}))

// Mock ContextSwitcher so Layout tests stay focused on wiring logic
vi.mock('./ContextSwitcher', () => ({
  default: ({
    active,
    onSwitch,
  }: {
    active: string
    onSwitch: (name: string) => void
  }) => (
    <div>
      <span data-testid="context-name">{active}</span>
      <button data-testid="context-switcher-btn" onClick={() => onSwitch('other-ctx')}>
        switch
      </button>
    </div>
  ),
}))

import { listContexts, getCapabilities } from '@/lib/api'

const mockedListContexts = vi.mocked(listContexts)
const mockedGetCapabilities = vi.mocked(getCapabilities)

function TestChild() {
  return <div data-testid="child-content">Child route content</div>
}

function renderLayout(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<TestChild />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders child route via Outlet', async () => {
    mockedListContexts.mockResolvedValue({
      contexts: [],
      active: 'test-context',
    })

    renderLayout()

    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument()
    })
  })

  it('renders TopBar with context name', async () => {
    mockedListContexts.mockResolvedValue({
      contexts: [],
      active: 'minikube',
    })

    renderLayout()

    await waitFor(() => {
      expect(screen.getByTestId('context-name')).toHaveTextContent('minikube')
    })
  })

  it('handles context fetch failure gracefully', async () => {
    mockedListContexts.mockRejectedValue(new Error('connection refused'))

    renderLayout()

    // Child route should still render even if context fetch fails
    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument()
    })

    // Issue #253: on error, activeContext is set to '(unavailable)' instead of ''
    // so the context switcher button shows a readable label rather than blank.
    expect(screen.getByTestId('context-name')).toHaveTextContent('(unavailable)')
  })

  it('updates displayed context name after switch', async () => {
    const user = userEvent.setup()
    mockedListContexts.mockResolvedValue({
      contexts: [
        { name: 'dev', cluster: 'dev', user: 'dev-user' },
        { name: 'other-ctx', cluster: 'other', user: 'other-user' },
      ],
      active: 'dev',
    })

    renderLayout()

    await waitFor(() => {
      expect(screen.getByTestId('context-name')).toHaveTextContent('dev')
    })

    await user.click(screen.getByTestId('context-switcher-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('context-name')).toHaveTextContent('other-ctx')
    })
  })
})

describe('Layout — skip-to-main-content link (WCAG 2.1 SC 2.4.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedListContexts.mockResolvedValue({ contexts: [], active: 'test-ctx' })
    mockedGetCapabilities.mockResolvedValue({
      version: 'v0.9.1', apiVersion: 'kro.run/v1alpha1',
      featureGates: {}, knownResources: [],
      schema: { hasForEach: true, hasExternalRef: true, hasExternalRefSelector: true, hasScope: true, hasTypes: true, hasGraphRevisions: true },
      isSupported: true,
    })
  })

  it('renders a skip-to-main-content link as the first focusable element', async () => {
    renderLayout()

    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument()
    })

    const skipLink = screen.getByRole('link', { name: /skip to main content/i })
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  it('skip link targets the main element with id="main-content"', async () => {
    renderLayout()

    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument()
    })

    // The <main> landmark must have id="main-content" for the skip link to work
    const main = document.querySelector('main')
    expect(main).not.toBeNull()
    expect(main!.id).toBe('main-content')
  })
})
  beforeEach(() => {
    vi.clearAllMocks()
    mockedListContexts.mockResolvedValue({ contexts: [], active: 'test-ctx' })
  })

  it('shows cluster-unreachable banner when getCapabilities fails with a network error', async () => {
    mockedGetCapabilities.mockRejectedValue(new TypeError('Failed to fetch'))

    renderLayout()

    await waitFor(() => {
      expect(screen.getByTestId('cluster-unreachable-banner')).toBeInTheDocument()
    })

    expect(screen.getByTestId('cluster-unreachable-banner')).toHaveAttribute('role', 'alert')
    expect(screen.getByTestId('cluster-unreachable-banner')).toHaveTextContent(
      'Cannot reach cluster',
    )
  })

  it('does not show banner when getCapabilities succeeds', async () => {
    mockedGetCapabilities.mockResolvedValue({
      version: 'v0.9.1', apiVersion: 'kro.run/v1alpha1',
      featureGates: {}, knownResources: [],
      schema: { hasForEach: true, hasExternalRef: true, hasExternalRefSelector: true, hasScope: true, hasTypes: true, hasGraphRevisions: true },
      isSupported: true,
    })

    renderLayout()

    // Wait for the component to settle after successful fetch (capabilities loaded = no banner)
    await waitFor(() => {
      expect(screen.queryByTestId('cluster-unreachable-banner')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('does not show banner when getCapabilities fails with a non-network HTTP error', async () => {
    // HTTP 403 is an HTTP error, not a network failure — cluster IS reachable
    mockedGetCapabilities.mockRejectedValue(new Error('403 Forbidden'))

    renderLayout()

    // Use waitFor to confirm banner never appears (give it time to settle)
    await waitFor(() => {
      expect(screen.queryByTestId('cluster-unreachable-banner')).not.toBeInTheDocument()
    })
  })

  it('shows banner when listContexts fails with a network error and getCapabilities also fails', async () => {
    mockedListContexts.mockRejectedValue(new TypeError('Failed to fetch'))
    mockedGetCapabilities.mockRejectedValue(new TypeError('Failed to fetch'))

    renderLayout()

    await waitFor(() => {
      expect(screen.getByTestId('cluster-unreachable-banner')).toBeInTheDocument()
    })
  })

  it('dismisses cluster-unreachable banner when dismiss button is clicked', async () => {
    const user = userEvent.setup()
    mockedGetCapabilities.mockRejectedValue(new TypeError('Failed to fetch'))

    renderLayout()

    await waitFor(() => {
      expect(screen.getByTestId('cluster-unreachable-banner')).toBeInTheDocument()
    })

    const dismissBtn = screen.getByRole('button', { name: /dismiss cluster unreachable/i })
    await user.click(dismissBtn)

    await waitFor(() => {
      expect(screen.queryByTestId('cluster-unreachable-banner')).not.toBeInTheDocument()
    })
  })

  it('banner includes a Retry button', async () => {
    mockedGetCapabilities.mockRejectedValue(new TypeError('Failed to fetch'))

    renderLayout()

    await waitFor(() => {
      expect(screen.getByTestId('cluster-unreachable-banner')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('clears cluster-unreachable banner after context switch when getCapabilities succeeds', async () => {
    const user = userEvent.setup()
    // Initial load: capabilities fail (network error)
    mockedGetCapabilities.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    // After context switch: capabilities succeed
    mockedGetCapabilities.mockResolvedValue({
      version: 'v0.9.1', apiVersion: 'kro.run/v1alpha1',
      featureGates: {}, knownResources: [],
      schema: { hasForEach: true, hasExternalRef: true, hasExternalRefSelector: true, hasScope: true, hasTypes: true, hasGraphRevisions: true },
      isSupported: true,
    })

    renderLayout()

    // Banner appears on initial load
    await waitFor(() => {
      expect(screen.getByTestId('cluster-unreachable-banner')).toBeInTheDocument()
    })

    // Switch context — capabilities probe succeeds on new context
    await user.click(screen.getByTestId('context-switcher-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId('cluster-unreachable-banner')).not.toBeInTheDocument()
    })
  })

  it('shows banner for "connection refused" error message (Go backend surfacing k8s error)', async () => {
    mockedGetCapabilities.mockRejectedValue(new Error('connection refused'))

    renderLayout()

    await waitFor(() => {
      expect(screen.getByTestId('cluster-unreachable-banner')).toBeInTheDocument()
    })
  })

  it('shows banner for "dial tcp" error message (Go backend TCP dial failure)', async () => {
    mockedGetCapabilities.mockRejectedValue(new Error('dial tcp: connect: connection refused'))

    renderLayout()

    await waitFor(() => {
      expect(screen.getByTestId('cluster-unreachable-banner')).toBeInTheDocument()
    })
  })
})
