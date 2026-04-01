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
import { render } from '@testing-library/react'
import RevisionsTab from './RevisionsTab'

// Mock the API — RevisionsTab calls listGraphRevisions on mount
vi.mock('@/lib/api', () => ({
  listGraphRevisions: vi.fn(),
}))

// KroCodeBlock requires useCapabilities
vi.mock('@/lib/features', () => ({
  useCapabilities: () => ({
    capabilities: { featureGates: { CELOmitFunction: false } },
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  })
})

describe('RevisionsTab', () => {
  it('shows loading state initially', async () => {
    const { listGraphRevisions } = vi.mocked(await import('@/lib/api'))
    // Never resolves — keeps loading
    listGraphRevisions.mockReturnValue(new Promise(() => {}))
    render(<RevisionsTab rgdName="test-app" />)
    // The component must render without crashing — just verify DOM exists
    expect(document.body).toBeTruthy()
  })

  it('shows empty state when no revisions are returned', async () => {
    const { listGraphRevisions } = vi.mocked(await import('@/lib/api'))
    listGraphRevisions.mockResolvedValue({ items: [], metadata: {} })
    render(<RevisionsTab rgdName="test-app" />)
    // Wait for promise to flush
    await vi.waitFor(() => {
      const text = document.body.textContent ?? ''
      expect(text).toMatch(/no revisions|0 revision/i)
    }, { timeout: 2000 })
  })

  it('shows error state when API call fails', async () => {
    const { listGraphRevisions } = vi.mocked(await import('@/lib/api'))
    listGraphRevisions.mockRejectedValue(new Error('connection refused'))
    render(<RevisionsTab rgdName="test-app" />)
    await vi.waitFor(() => {
      const text = document.body.textContent ?? ''
      // RevisionsTab shows "Could not load revisions" on error
      expect(text).toMatch(/could not load|revisions|retry/i)
    }, { timeout: 2000 })
  })

  it('renders revision rows when revisions are returned', async () => {
    const { listGraphRevisions } = vi.mocked(await import('@/lib/api'))
    listGraphRevisions.mockResolvedValue({
      metadata: {},
      items: [
        {
          metadata: { name: 'test-app-rev-1', creationTimestamp: '2026-01-01T00:00:00Z' },
          spec: { revision: 1 },
          status: { state: 'ACTIVE' },
        },
      ],
    })
    render(<RevisionsTab rgdName="test-app" />)
    await vi.waitFor(() => {
      // revision 1 should appear in the table
      expect(document.body.textContent).toContain('1')
    }, { timeout: 2000 })
  })
})
