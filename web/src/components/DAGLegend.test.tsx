// DAGLegend.test.tsx — Unit tests for the DAG badge legend component.
//
// Spec: .specify/specs/034-generate-form-polish/ FR-006–FR-009
// Task: T014

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DAGLegend from './DAGLegend'

describe('DAGLegend', () => {
  it('renders the conditional badge and label', () => {
    render(<DAGLegend />)
    const badge = screen.getByText('?')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('dag-legend__badge--conditional')
    expect(screen.getByText(/conditional \(includeWhen\)/)).toBeInTheDocument()
  })

  it('renders the forEach collection badge and label', () => {
    render(<DAGLegend />)
    const badge = screen.getByText('∀')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('dag-legend__badge--collection')
    expect(screen.getByText(/forEach collection/)).toBeInTheDocument()
  })

  it('renders the external reference badge and label', () => {
    render(<DAGLegend />)
    const badge = screen.getByText('⬡')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('dag-legend__badge--external')
    expect(screen.getByText(/external reference/)).toBeInTheDocument()
  })

  it('renders all three entries in total', () => {
    const { container } = render(<DAGLegend />)
    const entries = container.querySelectorAll('.dag-legend__entry')
    expect(entries).toHaveLength(3)
  })

  it('has accessible aria-label', () => {
    render(<DAGLegend />)
    expect(screen.getByRole('generic', { name: 'DAG node badge legend' })).toBeInTheDocument()
  })
})
