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

  it('renders condition type and reason', () => {
    const conditions = [
      { type: 'Ready', status: 'True', reason: 'AllGood', message: 'all resources ready' },
    ]
    render(<ConditionsPanel instance={makeInstance(conditions)} />)
    expect(screen.getByText('Ready')).toBeTruthy()
    expect(screen.getByText('AllGood')).toBeTruthy()
    expect(screen.getByText('all resources ready')).toBeTruthy()
  })
})
