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
import ResourceSummary from './ResourceSummary'

// A minimal spec with a single managed resource (no DAG edges)
const specOneResource = {
  schema: { kind: 'TestApp' },
  resources: [{ id: 'myDeployment', template: { apiVersion: 'apps/v1', kind: 'Deployment' } }],
}

// A spec with a forEach collection
const specWithCollection = {
  schema: { kind: 'TestApp' },
  resources: [
    {
      id: 'myService',
      forEach: '${schema.spec.regions}',
      template: { apiVersion: 'v1', kind: 'Service' },
    },
  ],
}

// An empty spec
const specEmpty = {
  schema: { kind: 'EmptyApp' },
  resources: [],
}

describe('ResourceSummary', () => {
  it('renders with data-testid="resource-summary"', () => {
    render(<ResourceSummary spec={specOneResource} />)
    expect(screen.getByTestId('resource-summary')).toBeTruthy()
  })

  it('renders "1 resource" for a single managed resource', () => {
    render(<ResourceSummary spec={specOneResource} />)
    expect(screen.getByTestId('resource-summary').textContent).toContain('1 resource')
  })

  it('renders "1 managed" for a managed resource', () => {
    render(<ResourceSummary spec={specOneResource} />)
    expect(screen.getByTestId('resource-summary').textContent).toContain('1 managed')
  })

  it('renders collection count for forEach resources', () => {
    render(<ResourceSummary spec={specWithCollection} />)
    expect(screen.getByTestId('resource-summary').textContent).toContain('1 collection')
  })

  it('renders "none" for an empty spec', () => {
    render(<ResourceSummary spec={specEmpty} />)
    expect(screen.getByTestId('resource-summary').textContent).toContain('none')
  })

  it('renders "Resource Summary" heading', () => {
    render(<ResourceSummary spec={specOneResource} />)
    expect(screen.getByText('Resource Summary')).toBeTruthy()
  })
})
