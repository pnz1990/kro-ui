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
import { render, screen, fireEvent } from '@testing-library/react'
import AnomalyBanner from './AnomalyBanner'
import type { Anomaly } from '@/lib/events'

function makeAnomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    type: 'stuck',
    message: 'Instance has been reconciling for >10 minutes',
    instanceName: 'test-instance',
    count: 1,
    ...overrides,
  }
}

describe('AnomalyBanner', () => {
  it('renders with role="alert" and data-testid', () => {
    render(<AnomalyBanner anomaly={makeAnomaly()} />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByTestId('anomaly-banner')).toBeTruthy()
  })

  it('renders the anomaly message', () => {
    render(<AnomalyBanner anomaly={makeAnomaly({ message: 'Something is stuck' })} />)
    expect(screen.getByText('Something is stuck')).toBeTruthy()
  })

  it('applies stuck class for stuck anomalies', () => {
    const { container } = render(<AnomalyBanner anomaly={makeAnomaly({ type: 'stuck' })} />)
    expect(container.querySelector('.anomaly-banner--stuck')).not.toBeNull()
  })

  it('applies burst class for burst anomalies', () => {
    const { container } = render(<AnomalyBanner anomaly={makeAnomaly({ type: 'burst' })} />)
    expect(container.querySelector('.anomaly-banner--burst')).not.toBeNull()
  })

  it('sets data-anomaly-type attribute', () => {
    const { container } = render(<AnomalyBanner anomaly={makeAnomaly({ type: 'burst' })} />)
    const el = container.querySelector('[data-anomaly-type="burst"]')
    expect(el).not.toBeNull()
  })

  it('dismisses the banner when the dismiss button is clicked', () => {
    render(<AnomalyBanner anomaly={makeAnomaly()} />)
    const btn = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(btn)
    expect(screen.queryByTestId('anomaly-banner')).toBeNull()
  })
})
