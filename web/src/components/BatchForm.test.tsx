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
import BatchForm from './BatchForm'
import type { BatchRow } from '@/lib/generator'

const mockSchema = { fields: [] } as unknown as import('@/lib/schema').SchemaDoc

function makeRow(overrides: Partial<BatchRow> = {}): BatchRow {
  return { index: 0, values: {}, error: undefined, ...overrides }
}

describe('BatchForm', () => {
  it('renders with data-testid="batch-form"', () => {
    render(
      <BatchForm
        schema={mockSchema}
        batchText=""
        onBatchTextChange={vi.fn()}
        rows={[]}
      />,
    )
    expect(screen.getByTestId('batch-form')).toBeTruthy()
  })

  it('renders the textarea with aria-label', () => {
    render(
      <BatchForm
        schema={mockSchema}
        batchText=""
        onBatchTextChange={vi.fn()}
        rows={[]}
      />,
    )
    expect(screen.getByRole('textbox', { name: /batch input/i })).toBeTruthy()
  })

  it('shows empty message when batchText is empty', () => {
    render(
      <BatchForm
        schema={mockSchema}
        batchText=""
        onBatchTextChange={vi.fn()}
        rows={[]}
      />,
    )
    expect(screen.getByText(/enter one set of values/i)).toBeTruthy()
  })

  it('shows manifest count badge when batchText is non-empty', () => {
    const rows = [
      makeRow({ index: 0, values: { name: 'a' } }),
      makeRow({ index: 1, values: { name: 'b' } }),
    ]
    render(
      <BatchForm
        schema={mockSchema}
        batchText="name=a\nname=b"
        onBatchTextChange={vi.fn()}
        rows={rows}
      />,
    )
    expect(screen.getByTestId('batch-count')).toBeTruthy()
    expect(screen.getByTestId('batch-count').textContent).toContain('2')
  })

  it('calls onBatchTextChange when textarea value changes', () => {
    const onChange = vi.fn()
    render(
      <BatchForm
        schema={mockSchema}
        batchText=""
        onBatchTextChange={onChange}
        rows={[]}
      />,
    )
    const textarea = screen.getByRole('textbox', { name: /batch input/i })
    fireEvent.change(textarea, { target: { value: 'name=foo' } })
    expect(onChange).toHaveBeenCalledWith('name=foo')
  })

  it('renders error list when a row has an error', () => {
    const rows = [makeRow({ index: 0, values: {}, error: 'invalid key=value' })]
    render(
      <BatchForm
        schema={mockSchema}
        batchText="bad line"
        onBatchTextChange={vi.fn()}
        rows={rows}
      />,
    )
    expect(screen.getByRole('list', { name: /batch parse errors/i })).toBeTruthy()
    expect(screen.getByText(/line 1/i)).toBeTruthy()
  })
})
