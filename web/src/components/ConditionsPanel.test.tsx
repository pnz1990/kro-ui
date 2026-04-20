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
import ConditionsPanel from './ConditionsPanel'
import type { K8sObject } from '@/lib/api'

function makeInstance(conditions: unknown[] = []): K8sObject {
  return { status: { conditions } }
}

describe('ConditionsPanel', () => {
  it('renders "Not reported" when no conditions', () => {
    render(<ConditionsPanel instance={makeInstance()} />)
    expect(screen.getByTestId('conditions-panel-empty').textContent).toBe('Not reported')
  })

  it('renders "Not reported" when status is absent', () => {
    render(<ConditionsPanel instance={{}} />)
    expect(screen.getByTestId('conditions-panel-empty')).toBeTruthy()
  })

  it('shows healthy count summary', () => {
    const conditions = [
      { type: 'Ready', status: 'True', reason: 'Ready' },
      { type: 'GraphResolved', status: 'True', reason: 'Resolved' },
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    expect(screen.getByTestId('conditions-summary').textContent).toContain('2 / 2')
  })

  it('counts a False condition as unhealthy', () => {
    const conditions = [
      { type: 'Ready', status: 'True' },
      { type: 'ResourcesReady', status: 'False' },
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    expect(screen.getByTestId('conditions-summary').textContent).toContain('1 / 2')
  })

  it('treats ReconciliationSuspended=False as healthy (negation polarity)', () => {
    const conditions = [
      { type: 'Ready', status: 'True' },
      { type: 'ReconciliationSuspended', status: 'False' },
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    // Both are healthy — 2/2
    expect(screen.getByTestId('conditions-summary').textContent).toContain('2 / 2')
  })

  it('renders condition type and status badge in collapsed state', () => {
    const conditions = [
      { type: 'Ready', status: 'True', reason: 'AllGood', message: 'all resources ready' },
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    expect(screen.getByText('Ready')).toBeTruthy()
    // Healthy conditions start collapsed — message NOT visible yet
    expect(screen.queryByText('all resources ready')).toBeNull()
  })

  it('renders condition row testid', () => {
    const conditions = [{ type: 'Ready', status: 'True', reason: 'OK' }]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    expect(screen.getByTestId('condition-row-Ready')).toBeTruthy()
  })

  // spec O1: healthy conditions start collapsed
  it('healthy conditions start collapsed (no detail visible)', () => {
    const conditions = [
      { type: 'Ready', status: 'True', reason: 'OK', message: 'all good', lastTransitionTime: '2026-01-01T00:00:00Z' },
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    expect(screen.queryByTestId('condition-row-Ready-detail')).toBeNull()
  })

  // spec O4: unhealthy conditions start expanded
  it('unhealthy conditions auto-expand on mount', () => {
    const conditions = [
      { type: 'ResourcesReady', status: 'False', reason: 'NotReady', message: 'waiting for node', lastTransitionTime: '2026-01-01T00:00:00Z' },
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    expect(screen.getByTestId('condition-row-ResourcesReady-detail')).toBeTruthy()
    expect(screen.getByText('waiting for node')).toBeTruthy()
  })

  // spec O2: click expands a collapsed row
  it('clicking a collapsed healthy row expands it', () => {
    const conditions = [
      { type: 'Ready', status: 'True', reason: 'OK', message: 'all resources ready' },
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    // Detail hidden initially
    expect(screen.queryByTestId('condition-row-Ready-detail')).toBeNull()
    // Click the header
    const header = screen.getByTestId('condition-row-Ready').querySelector('.condition-header--clickable')
    expect(header).toBeTruthy()
    fireEvent.click(header!)
    // Detail now visible
    expect(screen.getByTestId('condition-row-Ready-detail')).toBeTruthy()
    expect(screen.getByText('all resources ready')).toBeTruthy()
  })

  // spec O3: click collapses an expanded row
  it('clicking an expanded unhealthy row collapses it', () => {
    const conditions = [
      { type: 'ResourcesReady', status: 'False', reason: 'NotReady', message: 'waiting', lastTransitionTime: '2026-01-01T00:00:00Z' },
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    // Auto-expanded
    expect(screen.getByTestId('condition-row-ResourcesReady-detail')).toBeTruthy()
    // Click to collapse
    const header = screen.getByTestId('condition-row-ResourcesReady').querySelector('.condition-header--clickable')
    fireEvent.click(header!)
    expect(screen.queryByTestId('condition-row-ResourcesReady-detail')).toBeNull()
  })

  // spec O5: keyboard activation
  it('Enter key expands a collapsed row', () => {
    const conditions = [
      { type: 'Ready', status: 'True', message: 'ok' },
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    const header = screen.getByTestId('condition-row-Ready').querySelector('.condition-header--clickable')!
    fireEvent.keyDown(header, { key: 'Enter' })
    expect(screen.getByTestId('condition-row-Ready-detail')).toBeTruthy()
  })

  it('Space key expands a collapsed row', () => {
    const conditions = [
      { type: 'Ready', status: 'True', message: 'ok' },
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    const header = screen.getByTestId('condition-row-Ready').querySelector('.condition-header--clickable')!
    fireEvent.keyDown(header, { key: ' ' })
    expect(screen.getByTestId('condition-row-Ready-detail')).toBeTruthy()
  })

  // spec O6: absent fields not rendered
  it('absent message not rendered in detail', () => {
    const conditions = [
      { type: 'Ready', status: 'True', reason: 'OK' }, // no message, no lastTransitionTime
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    const header = screen.getByTestId('condition-row-Ready').querySelector('.condition-header--clickable')!
    fireEvent.click(header!)
    // reason IS present
    expect(screen.getByText('OK')).toBeTruthy()
    // No lastTransitionTime row
    expect(screen.queryByText(/Last transition/)).toBeNull()
  })

  // No clickable header when condition has no detail
  it('condition with no detail has no clickable header', () => {
    const conditions = [
      { type: 'Ready', status: 'True' }, // no reason, message, or lastTransitionTime
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    const header = screen.getByTestId('condition-row-Ready').querySelector('.condition-header--clickable')
    expect(header).toBeNull()
  })
})
