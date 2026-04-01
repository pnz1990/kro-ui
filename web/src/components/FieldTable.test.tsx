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
import FieldTable from './FieldTable'
import type { ParsedField } from '@/lib/schema'

function makeField(overrides: Partial<ParsedField>): ParsedField {
  return {
    name: 'myField',
    raw: '${schema.spec.myField}',
    inferredType: 'string',
    parsedType: undefined,
    ...overrides,
  }
}

describe('FieldTable — spec variant', () => {
  it('returns null when fields is empty', () => {
    const { container } = render(<FieldTable fields={[]} variant="spec" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders field-table with field rows', () => {
    const fields = [
      makeField({ name: 'appName', parsedType: { type: 'string', required: true } }),
    ]
    render(<FieldTable fields={fields} variant="spec" />)
    expect(screen.getByTestId('field-table')).toBeTruthy()
    expect(screen.getByText('appName')).toBeTruthy()
  })

  it('sorts required fields first', () => {
    const fields = [
      makeField({ name: 'optionalField', parsedType: { type: 'string', default: 'foo' } }),
      makeField({ name: 'requiredField', parsedType: { type: 'string', required: true } }),
    ]
    render(<FieldTable fields={fields} variant="spec" />)
    const rows = screen.getAllByTestId('field-row')
    expect(rows[0].textContent).toContain('requiredField')
    expect(rows[1].textContent).toContain('optionalField')
  })

  it('renders required-summary banner when ≥1 required field and multiple fields', () => {
    const fields = [
      makeField({ name: 'reqField', parsedType: { type: 'string', required: true } }),
      makeField({ name: 'optField', parsedType: { type: 'string', default: 'x' } }),
    ]
    render(<FieldTable fields={fields} variant="spec" />)
    expect(screen.getByTestId('field-table-required-summary')).toBeTruthy()
  })

  it('does not render required-summary banner for a single field', () => {
    const fields = [
      makeField({ name: 'onlyField', parsedType: { type: 'string', required: true } }),
    ]
    render(<FieldTable fields={fields} variant="spec" />)
    expect(screen.queryByTestId('field-table-required-summary')).toBeNull()
  })

  it('renders array type as []string', () => {
    const fields = [
      makeField({ name: 'tags', parsedType: { type: 'array', items: 'string' } }),
    ]
    render(<FieldTable fields={fields} variant="spec" />)
    expect(screen.getByText('[]string')).toBeTruthy()
  })

  it('renders falsy default=false correctly (GH #61)', () => {
    const fields = [
      makeField({ name: 'debug', parsedType: { type: 'boolean', default: 'false' } }),
    ]
    render(<FieldTable fields={fields} variant="spec" />)
    // The field should be rendered as optional (has a default)
    const row = screen.getByTestId('field-row')
    expect(row.querySelector('[aria-label="optional"]')).not.toBeNull()
  })
})

describe('FieldTable — status variant', () => {
  it('renders status table with source expression column', () => {
    const fields = [
      makeField({ name: 'endpoint', raw: '${myService.spec.clusterIP}' }),
    ]
    render(<FieldTable fields={fields} variant="status" />)
    expect(screen.getByTestId('field-table')).toBeTruthy()
    expect(screen.getByText('endpoint')).toBeTruthy()
  })
})
