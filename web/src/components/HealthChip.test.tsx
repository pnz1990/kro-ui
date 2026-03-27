// HealthChip.test.tsx — Unit tests for the HealthChip component.
// Spec: .specify/specs/028-instance-health-rollup/spec.md US1

import { render, screen } from '@testing-library/react'
import HealthChip from './HealthChip'
import type { HealthSummary } from '@/lib/format'

function makeSummary(overrides: Partial<HealthSummary> = {}): HealthSummary {
  return {
    total: 0,
    ready: 0,
    degraded: 0,
    error: 0,
    reconciling: 0,
    pending: 0,
    unknown: 0,
    ...overrides,
  }
}

describe('HealthChip', () => {
  it('renders skeleton when summary is null and loading=true', () => {
    const { container } = render(<HealthChip summary={null} loading={true} />)
    const el = container.querySelector('.health-chip--skeleton')
    expect(el).not.toBeNull()
  })

  it('renders nothing when summary is null and loading=false', () => {
    const { container } = render(<HealthChip summary={null} loading={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders "no instances" when total is 0', () => {
    render(<HealthChip summary={makeSummary({ total: 0 })} />)
    expect(screen.getByTestId('health-chip')).toHaveTextContent('no instances')
  })

  it('renders "{total} ready" when all instances ready, uses data-state="ready"', () => {
    const summary = makeSummary({ total: 5, ready: 5 })
    render(<HealthChip summary={summary} />)
    const chip = screen.getByTestId('health-chip')
    expect(chip).toHaveTextContent('5 ready')
    expect(chip).toHaveAttribute('data-state', 'ready')
  })

  it('renders bar segments when error > 0, uses data-state="error"', () => {
    const summary = makeSummary({ total: 5, ready: 3, error: 2 })
    render(<HealthChip summary={summary} />)
    const chip = screen.getByTestId('health-chip')
    expect(chip).toHaveTextContent('✗ 2')
    expect(chip).toHaveTextContent('3 ready')
    expect(chip).toHaveAttribute('data-state', 'error')
  })

  it('renders bar segments when reconciling > 0 (no errors), uses data-state="reconciling"', () => {
    const summary = makeSummary({ total: 5, ready: 3, reconciling: 2 })
    render(<HealthChip summary={summary} />)
    const chip = screen.getByTestId('health-chip')
    expect(chip).toHaveTextContent('↻ 2')
    expect(chip).toHaveTextContent('3 ready')
    expect(chip).toHaveAttribute('data-state', 'reconciling')
  })

  it('renders bar segments when degraded > 0, uses data-state="degraded"', () => {
    const summary = makeSummary({ total: 3, ready: 2, degraded: 1 })
    render(<HealthChip summary={summary} />)
    const chip = screen.getByTestId('health-chip')
    expect(chip).toHaveTextContent('⚠ 1')
    expect(chip).toHaveTextContent('2 ready')
    expect(chip).toHaveAttribute('data-state', 'degraded')
  })

  it('renders bar segments when only unknown, uses data-state="unknown"', () => {
    const summary = makeSummary({ total: 3, ready: 1, unknown: 2 })
    render(<HealthChip summary={summary} />)
    const chip = screen.getByTestId('health-chip')
    expect(chip).toHaveTextContent('? 2')
    expect(chip).toHaveTextContent('1 ready')
    expect(chip).toHaveAttribute('data-state', 'unknown')
  })

  it('error takes precedence over reconciling for data-state', () => {
    const summary = makeSummary({ total: 5, ready: 2, error: 1, reconciling: 2 })
    render(<HealthChip summary={summary} />)
    const chip = screen.getByTestId('health-chip')
    expect(chip).toHaveAttribute('data-state', 'error')
  })

  it('degraded takes precedence over reconciling but not error', () => {
    const summary = makeSummary({ total: 6, ready: 2, degraded: 2, reconciling: 2 })
    render(<HealthChip summary={summary} />)
    expect(screen.getByTestId('health-chip')).toHaveAttribute('data-state', 'degraded')
    const summary2 = makeSummary({ total: 6, ready: 1, error: 1, degraded: 2, reconciling: 2 })
    const { unmount } = render(<HealthChip summary={summary2} />)
    // error wins over degraded
    const chips = screen.getAllByTestId('health-chip')
    expect(chips[chips.length - 1]).toHaveAttribute('data-state', 'error')
    unmount()
  })

  it('always renders data-testid="health-chip" when summary is present', () => {
    render(<HealthChip summary={makeSummary({ total: 1, ready: 1 })} />)
    expect(screen.getByTestId('health-chip')).toBeInTheDocument()
  })
})
