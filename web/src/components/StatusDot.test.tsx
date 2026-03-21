import { render, screen } from '@testing-library/react'
import StatusDot from './StatusDot'

describe('StatusDot', () => {
  it('renders green dot when state is ready', () => {
    const { container } = render(<StatusDot state="ready" />)
    const dot = container.querySelector('.status-dot')
    expect(dot).toHaveClass('status-dot--ready')
  })

  it('renders red dot when state is error', () => {
    const { container } = render(<StatusDot state="error" />)
    const dot = container.querySelector('.status-dot')
    expect(dot).toHaveClass('status-dot--error')
  })

  it('renders gray dot when state is unknown', () => {
    const { container } = render(<StatusDot state="unknown" />)
    const dot = container.querySelector('.status-dot')
    expect(dot).toHaveClass('status-dot--unknown')
  })

  it('shows reason and message in title tooltip', () => {
    render(
      <StatusDot state="ready" reason="ReconcileSuccess" message="All good" />,
    )
    const dot = screen.getByTestId('status-dot')
    expect(dot).toHaveAttribute('title', 'ReconcileSuccess: All good')
  })

  it('shows state label in title when no reason', () => {
    render(<StatusDot state="ready" />)
    const dot = screen.getByTestId('status-dot')
    expect(dot).toHaveAttribute('title', 'Ready')
  })

  it('has appropriate aria-label for accessibility', () => {
    render(<StatusDot state="error" />)
    const dot = screen.getByTestId('status-dot')
    expect(dot).toHaveAttribute('aria-label', 'Status: Not Ready')
  })
})
