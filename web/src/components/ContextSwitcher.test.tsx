import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ContextSwitcher, { truncateContextName } from './ContextSwitcher'
import type { KubeContext } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  switchContext: vi.fn(),
}))

import { switchContext } from '@/lib/api'

const mockedSwitchContext = vi.mocked(switchContext)

const contexts: KubeContext[] = [
  { name: 'dev', cluster: 'dev-cluster', user: 'dev-user' },
  { name: 'staging', cluster: 'stg-cluster', user: 'stg-user' },
  { name: 'production', cluster: 'prod-cluster', user: 'prod-user' },
]

function renderSwitcher(props?: {
  active?: string
  onSwitch?: (name: string) => void
  ctxList?: KubeContext[]
}) {
  const onSwitch = props?.onSwitch ?? vi.fn()
  return render(
    <ContextSwitcher
      contexts={props?.ctxList ?? contexts}
      active={props?.active ?? 'dev'}
      onSwitch={onSwitch}
    />,
  )
}

describe('truncateContextName', () => {
  it('returns name unchanged when ≤40 chars', () => {
    expect(truncateContextName('dev')).toBe('dev')
    expect(truncateContextName('a'.repeat(40))).toBe('a'.repeat(40))
  })

  it('abbreviates AWS EKS ARNs to accountPrefix…/clusterName', () => {
    const arn1 = 'arn:aws:eks:us-west-2:319279230668:cluster/krombat'
    expect(truncateContextName(arn1)).toBe('319279\u2026/krombat')

    const arn2 = 'arn:aws:eks:us-west-2:569190534191:cluster/krombat'
    expect(truncateContextName(arn2)).toBe('569190\u2026/krombat')

    // The two ARNs that both used to truncate to "…/krombat" are now distinct
    expect(truncateContextName(arn1)).not.toBe(truncateContextName(arn2))
  })

  it('falls back to prefix…/lastName for long generic paths', () => {
    const name = 'some-very-long-context-name/cluster-name-here'
    const result = truncateContextName(name)
    expect(result).toContain('\u2026/')
    expect(result).toContain('cluster-name-here')
  })

  it('truncates non-path names at 40 chars with …', () => {
    const name = 'x'.repeat(50)
    expect(truncateContextName(name)).toBe('x'.repeat(40) + '\u2026')
  })
})

describe('ContextSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all context names when dropdown is opened', async () => {
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(screen.getByTestId('context-switcher-btn'))

    expect(screen.getByTestId('context-dropdown')).toBeInTheDocument()
    // 'dev' appears in both trigger and dropdown; use getAllByText
    expect(screen.getAllByText('dev').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('staging')).toBeInTheDocument()
    expect(screen.getByText('production')).toBeInTheDocument()
  })

  it('marks the active context with aria-selected', async () => {
    const user = userEvent.setup()
    renderSwitcher({ active: 'staging' })

    await user.click(screen.getByTestId('context-switcher-btn'))

    const dropdown = screen.getByTestId('context-dropdown')
    // The active option should have aria-selected="true"
    const options = dropdown.querySelectorAll('[role="option"]')
    const activeOption = Array.from(options).find(
      (el) => el.getAttribute('aria-selected') === 'true',
    )
    expect(activeOption).not.toBeNull()
    expect(activeOption?.textContent).toContain('staging')
  })

  it('shows loading state while switch request is in-flight', async () => {
    const user = userEvent.setup()
    let resolveSwitch!: (value: { active: string }) => void
    mockedSwitchContext.mockReturnValue(
      new Promise<{ active: string }>((resolve) => {
        resolveSwitch = resolve
      }),
    )

    renderSwitcher()
    await user.click(screen.getByTestId('context-switcher-btn'))
    await user.click(screen.getByText('staging'))

    // While promise is pending, the button should show a loading indicator
    const btn = screen.getByTestId('context-switcher-btn')
    expect(btn).toHaveAttribute('aria-busy', 'true')

    // Cleanup
    resolveSwitch({ active: 'staging' })
  })

  it('shows error message when switch fails', async () => {
    const user = userEvent.setup()
    mockedSwitchContext.mockRejectedValue(new Error('context not reachable'))

    renderSwitcher()
    await user.click(screen.getByTestId('context-switcher-btn'))
    await user.click(screen.getByText('staging'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByRole('alert').textContent).toContain('context not reachable')
  })

  it('calls onSwitch callback with new context name on success', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn()
    mockedSwitchContext.mockResolvedValue({ active: 'staging' })

    renderSwitcher({ onSwitch })
    await user.click(screen.getByTestId('context-switcher-btn'))
    await user.click(screen.getByText('staging'))

    await waitFor(() => {
      expect(onSwitch).toHaveBeenCalledWith('staging')
    })
  })

  it('does not call onSwitch when the active context is clicked', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn()

    renderSwitcher({ active: 'dev', onSwitch })
    await user.click(screen.getByTestId('context-switcher-btn'))

    // Click the already-active context
    const dropdown = screen.getByTestId('context-dropdown')
    const options = dropdown.querySelectorAll('[role="option"]')
    const activeOption = Array.from(options).find(
      (el) => el.getAttribute('aria-selected') === 'true',
    )
    expect(activeOption).not.toBeNull()
    if (!activeOption) throw new Error('active option not found')
    await user.click(activeOption)

    expect(mockedSwitchContext).not.toHaveBeenCalled()
    expect(onSwitch).not.toHaveBeenCalled()
  })

  it('closes dropdown after successful switch', async () => {
    const user = userEvent.setup()
    mockedSwitchContext.mockResolvedValue({ active: 'staging' })

    renderSwitcher()
    await user.click(screen.getByTestId('context-switcher-btn'))
    expect(screen.getByTestId('context-dropdown')).toBeInTheDocument()

    await user.click(screen.getByText('staging'))

    await waitFor(() => {
      expect(screen.queryByTestId('context-dropdown')).not.toBeInTheDocument()
    })
  })

  it('closes dropdown on Escape key', async () => {
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(screen.getByTestId('context-switcher-btn'))
    expect(screen.getByTestId('context-dropdown')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByTestId('context-dropdown')).not.toBeInTheDocument()
  })
})
