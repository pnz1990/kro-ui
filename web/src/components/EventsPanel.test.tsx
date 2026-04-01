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
import EventsPanel from './EventsPanel'
import type { K8sList } from '@/lib/api'

function makeEventList(items: unknown[] = []): K8sList {
  return { items } as K8sList
}

describe('EventsPanel', () => {
  it('renders empty state with kubectl command when no events', () => {
    render(<EventsPanel events={null} namespace="kro-ui-demo" />)
    expect(screen.getByTestId('events-panel-empty')).toBeTruthy()
    expect(screen.getByText(/kubectl get events -n kro-ui-demo/)).toBeTruthy()
  })

  it('renders empty state without namespace suffix when namespace is absent', () => {
    render(<EventsPanel events={null} />)
    const text = screen.getByTestId('events-panel-empty').textContent ?? ''
    expect(text).toContain('kubectl get events')
    expect(text).not.toContain('-n ')
  })

  it('renders empty state for empty items list', () => {
    render(<EventsPanel events={makeEventList([])} namespace="kro-ui-demo" />)
    expect(screen.getByTestId('events-panel-empty')).toBeTruthy()
  })

  it('renders event rows when events exist', () => {
    const items = [
      {
        metadata: { name: 'ev1' },
        type: 'Normal',
        reason: 'Created',
        message: 'Pod created',
        lastTimestamp: '2026-01-01T00:00:00Z',
      },
      {
        metadata: { name: 'ev2' },
        type: 'Warning',
        reason: 'BackOff',
        message: 'Back-off restarting',
        lastTimestamp: '2026-01-01T01:00:00Z',
      },
    ]
    render(<EventsPanel events={makeEventList(items)} />)
    expect(screen.getByText('Created')).toBeTruthy()
    expect(screen.getByText('BackOff')).toBeTruthy()
  })

  it('renders "Events" heading', () => {
    render(<EventsPanel events={null} />)
    expect(screen.getByText('Events')).toBeTruthy()
  })
})
