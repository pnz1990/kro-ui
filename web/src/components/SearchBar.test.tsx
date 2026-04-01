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
import SearchBar from './SearchBar'

describe('SearchBar', () => {
  it('renders search input', () => {
    render(<SearchBar value="" onSearch={vi.fn()} />)
    expect(screen.getByRole('searchbox')).toBeTruthy()
  })

  it('shows the current value', () => {
    render(<SearchBar value="hello" onSearch={vi.fn()} />)
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('hello')
  })

  it('calls onSearch with the new value on input change', () => {
    const onSearch = vi.fn()
    render(<SearchBar value="" onSearch={onSearch} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'test' } })
    expect(onSearch).toHaveBeenCalledWith('test')
  })

  it('renders clear button when value is non-empty', () => {
    render(<SearchBar value="hello" onSearch={vi.fn()} />)
    expect(screen.getByRole('button', { name: /clear search/i })).toBeTruthy()
  })

  it('does not render clear button when value is empty', () => {
    render(<SearchBar value="" onSearch={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /clear search/i })).toBeNull()
  })

  it('calls onSearch with "" when clear button is clicked', () => {
    const onSearch = vi.fn()
    render(<SearchBar value="hello" onSearch={onSearch} />)
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }))
    expect(onSearch).toHaveBeenCalledWith('')
  })

  it('renders with custom placeholder', () => {
    render(<SearchBar value="" onSearch={vi.fn()} placeholder="Find something" />)
    expect((screen.getByRole('searchbox') as HTMLInputElement).placeholder).toBe('Find something')
  })

  it('disables input when disabled=true', () => {
    render(<SearchBar value="" onSearch={vi.fn()} disabled={true} />)
    expect((screen.getByRole('searchbox') as HTMLInputElement).disabled).toBe(true)
  })

  it('hides clear button when disabled=true even if value is set', () => {
    render(<SearchBar value="hello" onSearch={vi.fn()} disabled={true} />)
    expect(screen.queryByRole('button', { name: /clear search/i })).toBeNull()
  })
})
