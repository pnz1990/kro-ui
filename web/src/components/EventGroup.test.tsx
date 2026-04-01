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
import EventGroup from './EventGroup'
import type { KubeEvent } from '@/lib/events'

function makeEvent(overrides: Partial<KubeEvent> = {}): KubeEvent {
  return {
    metadata: { uid: 'uid-1', name: 'event-1', namespace: 'default' },
    type: 'Normal',
    reason: 'Created',
    message: 'Pod created',
    lastTimestamp: '2026-01-01T00:00:00Z',
    involvedObject: { kind: 'Pod', name: 'pod-1', namespace: 'default', uid: 'pod-uid' },
    source: { component: 'kubelet' },
    ...overrides,
  }
}

describe('EventGroup', () => {
  it('renders with data-testid="event-group"', () => {
    render(
      <EventGroup
        instanceName="test-instance"
        events={[makeEvent()]}
      />,
    )
    expect(screen.getByTestId('event-group')).toBeTruthy()
  })

  it('renders instance name in header', () => {
    render(
      <EventGroup
        instanceName="my-instance"
        events={[makeEvent()]}
      />,
    )
    expect(screen.getByText('my-instance')).toBeTruthy()
  })

  it('starts expanded by default and shows event body', () => {
    render(
      <EventGroup
        instanceName="test-instance"
        events={[makeEvent()]}
      />,
    )
    expect(screen.getByTestId('event-group-body')).toBeTruthy()
  })

  it('collapses when header is clicked', () => {
    render(
      <EventGroup
        instanceName="test-instance"
        events={[makeEvent()]}
      />,
    )
    const header = screen.getByRole('button')
    fireEvent.click(header)
    expect(screen.queryByTestId('event-group-body')).toBeNull()
  })

  it('starts collapsed when initiallyExpanded=false', () => {
    render(
      <EventGroup
        instanceName="test-instance"
        events={[makeEvent()]}
        initiallyExpanded={false}
      />,
    )
    expect(screen.queryByTestId('event-group-body')).toBeNull()
  })

  it('shows warning badge when Warning events exist', () => {
    const events = [
      makeEvent({ metadata: { uid: 'u1', name: 'e1', namespace: 'default' }, type: 'Warning' }),
      makeEvent({ metadata: { uid: 'u2', name: 'e2', namespace: 'default' }, type: 'Normal' }),
    ]
    render(<EventGroup instanceName="test-instance" events={events} />)
    const badge = screen.getByRole('button').querySelector('[aria-label*="warning"]') ??
                  document.querySelector('.event-group__warning-badge')
    expect(badge).not.toBeNull()
  })

  it('shows event count in header', () => {
    const events = [makeEvent(), makeEvent({ metadata: { uid: 'u2', name: 'e2', namespace: 'default' } })]
    render(<EventGroup instanceName="test-instance" events={events} />)
    expect(screen.getByRole('button').textContent).toContain('2 events')
  })
})
