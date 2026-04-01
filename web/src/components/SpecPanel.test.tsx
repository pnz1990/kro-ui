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

// GH #401: SpecPanel renders object/array values as YAML, not JSON.stringify.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SpecPanel from './SpecPanel'

function renderPanel(spec: Record<string, unknown>) {
  const instance = { spec }
  render(
    <MemoryRouter>
      <SpecPanel instance={instance} />
    </MemoryRouter>,
  )
}

describe('SpecPanel — GH #401 YAML rendering', () => {
  it('renders scalar string values as-is', () => {
    renderPanel({ name: 'agent-pool' })
    expect(screen.getByText('agent-pool')).toBeTruthy()
  })

  it('renders nested object values as YAML, not compact JSON', () => {
    renderPanel({ compute: { enabled: true } })
    // Single-key object → toYaml returns "enabled: true" inline in the cell
    expect(screen.getByText('enabled: true')).toBeTruthy()
    // Must NOT render as JSON
    expect(screen.queryByText('{"enabled":true}')).toBeNull()
  })

  it('renders multi-key object in a pre block', () => {
    renderPanel({ mcpServers: { codeExecutor: { enabled: true }, webSearch: { enabled: true } } })
    // Multi-line YAML → rendered in <pre>
    const pre = document.querySelector('.spec-value-pre')
    expect(pre).not.toBeNull()
    expect(pre?.textContent).toContain('codeExecutor')
    expect(pre?.textContent).not.toContain('{"codeExecutor"')
  })

  it('renders array values as YAML list, not JSON array', () => {
    renderPanel({ tags: ['a', 'b', 'c'] })
    const pre = document.querySelector('.spec-value-pre')
    expect(pre).not.toBeNull()
    // YAML list items start with '- '
    expect(pre?.textContent).toContain('- a')
    // Not a JSON array
    expect(pre?.textContent).not.toContain('["a"')
  })

  it('renders null values as em-dash', () => {
    renderPanel({ optional: null })
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('renders empty string as em-dash', () => {
    renderPanel({ label: '' })
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('shows empty state when spec is absent', () => {
    render(
      <MemoryRouter>
        <SpecPanel instance={{}} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/no spec fields/i)).toBeTruthy()
  })
})
