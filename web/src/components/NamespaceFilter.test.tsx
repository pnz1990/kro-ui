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
import NamespaceFilter from './NamespaceFilter'

describe('NamespaceFilter', () => {
  it('renders select with data-testid="namespace-filter"', () => {
    render(
      <NamespaceFilter namespaces={[]} selected="" onChange={vi.fn()} />,
    )
    expect(screen.getByTestId('namespace-filter')).toBeTruthy()
  })

  it('renders "All Namespaces" as the first option', () => {
    render(
      <NamespaceFilter namespaces={['ns-a', 'ns-b']} selected="" onChange={vi.fn()} />,
    )
    const select = screen.getByTestId('namespace-filter') as HTMLSelectElement
    expect(select.options[0].text).toBe('All Namespaces')
    expect(select.options[0].value).toBe('')
  })

  it('renders namespace options', () => {
    render(
      <NamespaceFilter namespaces={['ns-a', 'ns-b']} selected="" onChange={vi.fn()} />,
    )
    const select = screen.getByTestId('namespace-filter') as HTMLSelectElement
    const optTexts = Array.from(select.options).map((o) => o.value)
    expect(optTexts).toContain('ns-a')
    expect(optTexts).toContain('ns-b')
  })

  it('reflects the selected namespace value', () => {
    render(
      <NamespaceFilter namespaces={['ns-a', 'ns-b']} selected="ns-a" onChange={vi.fn()} />,
    )
    const select = screen.getByTestId('namespace-filter') as HTMLSelectElement
    expect(select.value).toBe('ns-a')
  })

  it('calls onChange with the new namespace when selection changes', () => {
    const onChange = vi.fn()
    render(
      <NamespaceFilter namespaces={['ns-a', 'ns-b']} selected="" onChange={onChange} />,
    )
    fireEvent.change(screen.getByTestId('namespace-filter'), { target: { value: 'ns-b' } })
    expect(onChange).toHaveBeenCalledWith('ns-b')
  })
})
