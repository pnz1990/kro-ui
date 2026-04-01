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
import { MemoryRouter } from 'react-router-dom'
import FleetMatrix from './FleetMatrix'
import type { ClusterSummary } from '@/lib/api'

function makeCluster(context: string): ClusterSummary {
  return {
    context,
    cluster: context,
    health: 'healthy',
    rgdCount: 1,
    instanceCount: 2,
    degradedInstances: 0,
    kroVersion: 'v0.8.5',
    rgdKinds: [],
  }
}

describe('FleetMatrix', () => {
  it('renders empty state when no RGDs exist', () => {
    render(
      <MemoryRouter>
        <FleetMatrix clusters={[makeCluster('ctx-a')]} rgdsByContext={{}} />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('fleet-matrix-empty')).toBeTruthy()
  })

  it('renders table with kind rows when RGDs exist', () => {
    const clusters = [makeCluster('ctx-a')]
    const rgdsByContext = {
      'ctx-a': [{ kind: 'WebApp', health: 'healthy' as const }],
    }
    render(
      <MemoryRouter>
        <FleetMatrix clusters={clusters} rgdsByContext={rgdsByContext} />
      </MemoryRouter>,
    )
    expect(screen.getByText('WebApp')).toBeTruthy()
  })

  it('renders "present" cell for a healthy RGD in a cluster', () => {
    const clusters = [makeCluster('ctx-a')]
    const rgdsByContext = {
      'ctx-a': [{ kind: 'WebApp', health: 'healthy' as const }],
    }
    const { container } = render(
      <MemoryRouter>
        <FleetMatrix clusters={clusters} rgdsByContext={rgdsByContext} />
      </MemoryRouter>,
    )
    expect(container.querySelector('.fleet-matrix__cell--present')).not.toBeNull()
  })

  it('renders "degraded" cell for a degraded RGD', () => {
    const clusters = [makeCluster('ctx-a')]
    const rgdsByContext = {
      'ctx-a': [{ kind: 'WebApp', health: 'degraded' as const }],
    }
    const { container } = render(
      <MemoryRouter>
        <FleetMatrix clusters={clusters} rgdsByContext={rgdsByContext} />
      </MemoryRouter>,
    )
    expect(container.querySelector('.fleet-matrix__cell--degraded')).not.toBeNull()
  })

  it('renders "absent" cell when RGD does not exist in a cluster', () => {
    const clusters = [makeCluster('ctx-a'), makeCluster('ctx-b')]
    const rgdsByContext = {
      'ctx-a': [{ kind: 'WebApp', health: 'healthy' as const }],
      'ctx-b': [], // ctx-b has no WebApp
    }
    const { container } = render(
      <MemoryRouter>
        <FleetMatrix clusters={clusters} rgdsByContext={rgdsByContext} />
      </MemoryRouter>,
    )
    expect(container.querySelector('.fleet-matrix__cell--absent')).not.toBeNull()
  })

  it('renders legend entries', () => {
    const clusters = [makeCluster('ctx-a')]
    const rgdsByContext = {
      'ctx-a': [{ kind: 'WebApp', health: 'healthy' as const }],
    }
    render(
      <MemoryRouter>
        <FleetMatrix clusters={clusters} rgdsByContext={rgdsByContext} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Present')).toBeTruthy()
    expect(screen.getByText('Degraded')).toBeTruthy()
    expect(screen.getByText('Absent')).toBeTruthy()
  })

  it('lists all kinds alphabetically as rows', () => {
    const clusters = [makeCluster('ctx-a')]
    const rgdsByContext = {
      'ctx-a': [
        { kind: 'ZApp', health: 'healthy' as const },
        { kind: 'AApp', health: 'healthy' as const },
      ],
    }
    render(
      <MemoryRouter>
        <FleetMatrix clusters={clusters} rgdsByContext={rgdsByContext} />
      </MemoryRouter>,
    )
    const rows = document.querySelectorAll('tbody tr')
    expect(rows[0].textContent).toContain('AApp')
    expect(rows[1].textContent).toContain('ZApp')
  })
})
