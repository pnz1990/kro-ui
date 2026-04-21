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

// AlertBellButton.test.tsx — unit tests for the health alert subscription bell.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AlertBellButton from './AlertBellButton'

describe('AlertBellButton', () => {
  // ── T001: hidden when unavailable ────────────────────────────────────────

  it('T001: renders nothing when available=false (O6)', () => {
    const { container } = render(
      <AlertBellButton
        available={false}
        subscriptionState="inactive"
        onToggle={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  // ── T002: renders button when available ──────────────────────────────────

  it('T002: renders a button when available=true', () => {
    render(
      <AlertBellButton
        available={true}
        subscriptionState="inactive"
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('alert-bell-btn')).toBeTruthy()
  })

  // ── T003: aria-label for inactive state ──────────────────────────────────

  it('T003: aria-label is "Subscribe to health alerts" when inactive (O7)', () => {
    render(
      <AlertBellButton
        available={true}
        subscriptionState="inactive"
        onToggle={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('alert-bell-btn')
    expect(btn.getAttribute('aria-label')).toBe('Subscribe to health alerts')
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  // ── T004: aria-label for active state ────────────────────────────────────

  it('T004: aria-label is "Unsubscribe from health alerts" when active (O7)', () => {
    render(
      <AlertBellButton
        available={true}
        subscriptionState="active"
        onToggle={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('alert-bell-btn')
    expect(btn.getAttribute('aria-label')).toBe('Unsubscribe from health alerts')
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  // ── T005: calls onToggle when clicked ────────────────────────────────────

  it('T005: calls onToggle when clicked (not blocked)', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    render(
      <AlertBellButton
        available={true}
        subscriptionState="inactive"
        onToggle={onToggle}
      />,
    )
    fireEvent.click(screen.getByTestId('alert-bell-btn'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  // ── T006: disabled when blocked ──────────────────────────────────────────

  it('T006: button is disabled when subscriptionState=blocked (O4)', () => {
    render(
      <AlertBellButton
        available={true}
        subscriptionState="blocked"
        onToggle={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('alert-bell-btn')
    expect(btn).toHaveProperty('disabled', true)
  })

  // ── T007: tooltip shows blocked message ──────────────────────────────────

  it('T007: tooltip shows "Notifications blocked by browser" when blocked (O4)', () => {
    render(
      <AlertBellButton
        available={true}
        subscriptionState="blocked"
        onToggle={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('alert-bell-btn')
    expect(btn.getAttribute('title')).toContain('blocked')
  })

  // ── T008: applies active CSS class ────────────────────────────────────────

  it('T008: applies --active CSS class when subscriptionState=active', () => {
    render(
      <AlertBellButton
        available={true}
        subscriptionState="active"
        onToggle={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('alert-bell-btn')
    expect(btn.className).toContain('alert-bell-btn--active')
  })

  // ── T009: applies blocked CSS class ─────────────────────────────────────

  it('T009: applies --blocked CSS class when subscriptionState=blocked', () => {
    render(
      <AlertBellButton
        available={true}
        subscriptionState="blocked"
        onToggle={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('alert-bell-btn')
    expect(btn.className).toContain('alert-bell-btn--blocked')
  })
})
