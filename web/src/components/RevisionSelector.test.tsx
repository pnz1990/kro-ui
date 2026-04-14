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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RevisionSelector from './RevisionSelector'
import type { K8sObject } from '@/lib/api'

// ── Test helpers ───────────────────────────────────────────────────────────────

function makeRevision(name: string, revisionNum: number): K8sObject {
  return {
    metadata: { name },
    spec: { revision: revisionNum },
  } as unknown as K8sObject
}

// Typical input: latest first (as RevisionsTab passes them)
const REV1 = makeRevision('test-app-v1', 1)
const REV2 = makeRevision('test-app-v2', 2)
const REV3 = makeRevision('test-app-v3', 3)

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RevisionSelector', () => {
  // ── Empty / single revision ────────────────────────────────────

  it('renders null when 0 revisions are provided', () => {
    const onChange = vi.fn()
    const { container } = render(
      <RevisionSelector revisions={[]} onChange={onChange} />,
    )
    expect(container.firstChild).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders single-revision message when exactly 1 revision exists', () => {
    render(<RevisionSelector revisions={[REV1]} onChange={vi.fn()} />)
    expect(screen.getByTestId('revision-selector-single-msg')).toBeInTheDocument()
    expect(screen.getByText(/Only one revision exists/i)).toBeInTheDocument()
  })

  it('does NOT render the dropdown UI when only 1 revision exists', () => {
    render(<RevisionSelector revisions={[REV1]} onChange={vi.fn()} />)
    expect(screen.queryByTestId('revision-selector')).not.toBeInTheDocument()
  })

  // ── Two-dropdown rendering ─────────────────────────────────────

  it('renders two dropdowns when 2+ revisions are provided', () => {
    render(<RevisionSelector revisions={[REV2, REV1]} onChange={vi.fn()} />)
    expect(screen.getByTestId('revision-selector')).toBeInTheDocument()
    expect(screen.getByLabelText('Select revision A (before)')).toBeInTheDocument()
    expect(screen.getByLabelText('Select revision B (after)')).toBeInTheDocument()
  })

  it('defaults Rev A to the first revision (latest) and Rev B to the second', () => {
    render(<RevisionSelector revisions={[REV3, REV2, REV1]} onChange={vi.fn()} />)
    const selectA = screen.getByLabelText('Select revision A (before)') as HTMLSelectElement
    const selectB = screen.getByLabelText('Select revision B (after)') as HTMLSelectElement
    expect(selectA.value).toBe('test-app-v3')
    expect(selectB.value).toBe('test-app-v2')
  })

  it('populates both dropdowns with all available revisions', () => {
    render(<RevisionSelector revisions={[REV3, REV2, REV1]} onChange={vi.fn()} />)
    const selectA = screen.getByLabelText('Select revision A (before)') as HTMLSelectElement
    expect(selectA.options.length).toBe(3)
    // Labels include revision number
    const labels = Array.from(selectA.options).map((o) => o.textContent ?? '')
    expect(labels.some((l) => l.includes('#3'))).toBe(true)
    expect(labels.some((l) => l.includes('#2'))).toBe(true)
    expect(labels.some((l) => l.includes('#1'))).toBe(true)
  })

  // ── Auto-seed on mount ─────────────────────────────────────────

  it('calls onChange with default pair on mount when 2+ revisions exist', () => {
    const onChange = vi.fn()
    render(<RevisionSelector revisions={[REV2, REV1]} onChange={onChange} />)
    expect(onChange).toHaveBeenCalledOnce()
    const call = onChange.mock.calls[0][0]
    expect(call).not.toBeNull()
    expect(call.revA).toBe(REV2)
    expect(call.revB).toBe(REV1)
  })

  it('does NOT call onChange on mount when only 1 revision exists', () => {
    const onChange = vi.fn()
    render(<RevisionSelector revisions={[REV1]} onChange={onChange} />)
    expect(onChange).not.toHaveBeenCalled()
  })

  // ── User interaction ───────────────────────────────────────────

  it('calls onChange with updated pair when Rev A is changed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RevisionSelector revisions={[REV3, REV2, REV1]} onChange={onChange} />)

    // clear initial call
    onChange.mockClear()

    const selectA = screen.getByLabelText('Select revision A (before)')
    await user.selectOptions(selectA, 'test-app-v1')

    // Last call should have revA=REV1 (the newly selected) and revB=REV2 (default)
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall).not.toBeNull()
    expect(lastCall.revA).toBe(REV1)
    expect(lastCall.revB).toBe(REV2)
  })

  it('calls onChange with updated pair when Rev B is changed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RevisionSelector revisions={[REV3, REV2, REV1]} onChange={onChange} />)
    onChange.mockClear()

    const selectB = screen.getByLabelText('Select revision B (after)')
    await user.selectOptions(selectB, 'test-app-v1')

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall).not.toBeNull()
    expect(lastCall.revA).toBe(REV3)
    expect(lastCall.revB).toBe(REV1)
  })

  it('calls onChange(null) when Rev A and Rev B are set to the same revision', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RevisionSelector revisions={[REV2, REV1]} onChange={onChange} />)
    onChange.mockClear()

    // Rev A is currently test-app-v2; set Rev B to test-app-v2 as well → same, null
    const selectB = screen.getByLabelText('Select revision B (after)')
    await user.selectOptions(selectB, 'test-app-v2')

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall).toBeNull()
  })

  // ── Revision label format ──────────────────────────────────────

  it('shows revision number in option label', () => {
    render(<RevisionSelector revisions={[REV2, REV1]} onChange={vi.fn()} />)
    const selectA = screen.getByLabelText('Select revision A (before)') as HTMLSelectElement
    const firstLabel = selectA.options[0].textContent ?? ''
    // Should contain revision number
    expect(firstLabel).toMatch(/#2/)
    expect(firstLabel).toContain('test-app-v2')
  })
})
