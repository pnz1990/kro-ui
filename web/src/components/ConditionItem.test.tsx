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

// ConditionItem.test.tsx — unit tests for negation-polarity condition rendering.
//
// Spec: .specify/specs/028-instance-health-rollup/ US5 AC-NP-001, AC-NP-002
// Issue: https://github.com/pnz1990/kro-ui/issues/171

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ConditionItem from './ConditionItem'
import type { RGDCondition } from './ConditionItem'

function makeCondition(overrides: Partial<RGDCondition> = {}): RGDCondition {
  return {
    type: 'Ready',
    status: 'True',
    ...overrides,
  }
}

describe('ConditionItem — normal polarity conditions', () => {
  it('renders condition-item--true class when status=True', () => {
    const condition = makeCondition({ type: 'Ready', status: 'True' })
    const { container } = render(<ConditionItem condition={condition} label="Ready" />)
    const item = container.querySelector('[data-testid="condition-item-Ready"]')
    expect(item).toHaveClass('condition-item--true')
    expect(item).not.toHaveClass('condition-item--false')
  })

  it('renders condition-item--false class when status=False', () => {
    const condition = makeCondition({ type: 'Ready', status: 'False' })
    const { container } = render(<ConditionItem condition={condition} label="Ready" />)
    const item = container.querySelector('[data-testid="condition-item-Ready"]')
    expect(item).toHaveClass('condition-item--false')
    expect(item).not.toHaveClass('condition-item--true')
  })

  it('shows "Passed" label when status=True', () => {
    const condition = makeCondition({ type: 'Ready', status: 'True' })
    render(<ConditionItem condition={condition} label="Ready" />)
    expect(screen.getByText('Passed')).toBeInTheDocument()
  })

  it('shows "Failed" label when status=False', () => {
    const condition = makeCondition({ type: 'Ready', status: 'False' })
    render(<ConditionItem condition={condition} label="Ready" />)
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('shows "Pending" label when status=Unknown', () => {
    const condition = makeCondition({ type: 'Ready', status: 'Unknown' })
    render(<ConditionItem condition={condition} label="Ready" />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('does not carry a negation-polarity title for normal conditions with status=False', () => {
    const condition = makeCondition({ type: 'Ready', status: 'False' })
    render(<ConditionItem condition={condition} label="Ready" />)
    const statusLabel = screen.getByText('Failed')
    expect(statusLabel).not.toHaveAttribute('title')
  })
})

describe('ConditionItem — negation-polarity: ReconciliationSuspended', () => {
  it('renders condition-item--true when ReconciliationSuspended=False (healthy)', () => {
    const condition = makeCondition({ type: 'ReconciliationSuspended', status: 'False' })
    const { container } = render(
      <ConditionItem condition={condition} label="Reconciliation Suspended" />,
    )
    const item = container.querySelector('[data-testid="condition-item-ReconciliationSuspended"]')
    expect(item).toHaveClass('condition-item--true')
    expect(item).not.toHaveClass('condition-item--false')
  })

  it('renders "Passed" label when ReconciliationSuspended=False', () => {
    const condition = makeCondition({ type: 'ReconciliationSuspended', status: 'False' })
    render(<ConditionItem condition={condition} label="Reconciliation Suspended" />)
    expect(screen.getByText('Passed')).toBeInTheDocument()
  })

  it('renders negation-polarity title tooltip on status span when ReconciliationSuspended=False', () => {
    const condition = makeCondition({ type: 'ReconciliationSuspended', status: 'False' })
    render(<ConditionItem condition={condition} label="Reconciliation Suspended" />)
    const statusLabel = screen.getByText('Passed')
    expect(statusLabel).toHaveAttribute(
      'title',
      'False is the healthy value for this condition — reconciliation is running normally',
    )
  })

  it('renders condition-item--false when ReconciliationSuspended=True (unhealthy — suspended)', () => {
    const condition = makeCondition({ type: 'ReconciliationSuspended', status: 'True' })
    const { container } = render(
      <ConditionItem condition={condition} label="Reconciliation Suspended" />,
    )
    const item = container.querySelector('[data-testid="condition-item-ReconciliationSuspended"]')
    expect(item).toHaveClass('condition-item--false')
    expect(item).not.toHaveClass('condition-item--true')
  })

  it('renders "Failed" label when ReconciliationSuspended=True', () => {
    const condition = makeCondition({ type: 'ReconciliationSuspended', status: 'True' })
    render(<ConditionItem condition={condition} label="Reconciliation Suspended" />)
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('does NOT carry a negation-polarity title when ReconciliationSuspended=True', () => {
    const condition = makeCondition({ type: 'ReconciliationSuspended', status: 'True' })
    render(<ConditionItem condition={condition} label="Reconciliation Suspended" />)
    const statusLabel = screen.getByText('Failed')
    expect(statusLabel).not.toHaveAttribute('title')
  })

  it('does NOT carry a negation-polarity title when ReconciliationSuspended=Unknown', () => {
    const condition = makeCondition({ type: 'ReconciliationSuspended', status: 'Unknown' })
    render(<ConditionItem condition={condition} label="Reconciliation Suspended" />)
    const statusLabel = screen.getByText('Pending')
    expect(statusLabel).not.toHaveAttribute('title')
  })

  it('uses data-testid condition-item-ReconciliationSuspended on the row element', () => {
    const condition = makeCondition({ type: 'ReconciliationSuspended', status: 'False' })
    const { container } = render(
      <ConditionItem condition={condition} label="Reconciliation Suspended" />,
    )
    expect(
      container.querySelector('[data-testid="condition-item-ReconciliationSuspended"]'),
    ).toBeInTheDocument()
  })
})
