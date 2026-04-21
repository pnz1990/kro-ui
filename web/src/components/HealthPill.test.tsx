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
import HealthPill from './HealthPill'
import { HEALTH_STATE_ICON } from '@/lib/format'
import type { InstanceHealth } from '@/lib/format'

function makeHealth(state: string, reason = '', message = ''): InstanceHealth {
  return { state: state as InstanceHealth['state'], reason, message }
}

describe('HealthPill', () => {
  it('renders loading skeleton when health is null', () => {
    const { container } = render(<HealthPill health={null} />)
    expect(container.querySelector('.health-pill--loading')).not.toBeNull()
  })

  it('renders "Ready" label for ready state', () => {
    render(<HealthPill health={makeHealth('ready')} />)
    const pill = screen.getByTestId('health-pill')
    expect(pill.textContent).toContain('Ready')
  })

  it('renders "Degraded" label for degraded state', () => {
    render(<HealthPill health={makeHealth('degraded')} />)
    expect(screen.getByTestId('health-pill').textContent).toContain('Degraded')
  })

  it('renders "Reconciling" for reconciling state', () => {
    render(<HealthPill health={makeHealth('reconciling')} />)
    expect(screen.getByTestId('health-pill').textContent).toContain('Reconciling')
  })

  it('renders "Error" for error state', () => {
    render(<HealthPill health={makeHealth('error')} />)
    expect(screen.getByTestId('health-pill').textContent).toContain('Error')
  })

  it('renders "Pending" for pending state', () => {
    render(<HealthPill health={makeHealth('pending')} />)
    expect(screen.getByTestId('health-pill').textContent).toContain('Pending')
  })

  it('renders "Unknown" for unknown state', () => {
    render(<HealthPill health={makeHealth('unknown')} />)
    expect(screen.getByTestId('health-pill').textContent).toContain('Unknown')
  })

  it('applies the correct CSS class per state', () => {
    const { container } = render(<HealthPill health={makeHealth('error')} />)
    expect(container.querySelector('.health-pill--error')).not.toBeNull()
  })

  it('sets aria-label to "Health: <label>"', () => {
    render(<HealthPill health={makeHealth('ready')} />)
    expect(screen.getByRole('img', { name: 'Health: Ready' })).toBeTruthy()
  })

  it('uses reason in the title when provided', () => {
    render(<HealthPill health={makeHealth('error', 'BadCondition', 'something failed')} />)
    const pill = screen.getByTestId('health-pill')
    expect((pill as HTMLElement).title).toContain('BadCondition')
  })

  it('renders state icon as secondary signal for each health state (WCAG 2.1 SC 1.4.1)', () => {
    const states: Array<InstanceHealth['state']> = ['ready', 'error', 'degraded', 'reconciling', 'pending', 'unknown']
    for (const state of states) {
      const { container, unmount } = render(<HealthPill health={makeHealth(state)} />)
      const iconEl = container.querySelector('.health-pill__icon')
      expect(iconEl, `icon missing for state=${state}`).not.toBeNull()
      expect(iconEl!.textContent, `wrong icon for state=${state}`).toBe(HEALTH_STATE_ICON[state])
      unmount()
    }
  })

  it('icon has aria-hidden="true" to avoid screen reader double-reading', () => {
    const { container } = render(<HealthPill health={makeHealth('error')} />)
    const iconEl = container.querySelector('.health-pill__icon')
    expect(iconEl).not.toBeNull()
    expect(iconEl!.getAttribute('aria-hidden')).toBe('true')
  })
})

