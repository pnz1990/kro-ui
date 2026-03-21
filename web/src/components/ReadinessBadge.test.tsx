import { render, screen } from '@testing-library/react'
import ReadinessBadge from './ReadinessBadge'
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
})
