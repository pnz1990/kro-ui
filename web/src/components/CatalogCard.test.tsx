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
import { MemoryRouter } from 'react-router-dom'
import CatalogCard from './CatalogCard'
import type { K8sObject } from '@/lib/api'

function makeRGD(overrides: Partial<K8sObject> = {}): K8sObject {
  return {
    metadata: {
      name: 'test-app',
      creationTimestamp: '2026-01-01T00:00:00Z',
      labels: {},
    },
    spec: {
      schema: { kind: 'TestApp' },
      resources: [{ id: 'r1' }, { id: 'r2' }],
    },
    status: {
      conditions: [
        { type: 'Ready', status: 'True', reason: 'Compiled', message: '' },
      ],
    },
    ...overrides,
  }
}

function renderCard(overrides: {
  rgd?: K8sObject
  instanceCount?: number | null
  usedBy?: string[]
  onLabelClick?: (l: string) => void
} = {}) {
  const { rgd = makeRGD(), instanceCount = 3, usedBy = [], onLabelClick = vi.fn() } = overrides
  return render(
    <MemoryRouter>
      <CatalogCard
        rgd={rgd}
        instanceCount={instanceCount}
        usedBy={usedBy}
        onLabelClick={onLabelClick}
      />
    </MemoryRouter>,
  )
}

describe('CatalogCard', () => {
  it('renders the RGD name', () => {
    renderCard()
    expect(screen.getByTestId('catalog-card-name').textContent).toBe('test-app')
  })

  it('renders the kind', () => {
    renderCard()
    expect(screen.getByTestId('catalog-card-kind').textContent).toBe('TestApp')
  })

  it('renders resource count', () => {
    renderCard()
    expect(screen.getByTestId('catalog-card-resources').textContent).toContain('2 resources')
  })

  it('renders instance count', () => {
    renderCard({ instanceCount: 5 })
    expect(screen.getByTestId('catalog-card-instances').textContent).toContain('5')
  })

  it('renders em-dash for null instance count', () => {
    renderCard({ instanceCount: null })
    expect(screen.getByTestId('catalog-card-instances').textContent).toContain('—')
  })

  it('renders skeleton when instanceCount is undefined', () => {
    // Render directly — bypass renderCard helper which has instanceCount=3 default
    const { container } = render(
      <MemoryRouter>
        <CatalogCard
          rgd={makeRGD()}
          instanceCount={undefined}
          usedBy={[]}
          onLabelClick={vi.fn()}
        />
      </MemoryRouter>,
    )
    const el = container.querySelector('[aria-label="Loading instance count"]')
    expect(el).not.toBeNull()
  })

  it('renders "Used by" list when usedBy is non-empty', () => {
    renderCard({ usedBy: ['chain-parent', 'other-rgd'] })
    expect(screen.getByTestId('catalog-card-used-by')).toBeTruthy()
    expect(screen.getByText('chain-parent')).toBeTruthy()
  })

  it('renders label pills and calls onLabelClick', () => {
    const onLabelClick = vi.fn()
    const rgd = makeRGD({
      metadata: {
        name: 'test-app',
        creationTimestamp: '2026-01-01T00:00:00Z',
        labels: { team: 'platform' },
      },
    })
    render(
      <MemoryRouter>
        <CatalogCard
          rgd={rgd}
          instanceCount={1}
          usedBy={[]}
          onLabelClick={onLabelClick}
        />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('catalog-card-labels')).toBeTruthy()
    fireEvent.click(screen.getByText('team=platform'))
    expect(onLabelClick).toHaveBeenCalledWith('team=platform')
  })

  it('renders Instances link', () => {
    renderCard()
    const btn = screen.getByTestId('btn-instances')
    expect(btn.textContent).toBe('Instances')
  })
})
