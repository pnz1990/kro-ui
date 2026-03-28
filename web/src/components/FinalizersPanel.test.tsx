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

// FinalizersPanel.test.tsx — unit tests for the FinalizersPanel component.
// GH #305: FinalizersPanel had no unit tests.

import { render, screen, fireEvent } from '@testing-library/react'
import FinalizersPanel from './FinalizersPanel'

describe('FinalizersPanel', () => {
  it('renders nothing when finalizers array is empty (AC-004)', () => {
    const { container } = render(<FinalizersPanel finalizers={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders when finalizers are present', () => {
    render(<FinalizersPanel finalizers={['kro.run/delete-protection']} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows collapsed label "Finalizers (N)" when not expanded', () => {
    render(<FinalizersPanel finalizers={['kro.run/delete-protection', 'foreground']} />)
    expect(screen.getByRole('button')).toHaveTextContent('Finalizers (2)')
  })

  it('expands on click to show all finalizer names', () => {
    render(<FinalizersPanel finalizers={['kro.run/delete-protection']} />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    // After expansion the finalizer name should be visible
    expect(screen.getByText('kro.run/delete-protection')).toBeInTheDocument()
  })

  it('shows "Finalizers" (no count) when expanded', () => {
    render(<FinalizersPanel finalizers={['kro.run/delete-protection']} defaultExpanded={true} />)
    expect(screen.getByRole('button')).toHaveTextContent('Finalizers')
    expect(screen.getByRole('button')).not.toHaveTextContent('(1)')
  })

  it('collapses on second click', () => {
    render(<FinalizersPanel finalizers={['kro.run/delete-protection']} />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn) // expand
    fireEvent.click(btn) // collapse
    expect(btn).toHaveTextContent('Finalizers (1)')
  })

  it('aria-expanded is false when collapsed', () => {
    render(<FinalizersPanel finalizers={['f']} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it('aria-expanded is true when expanded', () => {
    render(<FinalizersPanel finalizers={['f']} defaultExpanded={true} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
  })

  it('defaultExpanded=true opens the panel immediately', () => {
    render(<FinalizersPanel finalizers={['kro.run/finalizer']} defaultExpanded={true} />)
    expect(screen.getByText('kro.run/finalizer')).toBeInTheDocument()
  })

  it('renders multiple finalizers', () => {
    render(
      <FinalizersPanel
        finalizers={['kro.run/delete-protection', 'foreground', 'custom.io/finalizer']}
        defaultExpanded={true}
      />,
    )
    expect(screen.getByText('kro.run/delete-protection')).toBeInTheDocument()
    expect(screen.getByText('foreground')).toBeInTheDocument()
    expect(screen.getByText('custom.io/finalizer')).toBeInTheDocument()
  })
})
