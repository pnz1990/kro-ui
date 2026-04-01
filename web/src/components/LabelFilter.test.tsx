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
import LabelFilter from './LabelFilter'

describe('LabelFilter', () => {
  it('renders trigger button', () => {
    render(
      <LabelFilter labels={['team=platform']} activeLabels={[]} onFilter={vi.fn()} />,
    )
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('shows "Filter by label" when no active labels', () => {
    render(
      <LabelFilter labels={['team=platform']} activeLabels={[]} onFilter={vi.fn()} />,
    )
    expect(screen.getByRole('button').textContent).toContain('Filter by label')
  })

  it('shows active count in button label when filters are active', () => {
    render(
      <LabelFilter
        labels={['team=platform', 'env=prod']}
        activeLabels={['team=platform']}
        onFilter={vi.fn()}
      />,
    )
    expect(screen.getByRole('button').textContent).toContain('Labels (1)')
  })

  it('opens dropdown on click', () => {
    render(
      <LabelFilter labels={['team=platform']} activeLabels={[]} onFilter={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.getByText('team=platform')).toBeTruthy()
  })

  it('shows "No labels found" when labels list is empty', () => {
    render(<LabelFilter labels={[]} activeLabels={[]} onFilter={vi.fn()} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/no labels found/i)).toBeTruthy()
  })

  it('calls onFilter with toggled selection when an option is clicked', () => {
    const onFilter = vi.fn()
    render(
      <LabelFilter labels={['team=platform']} activeLabels={[]} onFilter={onFilter} />,
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('team=platform'))
    expect(onFilter).toHaveBeenCalledWith(['team=platform'])
  })

  it('shows "Clear all filters" button when filters active and dropdown open', () => {
    render(
      <LabelFilter
        labels={['team=platform']}
        activeLabels={['team=platform']}
        onFilter={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/clear all filters/i)).toBeTruthy()
  })

  it('calls onFilter with [] when Clear all is clicked', () => {
    const onFilter = vi.fn()
    render(
      <LabelFilter
        labels={['team=platform']}
        activeLabels={['team=platform']}
        onFilter={onFilter}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText(/clear all filters/i))
    expect(onFilter).toHaveBeenCalledWith([])
  })
})
