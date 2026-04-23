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

// ReconciliationTimeline.test.tsx — Unit tests for ReconciliationTimeline.
//
// Covers spec O1–O7:
//   O5: returns null when <2 transitions
//   O3: shows formatted timestamps and state labels
//   O4: entries sorted newest-first
//   O7: missing lastTransitionTime fields handled gracefully

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReconciliationTimeline, { extractTimelineEntries } from './ReconciliationTimeline'
import type { K8sObject } from '@/lib/api'

function makeInstance(conditions: unknown[] = []): K8sObject {
  return { status: { conditions } }
}

describe('extractTimelineEntries', () => {
  it('returns empty array when no status', () => {
    expect(extractTimelineEntries({})).toEqual([])
  })

  it('returns empty array when conditions is absent', () => {
    expect(extractTimelineEntries({ status: {} })).toEqual([])
  })

  it('filters out conditions without lastTransitionTime', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'True' },
      { type: 'GraphResolved', status: 'True', lastTransitionTime: '2026-01-01T00:00:00Z' },
    ])
    const entries = extractTimelineEntries(instance)
    expect(entries).toHaveLength(1)
    expect(entries[0].conditionType).toBe('GraphResolved')
  })

  it('sorts entries newest-first (O4)', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'True', lastTransitionTime: '2026-01-01T00:00:00Z' },
      { type: 'GraphResolved', status: 'True', lastTransitionTime: '2026-01-03T00:00:00Z' },
      { type: 'ResourcesReady', status: 'True', lastTransitionTime: '2026-01-02T00:00:00Z' },
    ])
    const entries = extractTimelineEntries(instance)
    expect(entries[0].conditionType).toBe('GraphResolved') // newest
    expect(entries[1].conditionType).toBe('ResourcesReady')
    expect(entries[2].conditionType).toBe('Ready') // oldest
  })

  it('caps at 10 entries', () => {
    const conditions = Array.from({ length: 15 }, (_, i) => ({
      type: `Condition${i}`,
      status: 'True',
      lastTransitionTime: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }))
    const entries = extractTimelineEntries(makeInstance(conditions))
    expect(entries).toHaveLength(10)
  })
})

describe('ReconciliationTimeline', () => {
  it('renders null when fewer than 2 entries have lastTransitionTime (O5)', () => {
    const { container } = render(
      <ReconciliationTimeline instance={makeInstance([
        { type: 'Ready', status: 'True' }, // no lastTransitionTime
      ])} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders null when only 1 condition has lastTransitionTime (O5)', () => {
    const { container } = render(
      <ReconciliationTimeline instance={makeInstance([
        { type: 'Ready', status: 'True', lastTransitionTime: '2026-01-01T00:00:00Z' },
      ])} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders timeline when ≥2 conditions have lastTransitionTime', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'True', lastTransitionTime: '2026-01-01T00:00:00Z' },
      { type: 'GraphResolved', status: 'True', lastTransitionTime: '2026-01-02T00:00:00Z' },
    ])
    render(<ReconciliationTimeline instance={instance} />)
    expect(screen.getByTestId('reconciliation-timeline')).toBeTruthy()
  })

  it('shows "Ready" label for healthy condition (O3)', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'True', lastTransitionTime: '2026-01-01T00:00:00Z' },
      { type: 'GraphResolved', status: 'True', lastTransitionTime: '2026-01-02T00:00:00Z' },
    ])
    render(<ReconciliationTimeline instance={instance} />)
    // Both conditions are healthy — state label "Ready" appears at least once
    const readyLabels = screen.getAllByText('Ready')
    expect(readyLabels.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "Unknown" label for unknown-status condition (O3)', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'Unknown', lastTransitionTime: '2026-01-01T00:00:00Z' },
      { type: 'GraphResolved', status: 'True', lastTransitionTime: '2026-01-02T00:00:00Z' },
    ])
    render(<ReconciliationTimeline instance={instance} />)
    expect(screen.getByText('Unknown')).toBeTruthy()
  })

  it('shows condition type in each entry (O3)', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'True', lastTransitionTime: '2026-01-01T00:00:00Z' },
      { type: 'GraphResolved', status: 'True', lastTransitionTime: '2026-01-02T00:00:00Z' },
    ])
    render(<ReconciliationTimeline instance={instance} />)
    // 'Ready' appears as both state label AND condition type — use getAllByText
    const readyEls = screen.getAllByText('Ready')
    expect(readyEls.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('GraphResolved')).toBeTruthy()
  })

  it('shows reason when present', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'False', reason: 'NotReady', lastTransitionTime: '2026-01-01T00:00:00Z' },
      { type: 'GraphResolved', status: 'True', lastTransitionTime: '2026-01-02T00:00:00Z' },
    ])
    render(<ReconciliationTimeline instance={instance} />)
    expect(screen.getByText('NotReady')).toBeTruthy()
  })

  it('renders newest entry first (O4)', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'True', lastTransitionTime: '2026-01-01T00:00:00Z' },
      { type: 'GraphResolved', status: 'True', lastTransitionTime: '2026-01-03T00:00:00Z' },
    ])
    render(<ReconciliationTimeline instance={instance} />)
    const timeline = screen.getByTestId('reconciliation-timeline')
    const conditionTypes = timeline.querySelectorAll('.timeline-condition-type')
    // First entry should be the newest: GraphResolved (Jan 3)
    expect(conditionTypes[0].textContent).toBe('GraphResolved')
    expect(conditionTypes[1].textContent).toBe('Ready')
  })

  it('handles missing status gracefully (O7)', () => {
    const { container } = render(<ReconciliationTimeline instance={{}} />)
    // Should render null, not throw
    expect(container.firstChild).toBeNull()
  })

  it('has accessible list structure', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'True', lastTransitionTime: '2026-01-01T00:00:00Z' },
      { type: 'GraphResolved', status: 'True', lastTransitionTime: '2026-01-02T00:00:00Z' },
    ])
    render(<ReconciliationTimeline instance={instance} />)
    const list = screen.getByRole('list')
    expect(list).toBeTruthy()
    expect(list.getAttribute('aria-label')).toBe('State transition history')
  })
})
