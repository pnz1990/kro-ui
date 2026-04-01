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
import InstanceForm from './InstanceForm'
import type { InstanceFormState, FieldValue } from '@/lib/generator'
import type { SchemaDoc } from '@/lib/schema'

function makeField(name: string, type: string, opts: Record<string, unknown> = {}): import('@/lib/schema').ParsedField {
  return {
    name,
    raw: `\${schema.spec.${name}}`,
    inferredType: type,
    parsedType: { type, ...opts },
  }
}

function makeSchema(fields: import('@/lib/schema').ParsedField[]): SchemaDoc {
  return { specFields: fields, statusFields: [], kind: 'TestApp', apiVersion: 'v1alpha1', group: 'e2e.kro-ui.dev' }
}

function makeState(fields: FieldValue[]): InstanceFormState {
  return { metadataName: 'my-app', fields }
}

describe('InstanceForm', () => {
  it('renders metadata name input', () => {
    const schema = makeSchema([])
    render(
      <InstanceForm
        schema={schema}
        state={makeState([])}
        onChange={vi.fn()}
      />,
    )
    const input = screen.getByRole('textbox', { name: /name/i })
    expect(input).toBeTruthy()
  })

  it('renders required field indicator for required fields', () => {
    const schema = makeSchema([makeField('appName', 'string', { required: true })])
    const state = makeState([{ name: 'appName', value: '', items: [], isArray: false }])
    const { container } = render(
      <InstanceForm schema={schema} state={state} onChange={vi.fn()} />,
    )
    // Required indicator is a span or legend with class containing "required"
    expect(container.querySelector('[aria-required="true"], .instance-form__required-legend')).not.toBeNull()
  })

  it('calls onChange when metadata name changes', () => {
    const onChange = vi.fn()
    const schema = makeSchema([])
    render(
      <InstanceForm schema={schema} state={makeState([])} onChange={onChange} />,
    )
    const input = screen.getByRole('textbox', { name: /name/i })
    fireEvent.change(input, { target: { value: 'new-name' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('renders a select for enum-typed fields', () => {
    const schema = makeSchema([makeField('env', 'string', { enum: 'dev,staging,prod' })])
    const state = makeState([{ name: 'env', value: 'dev', items: [], isArray: false }])
    render(<InstanceForm schema={schema} state={state} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: /env/i })).toBeTruthy()
  })

  it('renders a checkbox for boolean-typed fields', () => {
    const schema = makeSchema([makeField('enableTLS', 'boolean')])
    const state = makeState([{ name: 'enableTLS', value: 'false', items: [], isArray: false }])
    render(<InstanceForm schema={schema} state={state} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /enableTLS/i })).toBeTruthy()
  })
})
