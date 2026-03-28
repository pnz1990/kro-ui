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

// CopySpecButton.test.tsx — unit tests for CopySpecButton.
// GH #306: CopySpecButton had no unit tests.

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import CopySpecButton from './CopySpecButton'
import type { K8sObject } from '@/lib/api'

const instance: K8sObject = {
  apiVersion: 'e2e.kro-ui.dev/v1alpha1',
  kind: 'WebApp',
  metadata: { name: 'my-app', namespace: 'kro-ui-demo' },
  spec: { appName: 'my-app', replicas: 3, enableConfig: true },
}

describe('CopySpecButton', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
    })
  })

  it('renders with correct aria-label and title', () => {
    render(<CopySpecButton instance={instance} />)
    const btn = screen.getByTestId('copy-spec-btn')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-label', 'Copy instance YAML to clipboard')
  })

  it('shows "⎘ Copy YAML" initially', () => {
    render(<CopySpecButton instance={instance} />)
    expect(screen.getByTestId('copy-spec-btn')).toHaveTextContent('⎘ Copy YAML')
  })

  it('shows "✓ Copied!" after clicking', async () => {
    render(<CopySpecButton instance={instance} />)
    const btn = screen.getByTestId('copy-spec-btn')
    await act(async () => {
      fireEvent.click(btn)
    })
    await waitFor(() => {
      expect(screen.getByTestId('copy-spec-btn')).toHaveTextContent('✓ Copied!')
    })
  })

  it('calls clipboard.writeText with YAML containing apiVersion, kind, metadata, spec', async () => {
    render(<CopySpecButton instance={instance} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-spec-btn'))
    })
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledOnce()
    })
    const yamlArg = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(yamlArg).toContain('apiVersion:')
    expect(yamlArg).toContain('WebApp')
    expect(yamlArg).toContain('my-app')
    expect(yamlArg).toContain('spec:')
  })

  it('reverts back to "⎘ Copy YAML" after 2s', async () => {
    vi.useFakeTimers()
    render(<CopySpecButton instance={instance} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-spec-btn'))
    })
    await act(async () => {
      vi.advanceTimersByTime(2001)
    })
    expect(screen.getByTestId('copy-spec-btn')).toHaveTextContent('⎘ Copy YAML')
    vi.useRealTimers()
  })
})
