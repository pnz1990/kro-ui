import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
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

describe('TopBar', () => {
  it('displays context name', () => {
    render(
      <TopBar contexts={contexts} activeContext="minikube" onSwitch={vi.fn()} />,
    )
    expect(screen.getByTestId('context-name')).toHaveTextContent('minikube')
  })

  it('passes activeContext to ContextSwitcher', () => {
    const longName = 'arn:aws:eks:us-west-2:123456789012:cluster/my-very-long-cluster-name'
    render(
      <TopBar contexts={contexts} activeContext={longName} onSwitch={vi.fn()} />,
    )
    expect(screen.getByTestId('context-name')).toHaveAttribute('title', longName)
  })

  it('does not truncate short context names', () => {
    render(
      <TopBar contexts={contexts} activeContext="minikube" onSwitch={vi.fn()} />,
    )
    const el = screen.getByTestId('context-name')
    expect(el.textContent).toBe('minikube')
    expect(el).toHaveAttribute('title', 'minikube')
  })

  it('displays kro-ui branding', () => {
    render(
      <TopBar contexts={contexts} activeContext="test" onSwitch={vi.fn()} />,
    )
    expect(screen.getByText('kro-ui')).toBeInTheDocument()
    expect(screen.getByAltText('kro-ui')).toBeInTheDocument()
  })

  it('calls onSwitch when context is changed', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn()
    render(
      <TopBar contexts={contexts} activeContext="minikube" onSwitch={onSwitch} />,
    )
    await user.click(screen.getByTestId('context-switcher-btn'))
    expect(onSwitch).toHaveBeenCalledWith('other')
  })
})
