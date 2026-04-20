// Copyright 2026 The Kubernetes Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InstanceHealthWidget from './InstanceHealthWidget'
import type { HealthDistribution } from './InstanceHealthWidget'

function makeDistribution(overrides: Partial<HealthDistribution> = {}): HealthDistribution {
  return {
    ready: 0,
    degraded: 0,
    reconciling: 0,
    pending: 0,
    unknown: 0,
    error: 0,
    total: 0,
    ...overrides,
  }
}

describe('InstanceHealthWidget', () => {
  // ── Empty state ────────────────────────────────────────────────

  it('renders empty state when total=0', () => {
    render(<InstanceHealthWidget distribution={makeDistribution()} />)
    const widget = screen.getByTestId('instance-health-widget')
    expect(widget).toBeInTheDocument()
    expect(widget).toHaveClass('ihw--empty')
    expect(screen.getByText('No instances')).toBeInTheDocument()
  })

  // ── Donut chart renders ────────────────────────────────────────

  it('renders SVG donut chart when total > 0', () => {
    const { container } = render(
      <InstanceHealthWidget distribution={makeDistribution({ ready: 5, total: 5 })} />,
    )
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('.ihw')).not.toBeNull()
    expect(container.querySelector('.ihw--empty')).toBeNull()
  })

  it('SVG has accessible role and aria-label', () => {
    render(<InstanceHealthWidget distribution={makeDistribution({ ready: 3, total: 3 })} />)
    expect(screen.getByRole('img', { name: /instance health distribution/i })).toBeInTheDocument()
  })

  it('shows total count in the center of the donut', () => {
    render(
      <InstanceHealthWidget distribution={makeDistribution({ ready: 3, error: 2, total: 5 })} />,
    )
    // The center text element contains the total
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows "instances" label below total count', () => {
    render(
      <InstanceHealthWidget distribution={makeDistribution({ ready: 1, total: 1 })} />,
    )
    expect(screen.getByText('instances')).toBeInTheDocument()
  })

  // ── Legend ─────────────────────────────────────────────────────

  it('renders legend entries only for segments with count > 0', () => {
    render(
      <InstanceHealthWidget
        distribution={makeDistribution({ ready: 10, error: 2, total: 12 })}
      />,
    )
    // Should show Ready and Error in legend, not Reconciling/Pending/Unknown/Degraded
    const legend = document.querySelector('.ihw__legend')
    expect(legend).not.toBeNull()
    expect(legend?.textContent).toContain('Ready')
    expect(legend?.textContent).toContain('Error')
    expect(legend?.textContent).not.toContain('Reconciling')
    expect(legend?.textContent).not.toContain('Pending')
    expect(legend?.textContent).not.toContain('Unknown')
    expect(legend?.textContent).not.toContain('Degraded')
  })

  it('legend shows count for each active segment', () => {
    render(
      <InstanceHealthWidget
        distribution={makeDistribution({ ready: 7, reconciling: 3, total: 10 })}
      />,
    )
    const legend = document.querySelector('.ihw__legend')
    expect(legend?.textContent).toContain('7')
    expect(legend?.textContent).toContain('3')
  })

  it('renders all 6 health states when all have counts', () => {
    render(
      <InstanceHealthWidget
        distribution={{
          ready: 1,
          degraded: 1,
          reconciling: 1,
          pending: 1,
          unknown: 1,
          error: 1,
          total: 6,
        }}
      />,
    )
    const legend = document.querySelector('.ihw__legend')
    expect(legend?.textContent).toContain('Ready')
    expect(legend?.textContent).toContain('Degraded')
    expect(legend?.textContent).toContain('Reconciling')
    expect(legend?.textContent).toContain('Pending')
    expect(legend?.textContent).toContain('Unknown')
    expect(legend?.textContent).toContain('Error')
  })

  // ── SVG arc rendering ──────────────────────────────────────────

  it('renders one SVG arc per active health segment', () => {
    const { container } = render(
      <InstanceHealthWidget
        distribution={makeDistribution({ ready: 8, error: 2, total: 10 })}
      />,
    )
    // Background circle + 2 arcs (ready + error)
    const circles = container.querySelectorAll('circle')
    // 1 background + 2 arcs
    expect(circles.length).toBe(3)
  })

  it('renders only background circle when all instances are ready (single segment)', () => {
    const { container } = render(
      <InstanceHealthWidget distribution={makeDistribution({ ready: 5, total: 5 })} />,
    )
    // 1 background + 1 arc
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(2)
  })
})
