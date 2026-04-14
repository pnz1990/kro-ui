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

/**
 * RGDDiffView unit tests
 *
 * Tests cover:
 * - Error state when snapshot is missing/malformed
 * - Normal render: legend, SVG, node groups
 * - Diff status badges on nodes (+, −, ~)
 * - Selected state toggle on modified node click
 * - CELDiffPanel shown/hidden on modified node click
 * - CELDiffPanel close button
 * - Unchanged nodes have no diff badge
 * - Removed nodes have dashed border class
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RGDDiffView from './RGDDiffView'
import type { K8sObject } from '@/lib/api'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSnapshot(resources: unknown[]) {
  return {
    schema: { kind: 'TestApp', apiVersion: 'v1alpha1' },
    resources,
  }
}

function resourceNode(id: string, kind = 'ConfigMap') {
  return {
    id,
    template: { apiVersion: 'v1', kind, metadata: { name: id } },
  }
}

function conditionalNode(id: string, includeWhen: string[]) {
  return {
    id,
    template: { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: id } },
    includeWhen,
  }
}

function makeRevision(snapshot: unknown): K8sObject {
  return { spec: { snapshot } } as unknown as K8sObject
}

function makeEmptyRevision(): K8sObject {
  return {} as unknown as K8sObject
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RGDDiffView', () => {
  // ── Error state ────────────────────────────────────────────────

  it('shows error state when revA has no spec.snapshot', () => {
    const revA = makeEmptyRevision()
    const revB = makeRevision(makeSnapshot([resourceNode('svc')]))
    render(<RGDDiffView revA={revA} revB={revB} />)
    expect(screen.getByTestId('rgd-diff-view-error')).toBeInTheDocument()
    expect(screen.getByText(/Could not read revision snapshot/i)).toBeInTheDocument()
  })

  it('shows error state when revB has no spec.snapshot', () => {
    const revA = makeRevision(makeSnapshot([resourceNode('svc')]))
    const revB = makeEmptyRevision()
    render(<RGDDiffView revA={revA} revB={revB} />)
    expect(screen.getByTestId('rgd-diff-view-error')).toBeInTheDocument()
  })

  it('shows error state when spec.snapshot is not an object', () => {
    const revA = makeRevision('not-an-object')
    const revB = makeRevision(makeSnapshot([]))
    render(<RGDDiffView revA={revA} revB={revB} />)
    expect(screen.getByTestId('rgd-diff-view-error')).toBeInTheDocument()
  })

  // ── Normal render ──────────────────────────────────────────────

  it('renders the diff view container when both snapshots are valid', () => {
    const snap = makeSnapshot([resourceNode('svc')])
    render(<RGDDiffView revA={makeRevision(snap)} revB={makeRevision(snap)} />)
    expect(screen.getByTestId('rgd-diff-view')).toBeInTheDocument()
  })

  it('renders the diff legend', () => {
    const snap = makeSnapshot([resourceNode('svc')])
    render(<RGDDiffView revA={makeRevision(snap)} revB={makeRevision(snap)} />)
    expect(screen.getByTestId('dag-diff-legend')).toBeInTheDocument()
  })

  it('renders the diff SVG', () => {
    const snap = makeSnapshot([resourceNode('svc')])
    render(<RGDDiffView revA={makeRevision(snap)} revB={makeRevision(snap)} />)
    expect(screen.getByTestId('dag-diff-svg')).toBeInTheDocument()
  })

  it('SVG has accessible role and aria-label', () => {
    const snap = makeSnapshot([resourceNode('svc')])
    render(<RGDDiffView revA={makeRevision(snap)} revB={makeRevision(snap)} />)
    expect(screen.getByRole('img', { name: /resource graph revision diff/i })).toBeInTheDocument()
  })

  // ── Node diff badges ───────────────────────────────────────────

  it('renders a + badge on an added node', () => {
    const snapA = makeSnapshot([resourceNode('svc')])
    const snapB = makeSnapshot([resourceNode('svc'), resourceNode('deploy', 'Deployment')])
    render(<RGDDiffView revA={makeRevision(snapA)} revB={makeRevision(snapB)} />)

    const deployNode = screen.getByTestId('dag-diff-node-deploy')
    expect(deployNode).toHaveAttribute('data-diff-status', 'added')
  })

  it('renders a − badge on a removed node', () => {
    const snapA = makeSnapshot([resourceNode('svc'), resourceNode('deploy', 'Deployment')])
    const snapB = makeSnapshot([resourceNode('svc')])
    render(<RGDDiffView revA={makeRevision(snapA)} revB={makeRevision(snapB)} />)

    const deployNode = screen.getByTestId('dag-diff-node-deploy')
    expect(deployNode).toHaveAttribute('data-diff-status', 'removed')
  })

  it('renders unchanged nodes without a diff badge class', () => {
    const snap = makeSnapshot([resourceNode('svc')])
    render(<RGDDiffView revA={makeRevision(snap)} revB={makeRevision(snap)} />)

    const svcNode = screen.getByTestId('dag-diff-node-svc')
    expect(svcNode).toHaveAttribute('data-diff-status', 'unchanged')
  })

  it('renders a ~ badge on a modified node (CEL change)', () => {
    const snapA = makeSnapshot([conditionalNode('svc', ['x > 1'])])
    const snapB = makeSnapshot([conditionalNode('svc', ['x > 2'])])
    render(<RGDDiffView revA={makeRevision(snapA)} revB={makeRevision(snapB)} />)

    const svcNode = screen.getByTestId('dag-diff-node-svc')
    expect(svcNode).toHaveAttribute('data-diff-status', 'modified')
  })

  // ── Node accessibility ─────────────────────────────────────────

  it('nodes have role=button and aria-label including diff status', () => {
    const snapA = makeSnapshot([resourceNode('svc')])
    const snapB = makeSnapshot([resourceNode('svc'), resourceNode('deploy', 'Deployment')])
    render(<RGDDiffView revA={makeRevision(snapA)} revB={makeRevision(snapB)} />)

    const deployNode = screen.getByTestId('dag-diff-node-deploy')
    expect(deployNode).toHaveAttribute('role', 'button')
    expect(deployNode.getAttribute('aria-label')).toContain('added')
  })

  // ── Modified node click → CEL panel ───────────────────────────

  it('clicking a modified node shows the CEL diff panel', async () => {
    const user = userEvent.setup()
    const snapA = makeSnapshot([conditionalNode('svc', ['x > 1'])])
    const snapB = makeSnapshot([conditionalNode('svc', ['x > 2'])])
    render(<RGDDiffView revA={makeRevision(snapA)} revB={makeRevision(snapB)} />)

    expect(screen.queryByTestId('dag-diff-cel-panel')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('dag-diff-node-svc'))
    expect(screen.getByTestId('dag-diff-cel-panel')).toBeInTheDocument()
  })

  it('clicking the same modified node again hides the CEL panel (toggle)', async () => {
    const user = userEvent.setup()
    const snapA = makeSnapshot([conditionalNode('svc', ['x > 1'])])
    const snapB = makeSnapshot([conditionalNode('svc', ['x > 2'])])
    render(<RGDDiffView revA={makeRevision(snapA)} revB={makeRevision(snapB)} />)

    await user.click(screen.getByTestId('dag-diff-node-svc'))
    expect(screen.getByTestId('dag-diff-cel-panel')).toBeInTheDocument()

    await user.click(screen.getByTestId('dag-diff-node-svc'))
    expect(screen.queryByTestId('dag-diff-cel-panel')).not.toBeInTheDocument()
  })

  it('CEL panel close button hides the panel', async () => {
    const user = userEvent.setup()
    const snapA = makeSnapshot([conditionalNode('svc', ['x > 1'])])
    const snapB = makeSnapshot([conditionalNode('svc', ['x > 2'])])
    render(<RGDDiffView revA={makeRevision(snapA)} revB={makeRevision(snapB)} />)

    await user.click(screen.getByTestId('dag-diff-node-svc'))
    const panel = screen.getByTestId('dag-diff-cel-panel')
    await user.click(within(panel).getByRole('button', { name: /close/i }))
    expect(screen.queryByTestId('dag-diff-cel-panel')).not.toBeInTheDocument()
  })

  it('clicking an unchanged node does not show the CEL panel', async () => {
    const user = userEvent.setup()
    const snap = makeSnapshot([resourceNode('svc')])
    render(<RGDDiffView revA={makeRevision(snap)} revB={makeRevision(snap)} />)

    await user.click(screen.getByTestId('dag-diff-node-svc'))
    expect(screen.queryByTestId('dag-diff-cel-panel')).not.toBeInTheDocument()
  })

  it('clicking an added node does not show the CEL panel', async () => {
    const user = userEvent.setup()
    const snapA = makeSnapshot([resourceNode('svc')])
    const snapB = makeSnapshot([resourceNode('svc'), resourceNode('deploy', 'Deployment')])
    render(<RGDDiffView revA={makeRevision(snapA)} revB={makeRevision(snapB)} />)

    await user.click(screen.getByTestId('dag-diff-node-deploy'))
    expect(screen.queryByTestId('dag-diff-cel-panel')).not.toBeInTheDocument()
  })

  // ── Legend content ─────────────────────────────────────────────

  it('legend contains Added, Removed, Modified, and Unchanged labels', () => {
    const snap = makeSnapshot([resourceNode('svc')])
    render(<RGDDiffView revA={makeRevision(snap)} revB={makeRevision(snap)} />)
    const legend = screen.getByTestId('dag-diff-legend')
    expect(legend.textContent).toContain('Added')
    expect(legend.textContent).toContain('Removed')
    expect(legend.textContent).toContain('Modified')
    expect(legend.textContent).toContain('Unchanged')
  })

  // ── Removed node has dashed class ─────────────────────────────

  it('removed node has dag-node--removed class for dashed border', () => {
    const snapA = makeSnapshot([resourceNode('svc'), resourceNode('deploy', 'Deployment')])
    const snapB = makeSnapshot([resourceNode('svc')])
    render(<RGDDiffView revA={makeRevision(snapA)} revB={makeRevision(snapB)} />)

    const deployNode = screen.getByTestId('dag-diff-node-deploy')
    // SVG <g> className is an SVGAnimatedString — use getAttribute for string comparison
    const cls = deployNode.getAttribute('class') ?? ''
    expect(cls).toContain('dag-node--removed')
  })

  // ── Keyboard navigation on nodes ──────────────────────────────

  it('Enter key on a modified node opens the CEL panel', async () => {
    const user = userEvent.setup()
    const snapA = makeSnapshot([conditionalNode('svc', ['x > 1'])])
    const snapB = makeSnapshot([conditionalNode('svc', ['x > 2'])])
    render(<RGDDiffView revA={makeRevision(snapA)} revB={makeRevision(snapB)} />)

    const svcNode = screen.getByTestId('dag-diff-node-svc')
    svcNode.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('dag-diff-cel-panel')).toBeInTheDocument()
  })
})
