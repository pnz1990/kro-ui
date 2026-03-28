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

import { listContexts } from '@/lib/api'

const mockedListContexts = vi.mocked(listContexts)

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
