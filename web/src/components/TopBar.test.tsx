import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import TopBar from './TopBar'
import type { KubeContext } from '@/lib/api'

// Mock ContextSwitcher to keep TopBar tests focused on layout
vi.mock('./ContextSwitcher', () => ({
  default: ({ active, onSwitch }: { active: string; onSwitch: (name: string) => void }) => (
    <div>
      <span data-testid="context-name" title={active}>
        {active}
      </span>
      <button data-testid="context-switcher-btn" onClick={() => onSwitch('other')}>
        switch
      </button>
    </div>
  ),
}))

const contexts: KubeContext[] = [
  { name: 'minikube', cluster: 'minikube', user: 'minikube' },
  { name: 'other', cluster: 'other', user: 'other' },
]

function renderTopBar(props: { activeContext: string; onSwitch?: (name: string) => void }) {
  return render(
    <MemoryRouter>
      <TopBar contexts={contexts} activeContext={props.activeContext} onSwitch={props.onSwitch ?? vi.fn()} />
    </MemoryRouter>,
  )
}

describe('TopBar', () => {
  it('displays context name', () => {
    renderTopBar({ activeContext: 'minikube' })
    expect(screen.getByTestId('context-name')).toHaveTextContent('minikube')
  })

  it('passes activeContext to ContextSwitcher', () => {
    const longName = 'arn:aws:eks:us-west-2:123456789012:cluster/my-very-long-cluster-name'
    renderTopBar({ activeContext: longName })
    expect(screen.getByTestId('context-name')).toHaveAttribute('title', longName)
  })

  it('does not truncate short context names', () => {
    renderTopBar({ activeContext: 'minikube' })
    const el = screen.getByTestId('context-name')
    expect(el.textContent).toBe('minikube')
    expect(el).toHaveAttribute('title', 'minikube')
  })

  it('displays kro-ui branding', () => {
    renderTopBar({ activeContext: 'test' })
    expect(screen.getByText('kro-ui')).toBeInTheDocument()
    expect(screen.getByAltText('kro-ui')).toBeInTheDocument()
  })

  it('calls onSwitch when context is changed', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn()
    renderTopBar({ activeContext: 'minikube', onSwitch })
    await user.click(screen.getByTestId('context-switcher-btn'))
    expect(onSwitch).toHaveBeenCalledWith('other')
  })

  it('renders Home and Catalog nav links', () => {
    renderTopBar({ activeContext: 'test' })
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Catalog' })).toHaveAttribute('href', '/catalog')
  })
})
