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
import VirtualGrid from './VirtualGrid'

describe('VirtualGrid', () => {
  it('renders data-testid="virtual-grid-container"', () => {
    render(
      <VirtualGrid
        items={['a', 'b', 'c']}
        renderItem={(item) => <span>{item}</span>}
        itemHeight={200}
      />,
    )
    expect(screen.getByTestId('virtual-grid-container')).toBeTruthy()
  })

  it('renders all items in unmeasured state (containerHeight=0)', () => {
    // In jsdom, ResizeObserver is not called so containerHeight stays 0,
    // which means unmeasured=true and all items are rendered.
    render(
      <VirtualGrid
        items={['apple', 'banana', 'cherry']}
        renderItem={(item) => <span data-testid={`item-${item}`}>{item}</span>}
        itemHeight={200}
      />,
    )
    expect(screen.getByTestId('item-apple')).toBeTruthy()
    expect(screen.getByTestId('item-banana')).toBeTruthy()
    expect(screen.getByTestId('item-cherry')).toBeTruthy()
  })

  it('renders empty state when items is empty', () => {
    render(
      <VirtualGrid
        items={[]}
        renderItem={() => null}
        itemHeight={200}
        emptyState={<p data-testid="empty-msg">Nothing here</p>}
      />,
    )
    expect(screen.getByTestId('empty-msg')).toBeTruthy()
  })

  it('renders default empty state text when emptyState prop is omitted', () => {
    render(
      <VirtualGrid items={[]} renderItem={() => null} itemHeight={200} />,
    )
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('No items')
  })

  it('renders with role="list" when items exist', () => {
    render(
      <VirtualGrid
        items={['x']}
        renderItem={(item) => <span>{item}</span>}
        itemHeight={200}
      />,
    )
    expect(screen.getByRole('list')).toBeTruthy()
  })

  it('applies extra className when provided', () => {
    const { container } = render(
      <VirtualGrid
        items={['x']}
        renderItem={(item) => <span>{item}</span>}
        itemHeight={200}
        className="my-grid"
      />,
    )
    expect(container.querySelector('.my-grid')).not.toBeNull()
  })
})
