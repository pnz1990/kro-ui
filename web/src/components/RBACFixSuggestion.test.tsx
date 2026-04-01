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
import { render, screen, fireEvent } from '@testing-library/react'
import RBACFixSuggestion from './RBACFixSuggestion'
import type { GVRPermission } from '@/lib/api'

// KroCodeBlock uses useCapabilities — mock it
vi.mock('@/lib/features', () => ({
  useCapabilities: () => ({
    capabilities: { featureGates: { CELOmitFunction: false } },
  }),
}))

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  })
})

function makePermission(overrides: Partial<GVRPermission> = {}): GVRPermission {
  return {
    group: 'apps',
    version: 'v1',
    resource: 'deployments',
    kind: 'Deployment',
    required: ['get', 'list', 'watch'],
    granted: { get: true, list: false, watch: false },
    ...overrides,
  }
}

describe('RBACFixSuggestion', () => {
  it('renders with data-testid="rbac-fix-suggestion"', () => {
    render(
      <RBACFixSuggestion
        permission={makePermission()}
        clusterRoleName="kro-controller"
      />,
    )
    expect(screen.getByTestId('rbac-fix-suggestion')).toBeTruthy()
  })

  it('returns null when no missing verbs', () => {
    const { container } = render(
      <RBACFixSuggestion
        permission={makePermission({ granted: { get: true, list: true, watch: true } })}
        clusterRoleName="kro-controller"
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders missing verbs in the toggle label', () => {
    render(
      <RBACFixSuggestion
        permission={makePermission()}
        clusterRoleName="kro-controller"
      />,
    )
    const text = screen.getByRole('button').textContent ?? ''
    expect(text).toContain('list')
    expect(text).toContain('watch')
  })

  it('starts collapsed (no code block visible)', () => {
    const { container } = render(
      <RBACFixSuggestion
        permission={makePermission()}
        clusterRoleName="kro-controller"
      />,
    )
    expect(container.querySelector('[data-testid="kro-code-block"]')).toBeNull()
  })

  it('expands to show code block when toggle clicked', () => {
    render(
      <RBACFixSuggestion
        permission={makePermission()}
        clusterRoleName="kro-controller"
      />,
    )
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    // RBACFixSuggestion renders 2 KroCodeBlocks (rule YAML + kubectl command)
    const blocks = screen.getAllByTestId('kro-code-block')
    expect(blocks.length).toBeGreaterThanOrEqual(1)
  })

  it('uses the clusterRoleName in the kubectl command', () => {
    render(
      <RBACFixSuggestion
        permission={makePermission()}
        clusterRoleName="my-custom-role"
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    // The kubectl command is in the second code block (index 1)
    const blocks = screen.getAllByTestId('kro-code-block')
    const kubectlBlock = blocks[1] ?? blocks[0]
    expect(kubectlBlock.textContent).toContain('my-custom-role')
  })
})
