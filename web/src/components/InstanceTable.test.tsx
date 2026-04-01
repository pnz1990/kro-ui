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
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InstanceTable from './InstanceTable'
import type { K8sObject } from '@/lib/api'

function makeInstance(name: string, namespace = 'default', readyStatus = 'True'): K8sObject {
  return {
    metadata: {
      name,
      namespace,
      creationTimestamp: '2026-01-01T00:00:00Z',
    },
    status: {
      conditions: [
        { type: 'Ready', status: readyStatus, reason: 'Ready' },
      ],
    },
  }
}

describe('InstanceTable', () => {
  it('renders instance-table element', () => {
    render(
      <MemoryRouter>
        <InstanceTable items={[makeInstance('inst-a')]} rgdName="test-app" />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('instance-table')).toBeTruthy()
  })

  it('renders a row for each instance', () => {
    render(
      <MemoryRouter>
        <InstanceTable
          items={[makeInstance('inst-a'), makeInstance('inst-b')]}
          rgdName="test-app"
        />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('instance-row-inst-a')).toBeTruthy()
    expect(screen.getByTestId('instance-row-inst-b')).toBeTruthy()
  })

  it('renders name filter input', () => {
    render(
      <MemoryRouter>
        <InstanceTable items={[makeInstance('inst-a')]} rgdName="test-app" />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('instance-name-filter')).toBeTruthy()
  })

  it('filters rows by name input', () => {
    render(
      <MemoryRouter>
        <InstanceTable
          items={[makeInstance('alpha'), makeInstance('beta')]}
          rgdName="test-app"
        />
      </MemoryRouter>,
    )
    const filter = screen.getByTestId('instance-name-filter')
    fireEvent.change(filter, { target: { value: 'alp' } })
    expect(screen.getByTestId('instance-row-alpha')).toBeTruthy()
    expect(screen.queryByTestId('instance-row-beta')).toBeNull()
  })

  it('shows empty state when name filter matches nothing', () => {
    render(
      <MemoryRouter>
        <InstanceTable items={[makeInstance('alpha')]} rgdName="test-app" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByTestId('instance-name-filter'), { target: { value: 'zzz' } })
    expect(screen.getByText(/no instances match/i)).toBeTruthy()
  })

  it('shows compare bar when 2 items exist and one is selected', () => {
    render(
      <MemoryRouter>
        <InstanceTable
          items={[makeInstance('a'), makeInstance('b')]}
          rgdName="test-app"
        />
      </MemoryRouter>,
    )
    const checkbox = screen.getByTestId('select-a')
    fireEvent.click(checkbox)
    expect(screen.getByTestId('compare-bar')).toBeTruthy()
  })

  it('opens spec diff panel when 2 instances selected and Compare clicked', () => {
    render(
      <MemoryRouter>
        <InstanceTable
          items={[makeInstance('a'), makeInstance('b')]}
          rgdName="test-app"
        />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByTestId('select-a'))
    fireEvent.click(screen.getByTestId('select-b'))
    fireEvent.click(screen.getByTestId('compare-btn'))
    expect(screen.getByTestId('spec-diff-panel')).toBeTruthy()
  })
})
