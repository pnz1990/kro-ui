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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import KroCodeBlock from './KroCodeBlock'

// Mock useCapabilities so the component doesn't hit the API
vi.mock('@/lib/features', () => ({
  useCapabilities: () => ({
    capabilities: {
      featureGates: { CELOmitFunction: false },
    },
  }),
}))

beforeEach(() => {
  // clipboard API is not available in jsdom — provide a no-op mock
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  })
})

describe('KroCodeBlock', () => {
  it('renders with data-testid="kro-code-block"', () => {
    render(<KroCodeBlock code="apiVersion: v1" />)
    expect(screen.getByTestId('kro-code-block')).toBeTruthy()
  })

  it('renders the code content', () => {
    render(<KroCodeBlock code="apiVersion: v1\nkind: ConfigMap" />)
    expect(screen.getByTestId('kro-code-block').textContent).toContain('apiVersion')
    expect(screen.getByTestId('kro-code-block').textContent).toContain('ConfigMap')
  })

  it('renders copy button', () => {
    render(<KroCodeBlock code="apiVersion: v1" />)
    expect(screen.getByTestId('code-block-copy-btn')).toBeTruthy()
  })

  it('renders a title bar when title prop is provided', () => {
    render(<KroCodeBlock code="apiVersion: v1" title="My YAML" />)
    expect(screen.getByText('My YAML')).toBeTruthy()
  })

  it('does not render a title bar when title is absent', () => {
    const { container } = render(<KroCodeBlock code="apiVersion: v1" />)
    expect(container.querySelector('.kro-code-block-header')).toBeNull()
  })
})
