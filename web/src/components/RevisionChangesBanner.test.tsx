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

// RevisionChangesBanner.test.tsx — Unit tests for the Graph tab "what's new" banner.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RevisionChangesBanner from './RevisionChangesBanner'
import type { RevisionNodeDiff } from '@/lib/format'

function makeDiff(added: string[], removed: string[], prior = 1, latest = 2): RevisionNodeDiff {
  return { added, removed, priorRevisionNumber: prior, latestRevisionNumber: latest }
}

describe('RevisionChangesBanner', () => {
  it('renders when there are added nodes', () => {
    render(<RevisionChangesBanner diff={makeDiff(['configmap'], [])} onDiffRevisions={vi.fn()} />)
    expect(screen.getByTestId('revision-changes-banner')).toBeInTheDocument()
  })

  it('renders when there are removed nodes', () => {
    render(<RevisionChangesBanner diff={makeDiff([], ['old-svc'])} onDiffRevisions={vi.fn()} />)
    expect(screen.getByTestId('revision-changes-banner')).toBeInTheDocument()
  })

  it('does NOT render when graph is identical (O3)', () => {
    const { container } = render(
      <RevisionChangesBanner diff={makeDiff([], [])} onDiffRevisions={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows singular "node" for 1 added', () => {
    render(<RevisionChangesBanner diff={makeDiff(['svc'], [])} onDiffRevisions={vi.fn()} />)
    expect(screen.getByText(/1 node added/i)).toBeInTheDocument()
  })

  it('shows plural "nodes" for multiple added', () => {
    render(<RevisionChangesBanner diff={makeDiff(['svc', 'deploy'], [])} onDiffRevisions={vi.fn()} />)
    expect(screen.getByText(/2 nodes added/i)).toBeInTheDocument()
  })

  it('shows removed count in text', () => {
    render(<RevisionChangesBanner diff={makeDiff([], ['old-a', 'old-b'])} onDiffRevisions={vi.fn()} />)
    expect(screen.getByText(/2 nodes removed/i)).toBeInTheDocument()
  })

  it('shows both added and removed when both present', () => {
    render(
      <RevisionChangesBanner diff={makeDiff(['new'], ['old'])} onDiffRevisions={vi.fn()} />
    )
    expect(screen.getByText(/1 node added/i)).toBeInTheDocument()
    expect(screen.getByText(/1 node removed/i)).toBeInTheDocument()
  })

  it('shows prior revision number in text', () => {
    render(
      <RevisionChangesBanner diff={makeDiff(['svc'], [], 3, 4)} onDiffRevisions={vi.fn()} />
    )
    expect(screen.getByText(/since r3/i)).toBeInTheDocument()
  })

  it('renders "Diff revisions" button (O2)', () => {
    render(<RevisionChangesBanner diff={makeDiff(['svc'], [])} onDiffRevisions={vi.fn()} />)
    expect(screen.getByTestId('revision-changes-diff-btn')).toBeInTheDocument()
    expect(screen.getByText('Diff revisions')).toBeInTheDocument()
  })

  it('calls onDiffRevisions when button clicked (O2)', () => {
    const onDiffRevisions = vi.fn()
    render(<RevisionChangesBanner diff={makeDiff(['svc'], [])} onDiffRevisions={onDiffRevisions} />)
    fireEvent.click(screen.getByTestId('revision-changes-diff-btn'))
    expect(onDiffRevisions).toHaveBeenCalledTimes(1)
  })

  it('has role=status and aria-live=polite', () => {
    render(<RevisionChangesBanner diff={makeDiff(['svc'], [])} onDiffRevisions={vi.fn()} />)
    const banner = screen.getByTestId('revision-changes-banner')
    expect(banner).toHaveAttribute('role', 'status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
  })
})
