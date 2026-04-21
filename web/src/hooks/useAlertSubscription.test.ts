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

// useAlertSubscription.test.ts — unit tests for health alert subscription hook.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAlertSubscription } from './useAlertSubscription'
import type { InstanceSummary } from '@/lib/api'

// Mock the Notification API
const mockNotification = vi.fn()

function makeInstance(
  name: string,
  namespace = 'default',
  rgdName = 'webapp',
  state = '',
  ready = 'True',
): InstanceSummary {
  return { name, namespace, kind: 'WebApp', rgdName, state, ready, creationTimestamp: '' }
}

describe('useAlertSubscription', () => {
  beforeEach(() => {
    // Reset Notification mock
    mockNotification.mockReset()
    // Install Notification mock on global
    Object.defineProperty(window, 'Notification', {
      value: Object.assign(mockNotification, { permission: 'granted' }),
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── T001: available when Notification API exists ─────────────────────────

  it('T001: available returns true when Notification API is present', () => {
    const { result } = renderHook(() => useAlertSubscription())
    expect(result.current.available).toBe(true)
  })

  // ── T002: unavailable when Notification API is absent ───────────────────

  it('T002: available returns false when Notification API is absent', () => {
    const original = window.Notification
    // @ts-expect-error intentional deletion for test
    delete window.Notification
    const { result } = renderHook(() => useAlertSubscription())
    expect(result.current.available).toBe(false)
    // Restore
    Object.defineProperty(window, 'Notification', { value: original, writable: true, configurable: true })
  })

  // ── T003: initial state is inactive ─────────────────────────────────────

  it('T003: initial subscriptionState is inactive', () => {
    const { result } = renderHook(() => useAlertSubscription())
    expect(result.current.subscriptionState).toBe('inactive')
  })

  // ── T004: toggleSubscription when permission already granted → active ────

  it('T004: toggleSubscription with pre-granted permission → active', async () => {
    const { result } = renderHook(() => useAlertSubscription())
    await act(async () => {
      await result.current.toggleSubscription()
    })
    expect(result.current.subscriptionState).toBe('active')
  })

  // ── T005: toggleSubscription when subscribed → inactive ─────────────────

  it('T005: toggling subscription off → inactive', async () => {
    const { result } = renderHook(() => useAlertSubscription())
    // Subscribe
    await act(async () => {
      await result.current.toggleSubscription()
    })
    expect(result.current.subscriptionState).toBe('active')
    // Unsubscribe
    await act(async () => {
      await result.current.toggleSubscription()
    })
    expect(result.current.subscriptionState).toBe('inactive')
  })

  // ── T006: checkTransitions fires Notification on error transition ────────

  it('T006: checkTransitions fires Notification when instance enters error state', async () => {
    const { result } = renderHook(() => useAlertSubscription())

    // Subscribe
    await act(async () => {
      await result.current.toggleSubscription()
    })

    // First poll: instance is ready
    act(() => {
      result.current.checkTransitions([makeInstance('my-app', 'default', 'webapp', '', 'True')])
    })
    expect(mockNotification).not.toHaveBeenCalled()

    // Second poll: instance transitions to error (ready=False)
    act(() => {
      result.current.checkTransitions([makeInstance('my-app', 'default', 'webapp', '', 'False')])
    })
    expect(mockNotification).toHaveBeenCalledTimes(1)
    expect(mockNotification).toHaveBeenCalledWith(
      'kro-ui: Health Alert',
      expect.objectContaining({ body: 'my-app (default/webapp) → error' }),
    )
  })

  // ── T007: no alert if instance was already in error on first poll ────────

  it('T007: no alert fired for instance already in error at subscription time', async () => {
    const { result } = renderHook(() => useAlertSubscription())

    await act(async () => {
      await result.current.toggleSubscription()
    })

    // First poll: instance already in error — no previous state exists
    act(() => {
      result.current.checkTransitions([makeInstance('stuck', 'default', 'webapp', '', 'False')])
    })
    expect(mockNotification).not.toHaveBeenCalled()
  })

  // ── T008: no duplicate alert if instance stays in error ──────────────────

  it('T008: no duplicate alert when instance remains in error across polls', async () => {
    const { result } = renderHook(() => useAlertSubscription())

    await act(async () => {
      await result.current.toggleSubscription()
    })

    // First poll: ready
    act(() => {
      result.current.checkTransitions([makeInstance('my-app', 'default', 'webapp', '', 'True')])
    })

    // Second poll: error → alert fires
    act(() => {
      result.current.checkTransitions([makeInstance('my-app', 'default', 'webapp', '', 'False')])
    })

    // Third poll: still error → no additional alert
    act(() => {
      result.current.checkTransitions([makeInstance('my-app', 'default', 'webapp', '', 'False')])
    })

    expect(mockNotification).toHaveBeenCalledTimes(1)
  })

  // ── T009: alert fires again after recovery ────────────────────────────────

  it('T009: alert fires again when instance re-enters error after recovering', async () => {
    const { result } = renderHook(() => useAlertSubscription())

    await act(async () => {
      await result.current.toggleSubscription()
    })

    // ready → error → ready → error
    act(() => {
      result.current.checkTransitions([makeInstance('app', 'default', 'webapp', '', 'True')])
    })
    act(() => {
      result.current.checkTransitions([makeInstance('app', 'default', 'webapp', '', 'False')])
    })
    expect(mockNotification).toHaveBeenCalledTimes(1)

    // Recovers
    act(() => {
      result.current.checkTransitions([makeInstance('app', 'default', 'webapp', '', 'True')])
    })
    expect(mockNotification).toHaveBeenCalledTimes(1)

    // Enters error again
    act(() => {
      result.current.checkTransitions([makeInstance('app', 'default', 'webapp', '', 'False')])
    })
    expect(mockNotification).toHaveBeenCalledTimes(2)
  })

  // ── T010: no alert when not subscribed ───────────────────────────────────

  it('T010: no alert when not subscribed even if instance enters error', () => {
    const { result } = renderHook(() => useAlertSubscription())
    // Not subscribed — call checkTransitions directly
    act(() => {
      result.current.checkTransitions([makeInstance('app', 'default', 'webapp', '', 'False')])
    })
    act(() => {
      result.current.checkTransitions([makeInstance('app', 'default', 'webapp', '', 'True')])
    })
    act(() => {
      result.current.checkTransitions([makeInstance('app', 'default', 'webapp', '', 'False')])
    })
    expect(mockNotification).not.toHaveBeenCalled()
  })

  // ── T011: alert fires for degraded transition (IN_PROGRESS → error) ──────

  it('T011: alert fires for degraded transition', async () => {
    const { result } = renderHook(() => useAlertSubscription())

    await act(async () => {
      await result.current.toggleSubscription()
    })

    // ready → IN_PROGRESS (reconciling) → error
    act(() => {
      result.current.checkTransitions([makeInstance('app', 'default', 'webapp', '', 'True')])
    })
    act(() => {
      result.current.checkTransitions([makeInstance('app', 'default', 'webapp', 'IN_PROGRESS', 'False')])
    })
    // reconciling → no alert
    expect(mockNotification).not.toHaveBeenCalled()

    act(() => {
      result.current.checkTransitions([makeInstance('app', 'default', 'webapp', '', 'False')])
    })
    expect(mockNotification).toHaveBeenCalledTimes(1)
  })

  // ── T012: blocked state when permission denied ────────────────────────────

  it('T012: subscriptionState is blocked when permission is denied', async () => {
    // Simulate requestPermission returning 'denied'
    const requestPermission = vi.fn().mockResolvedValue('denied')
    Object.defineProperty(window, 'Notification', {
      value: Object.assign(mockNotification, { permission: 'default', requestPermission }),
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useAlertSubscription())

    await act(async () => {
      await result.current.toggleSubscription()
    })

    // Denied: subscriptionState stays inactive (was not subscribed)
    expect(result.current.subscriptionState).toBe('inactive')
    expect(result.current.permission).toBe('denied')
  })
})
