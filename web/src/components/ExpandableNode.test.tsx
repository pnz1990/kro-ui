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

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExpandableNode from './ExpandableNode'
import type { DAGNode } from '@/lib/dag'

function makeNode(overrides: Partial<DAGNode> = {}): DAGNode {
  return {
    id: 'myService',
    label: 'myService',
    kind: 'Deployment',
    nodeType: 'resource',
    x: 10,
    y: 10,
    width: 120,
    height: 40,
    isConditional: false,
    hasReadyWhen: false,
    isChainable: false,
    celExpressions: [],
    includeWhen: [],
    readyWhen: [],
    ...overrides,
  }
}

describe('ExpandableNode', () => {
  it('renders the node with data-testid', () => {
    render(
      <svg>
        <ExpandableNode
          node={makeNode()}
          state={undefined}
          isSelected={false}
          onToggle={vi.fn()}
          isExpanded={false}
          depth={0}
        />
      </svg>,
    )
    expect(screen.getByTestId('dag-node-myService')).toBeTruthy()
  })

  it('renders node label text', () => {
    render(
      <svg>
        <ExpandableNode
          node={makeNode({ label: 'appConfig', kind: 'ConfigMap' })}
          state={undefined}
          isSelected={false}
          onToggle={vi.fn()}
          isExpanded={false}
          depth={0}
        />
      </svg>,
    )
    expect(screen.getByText('appConfig')).toBeTruthy()
  })

  it('shows expand toggle (▸) when collapsed at depth < 4', () => {
    render(
      <svg>
        <ExpandableNode
          node={makeNode()}
          state={undefined}
          isSelected={false}
          onToggle={vi.fn()}
          isExpanded={false}
          depth={0}
        />
      </svg>,
    )
    expect(screen.getByTestId('deep-dag-toggle-myService')).toBeTruthy()
    expect(screen.getByText('▸')).toBeTruthy()
  })

  it('shows collapse toggle (▾) when expanded', () => {
    render(
      <svg>
        <ExpandableNode
          node={makeNode()}
          state={undefined}
          isSelected={false}
          onToggle={vi.fn()}
          isExpanded={true}
          depth={0}
        />
      </svg>,
    )
    // The outer foreignObject header also has ▾, so check for the toggle-specific one
    const toggleEl = screen.getByTestId('deep-dag-toggle-myService')
    expect(toggleEl.textContent).toContain('▾')
  })

  it('shows max-depth indicator at depth >= 4', () => {
    render(
      <svg>
        <ExpandableNode
          node={makeNode()}
          state={undefined}
          isSelected={false}
          onToggle={vi.fn()}
          isExpanded={false}
          depth={4}
        />
      </svg>,
    )
    expect(screen.getByTestId('deep-dag-maxdepth-myService')).toBeTruthy()
  })

  it('calls onToggle when toggle button is clicked', () => {
    const onToggle = vi.fn()
    render(
      <svg>
        <ExpandableNode
          node={makeNode()}
          state={undefined}
          isSelected={false}
          onToggle={onToggle}
          isExpanded={false}
          depth={0}
        />
      </svg>,
    )
    fireEvent.click(screen.getByTestId('deep-dag-toggle-myService'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('shows loading state when childLoading=true and expanded', () => {
    render(
      <svg>
        <ExpandableNode
          node={makeNode()}
          state={undefined}
          isSelected={false}
          onToggle={vi.fn()}
          isExpanded={true}
          depth={0}
          childLoading={true}
        />
      </svg>,
    )
    expect(screen.getByTestId('deep-dag-loading-myService')).toBeTruthy()
  })

  it('shows error state when childError is set and expanded', () => {
    render(
      <svg>
        <ExpandableNode
          node={makeNode()}
          state={undefined}
          isSelected={false}
          onToggle={vi.fn()}
          isExpanded={true}
          depth={0}
          childError="404 not found"
        />
      </svg>,
    )
    expect(screen.getByTestId('deep-dag-error-myService')).toBeTruthy()
  })
})
