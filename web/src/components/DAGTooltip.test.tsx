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

// DAGTooltip.test.tsx — unit tests for DAGTooltip component.
// GH #304: DAGTooltip had no unit tests.
// Focus: state label rendering, portal target, null guard.
// Note: viewport clamping (getBoundingClientRect + useEffect) cannot be fully
// tested in jsdom — those code paths are covered by E2E journeys.

import { render } from '@testing-library/react'
import DAGTooltip from './DAGTooltip'
import type { DAGNode } from '@/lib/dag'

function makeNode(overrides: Partial<DAGNode> = {}): DAGNode {
  return {
    id: 'appConfig',
    label: 'appConfig',
    nodeType: 'resource',
    kind: 'ConfigMap',
    isConditional: false,
    hasReadyWhen: false,
    celExpressions: [],
    includeWhen: [],
    readyWhen: [],
    isChainable: false,
    x: 0,
    y: 0,
    width: 180,
    height: 48,
    ...overrides,
  }
}

describe('DAGTooltip', () => {
  it('renders nothing when node is null', () => {
    render(
      <DAGTooltip node={null} anchorX={0} anchorY={0} nodeWidth={0} nodeHeight={0} />,
    )
    // Portal renders into document.body — body text stays empty when node=null
    expect(document.body.textContent?.trim() || '').toBe('')
  })

  it('renders tooltip content when node is provided', () => {
    const node = makeNode()
    render(
      <DAGTooltip node={node} anchorX={100} anchorY={100} nodeWidth={180} nodeHeight={48} />,
    )
    // Portal renders into document.body, not the test container
    expect(document.body.textContent).toContain('appConfig')
  })

  it('shows node kind in tooltip', () => {
    const node = makeNode({ kind: 'Deployment' })
    render(<DAGTooltip node={node} anchorX={0} anchorY={0} nodeWidth={180} nodeHeight={48} />)
    expect(document.body.textContent).toContain('Deployment')
  })

  it('does not show ? as kind label', () => {
    // Constitution §XII: kind must never render as ?
    const node = makeNode({ kind: '' })
    render(<DAGTooltip node={node} anchorX={0} anchorY={0} nodeWidth={180} nodeHeight={48} />)
    // The kind label area should not contain '?'
    expect(document.body.textContent).not.toMatch(/^\?$/)
  })

  it('shows live state label when nodeState is provided', () => {
    const node = makeNode()
    render(
      <DAGTooltip
        node={node}
        anchorX={0}
        anchorY={0}
        nodeWidth={180}
        nodeHeight={48}
        nodeState="reconciling"
      />,
    )
    expect(document.body.textContent).toContain('Reconciling')
  })

  it('shows Excluded state label for pending nodes', () => {
    const node = makeNode()
    render(
      <DAGTooltip
        node={node}
        anchorX={0}
        anchorY={0}
        nodeWidth={180}
        nodeHeight={48}
        nodeState="pending"
      />,
    )
    // PR #279: "Pending" was renamed "Excluded" in the live DAG legend
    expect(document.body.textContent).toContain('Excluded')
  })

  it('shows alive state label', () => {
    const node = makeNode()
    render(
      <DAGTooltip
        node={node}
        anchorX={0}
        anchorY={0}
        nodeWidth={180}
        nodeHeight={48}
        nodeState="alive"
      />,
    )
    expect(document.body.textContent).toContain('Alive')
  })

  it('shows error state label', () => {
    const node = makeNode()
    render(
      <DAGTooltip
        node={node}
        anchorX={0}
        anchorY={0}
        nodeWidth={180}
        nodeHeight={48}
        nodeState="error"
      />,
    )
    expect(document.body.textContent).toContain('Error')
  })

  it('renders nothing for node=null even with nodeState provided', () => {
    render(
      <DAGTooltip
        node={null}
        anchorX={0}
        anchorY={0}
        nodeWidth={0}
        nodeHeight={0}
        nodeState="alive"
      />,
    )
    expect(document.body.textContent?.trim() || '').toBe('')
  })
})
