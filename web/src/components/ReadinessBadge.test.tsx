import { render, screen } from '@testing-library/react'
import ReadinessBadge from './ReadinessBadge'
import { HEALTH_STATE_ICON } from '@/lib/format'
import type { ReadyStatus } from '@/lib/format'

function make(state: ReadyStatus['state'], reason = '', message = ''): ReadyStatus {
  return { state, reason, message }
}

describe('ReadinessBadge', () => {
  it('renders green Ready badge when Ready=True', () => {
    render(<ReadinessBadge status={make('ready')} />)
    const badge = screen.getByTestId('readiness-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('Ready')
    expect(badge).toHaveClass('readiness-badge--ready')
    expect(badge).toHaveAttribute('aria-label', 'Readiness: Ready')
    // tooltip is just the label when ready
    expect(badge).toHaveAttribute('title', 'Ready')
  })

  it('renders red Not Ready badge when Ready=False with reason tooltip', () => {
    render(
      <ReadinessBadge status={make('error', 'ImagePullBackOff', 'container failed')} />,
    )
    const badge = screen.getByTestId('readiness-badge')
    expect(badge).toHaveTextContent('Not Ready')
    expect(badge).toHaveClass('readiness-badge--error')
    expect(badge).toHaveAttribute('aria-label', 'Readiness: Not Ready')
    expect(badge).toHaveAttribute('title', 'ImagePullBackOff: container failed')
  })

  it('renders red Not Ready badge with reason only (no message)', () => {
    render(<ReadinessBadge status={make('error', 'CrashLoopBackOff')} />)
    const badge = screen.getByTestId('readiness-badge')
    expect(badge).toHaveAttribute('title', 'CrashLoopBackOff')
  })

  it('renders gray Unknown badge when conditions are absent', () => {
    render(<ReadinessBadge status={make('unknown')} />)
    const badge = screen.getByTestId('readiness-badge')
    expect(badge).toHaveTextContent('Unknown')
    expect(badge).toHaveClass('readiness-badge--unknown')
    expect(badge).toHaveAttribute('aria-label', 'Readiness: Unknown')
    // tooltip falls back to label
    expect(badge).toHaveAttribute('title', 'Unknown')
  })

  it('renders state icon as secondary signal for each state (WCAG 2.1 SC 1.4.1)', () => {
    const states: Array<ReadyStatus['state']> = ['ready', 'error', 'reconciling', 'unknown']
    for (const state of states) {
      const { container, unmount } = render(<ReadinessBadge status={make(state)} />)
      const iconEl = container.querySelector('.readiness-badge__icon')
      expect(iconEl, `icon missing for state=${state}`).not.toBeNull()
      expect(iconEl!.textContent, `wrong icon for state=${state}`).toBe(
        HEALTH_STATE_ICON[state as keyof typeof HEALTH_STATE_ICON] ?? '?'
      )
      unmount()
    }
  })

  it('icon has aria-hidden="true" to avoid screen reader double-reading', () => {
    const { container } = render(<ReadinessBadge status={make('error')} />)
    const iconEl = container.querySelector('.readiness-badge__icon')
    expect(iconEl).not.toBeNull()
    expect(iconEl!.getAttribute('aria-hidden')).toBe('true')
  })
})

