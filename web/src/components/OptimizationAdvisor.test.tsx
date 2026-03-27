import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OptimizationAdvisor from './OptimizationAdvisor'
import type { CollapseGroup } from '@/lib/dag'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeGroup(kind: string, nodeIds: string[], apiVersion = 'apps/v1'): CollapseGroup {
  return { apiVersion, kind, nodeIds }
}

// ── T010: US1 — basic rendering and dismiss ───────────────────────────────

describe('OptimizationAdvisor — US1 (single group, dismiss)', () => {
  it('renders nothing when groups array is empty', () => {
    const { container } = render(<OptimizationAdvisor groups={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders one suggestion item per group', () => {
    const groups = [makeGroup('Deployment', ['d1', 'd2', 'd3'])]
    render(<OptimizationAdvisor groups={groups} />)
    expect(screen.getByTestId('advisor-item-Deployment')).toBeInTheDocument()
    expect(screen.getByTestId('optimization-advisor')).toBeInTheDocument()
  })

  it('shows the count and kind in the summary', () => {
    const groups = [makeGroup('Deployment', ['d1', 'd2', 'd3'])]
    render(<OptimizationAdvisor groups={groups} />)
    const item = screen.getByTestId('advisor-item-Deployment')
    expect(item.textContent).toContain('3')
    expect(item.textContent).toContain('Deployment')
  })

  it('removes the suggestion item on dismiss click', () => {
    const groups = [makeGroup('Deployment', ['d1', 'd2', 'd3'])]
    render(<OptimizationAdvisor groups={groups} />)
    expect(screen.getByTestId('advisor-item-Deployment')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('advisor-item-Deployment-dismiss'))
    expect(screen.queryByTestId('advisor-item-Deployment')).not.toBeInTheDocument()
  })

  it('renders nothing after all groups are dismissed', () => {
    const groups = [makeGroup('Deployment', ['d1', 'd2', 'd3'])]
    const { container } = render(<OptimizationAdvisor groups={groups} />)
    fireEvent.click(screen.getByTestId('advisor-item-Deployment-dismiss'))
    expect(container.firstChild).toBeNull()
  })
})

// ── T012: US2 — multiple groups ───────────────────────────────────────────

describe('OptimizationAdvisor — US2 (multiple groups)', () => {
  it('renders one item per candidate group', () => {
    const groups = [
      makeGroup('Deployment', ['d1', 'd2', 'd3']),
      makeGroup('ConfigMap', ['cm1', 'cm2'], 'v1'),
    ]
    render(<OptimizationAdvisor groups={groups} />)
    expect(screen.getByTestId('advisor-item-Deployment')).toBeInTheDocument()
    expect(screen.getByTestId('advisor-item-ConfigMap')).toBeInTheDocument()
  })

  it('each group has its own dismiss button with the correct data-testid', () => {
    const groups = [
      makeGroup('Deployment', ['d1', 'd2', 'd3']),
      makeGroup('ConfigMap', ['cm1', 'cm2'], 'v1'),
    ]
    render(<OptimizationAdvisor groups={groups} />)
    expect(screen.getByTestId('advisor-item-Deployment-dismiss')).toBeInTheDocument()
    expect(screen.getByTestId('advisor-item-ConfigMap-dismiss')).toBeInTheDocument()
  })

  it('dismissing the first group leaves the second visible', () => {
    const groups = [
      makeGroup('Deployment', ['d1', 'd2', 'd3']),
      makeGroup('ConfigMap', ['cm1', 'cm2'], 'v1'),
    ]
    render(<OptimizationAdvisor groups={groups} />)
    fireEvent.click(screen.getByTestId('advisor-item-Deployment-dismiss'))
    expect(screen.queryByTestId('advisor-item-Deployment')).not.toBeInTheDocument()
    expect(screen.getByTestId('advisor-item-ConfigMap')).toBeInTheDocument()
  })

  it('dismissing the second group leaves the first visible', () => {
    const groups = [
      makeGroup('Deployment', ['d1', 'd2', 'd3']),
      makeGroup('ConfigMap', ['cm1', 'cm2'], 'v1'),
    ]
    render(<OptimizationAdvisor groups={groups} />)
    fireEvent.click(screen.getByTestId('advisor-item-ConfigMap-dismiss'))
    expect(screen.getByTestId('advisor-item-Deployment')).toBeInTheDocument()
    expect(screen.queryByTestId('advisor-item-ConfigMap')).not.toBeInTheDocument()
  })
})

// ── T016: US3 — expand/explanation ───────────────────────────────────────

describe('OptimizationAdvisor — US3 (expand, explanation, docs link)', () => {
  it('explanation panel is not visible before expansion', () => {
    const groups = [makeGroup('Deployment', ['d1', 'd2', 'd3'])]
    render(<OptimizationAdvisor groups={groups} />)
    expect(screen.queryByTestId('advisor-item-Deployment-explanation')).not.toBeInTheDocument()
  })

  it('expand toggle shows the explanation section', () => {
    const groups = [makeGroup('Deployment', ['d1', 'd2', 'd3'])]
    render(<OptimizationAdvisor groups={groups} />)
    fireEvent.click(screen.getByTestId('advisor-item-Deployment-expand'))
    expect(screen.getByTestId('advisor-item-Deployment-explanation')).toBeInTheDocument()
  })

  it('explanation contains the docs link with correct href', () => {
    const groups = [makeGroup('Deployment', ['d1', 'd2', 'd3'])]
    render(<OptimizationAdvisor groups={groups} />)
    fireEvent.click(screen.getByTestId('advisor-item-Deployment-expand'))
    const link = screen.getByTestId('advisor-item-Deployment-docs-link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'https://kro.run/docs/concepts/collections')
  })

  it('docs link has target=_blank', () => {
    const groups = [makeGroup('Deployment', ['d1', 'd2', 'd3'])]
    render(<OptimizationAdvisor groups={groups} />)
    fireEvent.click(screen.getByTestId('advisor-item-Deployment-expand'))
    const link = screen.getByTestId('advisor-item-Deployment-docs-link')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('docs link has rel=noopener noreferrer', () => {
    const groups = [makeGroup('Deployment', ['d1', 'd2', 'd3'])]
    render(<OptimizationAdvisor groups={groups} />)
    fireEvent.click(screen.getByTestId('advisor-item-Deployment-expand'))
    const link = screen.getByTestId('advisor-item-Deployment-docs-link')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('explanation contains no input or form elements', () => {
    const groups = [makeGroup('Deployment', ['d1', 'd2', 'd3'])]
    render(<OptimizationAdvisor groups={groups} />)
    fireEvent.click(screen.getByTestId('advisor-item-Deployment-expand'))
    const explanation = screen.getByTestId('advisor-item-Deployment-explanation')
    expect(explanation.querySelectorAll('input')).toHaveLength(0)
    expect(explanation.querySelectorAll('form')).toHaveLength(0)
    expect(explanation.querySelectorAll('textarea')).toHaveLength(0)
  })

  it('expand toggle collapses when clicked again', () => {
    const groups = [makeGroup('Deployment', ['d1', 'd2', 'd3'])]
    render(<OptimizationAdvisor groups={groups} />)
    fireEvent.click(screen.getByTestId('advisor-item-Deployment-expand'))
    expect(screen.getByTestId('advisor-item-Deployment-explanation')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('advisor-item-Deployment-expand'))
    expect(screen.queryByTestId('advisor-item-Deployment-explanation')).not.toBeInTheDocument()
  })
})
