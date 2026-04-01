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
import { MemoryRouter } from 'react-router-dom'
import InstanceOverlayBar from './InstanceOverlayBar'

function renderBar(overrides: Partial<Parameters<typeof InstanceOverlayBar>[0]> = {}) {
  const defaults = {
    rgdName: 'test-app',
    items: [],
    pickerLoading: false,
    pickerError: null,
    selected: null,
    overlayInstance: null,
    overlayLoading: false,
    overlayError: null,
    onSelect: vi.fn(),
    onPickerRetry: vi.fn(),
    onOverlayRetry: vi.fn(),
  }
  return render(
    <MemoryRouter>
      <InstanceOverlayBar {...defaults} {...overrides} />
    </MemoryRouter>,
  )
}

describe('InstanceOverlayBar', () => {
  it('renders picker select when items exist', () => {
    renderBar({
      items: [{ namespace: 'ns-a', name: 'inst-1' }],
    })
    expect(screen.getByRole('combobox')).toBeTruthy()
  })

  it('shows loading text while picker is loading', () => {
    renderBar({ pickerLoading: true })
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })

  it('shows error message and retry when picker errors', () => {
    const onRetry = vi.fn()
    renderBar({ pickerError: 'connection refused', onPickerRetry: onRetry })
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows "no instances" when items is empty and not loading', () => {
    renderBar({ items: [], pickerLoading: false, pickerError: null })
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/no instances/i)
  })

  it('calls onSelect when picker changes', () => {
    const onSelect = vi.fn()
    renderBar({
      items: [
        { namespace: 'ns', name: 'inst-a' },
        { namespace: 'ns', name: 'inst-b' },
      ],
      onSelect,
    })
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'ns/inst-b' } })
    expect(onSelect).toHaveBeenCalled()
  })
})
