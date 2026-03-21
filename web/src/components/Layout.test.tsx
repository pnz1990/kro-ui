import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Layout from './Layout'

// Mock the API module
vi.mock('@/lib/api', () => ({
  listContexts: vi.fn(),
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

    // TopBar should render with empty context name
    expect(screen.getByTestId('context-name')).toHaveTextContent('')
  })
})
