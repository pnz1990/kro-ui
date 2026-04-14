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
import OverviewWidget from './OverviewWidget'

describe('OverviewWidget', () => {
  // ── Loading state ──────────────────────────────────────────────

  it('renders shimmer skeleton when loading=true', () => {
    const { container } = render(
      <OverviewWidget title="Health" loading={true} error={null} />,
    )
    expect(container.querySelector('.overview-widget__skeleton')).not.toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('skeleton aria-label includes the widget title', () => {
    const { container } = render(
      <OverviewWidget title="Controller Metrics" loading={true} error={null} />,
    )
    const skeleton = container.querySelector('[aria-busy="true"]')
    expect(skeleton?.getAttribute('aria-label')).toContain('Controller Metrics')
  })

  it('does not render children when loading', () => {
    render(
      <OverviewWidget title="Health" loading={true} error={null}>
        <span data-testid="child">content</span>
      </OverviewWidget>,
    )
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
  })

  // ── Error state ────────────────────────────────────────────────

  it('renders error message when error is non-null and not loading', () => {
    render(
      <OverviewWidget title="Events" loading={false} error="connection refused" />,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Could not load Events/i)).toBeInTheDocument()
  })

  it('renders Retry button when onRetry is provided', () => {
    const onRetry = vi.fn()
    render(
      <OverviewWidget title="Events" loading={false} error="err" onRetry={onRetry} />,
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('calls onRetry when Retry button is clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <OverviewWidget title="Events" loading={false} error="err" onRetry={onRetry} />,
    )
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('does not render Retry button when onRetry is not provided', () => {
    render(
      <OverviewWidget title="Events" loading={false} error="err" />,
    )
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('does not render children when error is non-null', () => {
    render(
      <OverviewWidget title="Events" loading={false} error="err">
        <span data-testid="child">content</span>
      </OverviewWidget>,
    )
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
  })

  // ── Normal state ───────────────────────────────────────────────

  it('renders children when loading=false and error=null', () => {
    render(
      <OverviewWidget title="Health" loading={false} error={null}>
        <span data-testid="child">content</span>
      </OverviewWidget>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders the title in the card header', () => {
    render(
      <OverviewWidget title="Fleet Health" loading={false} error={null} />,
    )
    expect(screen.getByRole('heading', { name: 'Fleet Health' })).toBeInTheDocument()
  })

  // ── data-testid and className ──────────────────────────────────

  it('applies className to the root element', () => {
    const { container } = render(
      <OverviewWidget title="T" loading={false} error={null} className="widget-foo" />,
    )
    expect(container.firstChild).toHaveClass('widget-foo')
  })

  it('sets data-testid on the root element when provided', () => {
    render(
      <OverviewWidget
        title="T"
        loading={false}
        error={null}
        data-testid="my-widget"
      />,
    )
    expect(screen.getByTestId('my-widget')).toBeInTheDocument()
  })

  it('falls back to className as testid when data-testid is not provided', () => {
    render(
      <OverviewWidget
        title="T"
        loading={false}
        error={null}
        className="widget-bar"
      />,
    )
    expect(screen.getByTestId('widget-bar')).toBeInTheDocument()
  })

  // ── No spurious renders ────────────────────────────────────────

  it('shows neither skeleton nor error when loading=false and error=null', () => {
    const { container } = render(
      <OverviewWidget title="X" loading={false} error={null} />,
    )
    expect(container.querySelector('.overview-widget__skeleton')).toBeNull()
    expect(container.querySelector('.overview-widget__error')).toBeNull()
  })
})
