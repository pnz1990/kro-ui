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

// useAlertSubscription — manages browser Notification permission state and
// instance health transition tracking for health alert subscriptions.
//
// Design constraint (docs/design/30-health-system.md §Zone 3):
//   "Persistent subscriptions across page refreshes (localStorage)" is SCOPED OUT.
//   In-session only — no localStorage, no backend changes.
//
// Spec: .specify/specs/issue-540/spec.md

import { useCallback, useRef, useState } from 'react'
import type { InstanceSummary } from '@/lib/api'
import { healthFromSummary } from '@/lib/format'

/** Notification permission state — mirrors the browser API but adds 'unavailable'. */
export type AlertPermission =
  | 'unavailable'  // Notification API not supported (non-https or old browser)
  | 'default'      // Not yet asked
  | 'granted'      // Permission granted
  | 'denied'       // User blocked notifications

/** Alert subscription active states. */
export type AlertSubscriptionState = 'inactive' | 'active' | 'blocked'

export interface UseAlertSubscriptionResult {
  /** Whether the Notification API is available in this browser/context. */
  available: boolean
  /** Current notification permission. */
  permission: AlertPermission
  /** Subscription state: inactive (off), active (on + granted), blocked (denied). */
  subscriptionState: AlertSubscriptionState
  /** Toggle subscription on/off. Requests permission if needed. */
  toggleSubscription: () => Promise<void>
  /** Check the given instances for health-state transitions and fire alerts if subscribed. */
  checkTransitions: (items: InstanceSummary[]) => void
}

function isNotificationAvailable(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/**
 * Manages browser Notification permission and in-session health alert subscriptions.
 *
 * Call `checkTransitions(items)` on each successful fetch — the hook compares
 * against the previous snapshot and fires a browser Notification for any
 * instance that newly entered 'error' or 'degraded' state.
 *
 * Usage:
 *   const { subscriptionState, toggleSubscription, checkTransitions } = useAlertSubscription()
 *   // on each successful poll:
 *   checkTransitions(instanceList)
 */
export function useAlertSubscription(): UseAlertSubscriptionResult {
  const available = isNotificationAvailable()

  // Current notification permission
  const [permission, setPermission] = useState<AlertPermission>(() => {
    if (!isNotificationAvailable()) return 'unavailable'
    return Notification.permission as AlertPermission
  })

  // Whether the user has opted in to receive alerts this session
  const [subscribed, setSubscribed] = useState(false)

  // Previous health state map: key = "namespace/name" → previous health state
  const prevStateRef = useRef<Map<string, string>>(new Map())

  const subscriptionState: AlertSubscriptionState = !subscribed
    ? 'inactive'
    : permission === 'granted'
      ? 'active'
      : 'blocked'

  const toggleSubscription = useCallback(async () => {
    if (!isNotificationAvailable()) return

    if (subscribed) {
      // Turn off
      setSubscribed(false)
      prevStateRef.current.clear()
      return
    }

    // Turn on — request permission if needed
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      setPermission(result as AlertPermission)
      if (result === 'granted') {
        setSubscribed(true)
        prevStateRef.current.clear()
      }
      // If denied: stay unsubscribed, update permission state so UI shows blocked icon
      return
    }

    if (Notification.permission === 'granted') {
      setSubscribed(true)
      prevStateRef.current.clear()
    } else {
      // Already denied — update state to reflect it
      setPermission('denied')
    }
  }, [subscribed])

  const checkTransitions = useCallback((items: InstanceSummary[]) => {
    if (!subscribed || permission !== 'granted') return
    if (!isNotificationAvailable()) return

    const prev = prevStateRef.current
    const next = new Map<string, string>()

    for (const item of items) {
      const key = `${item.namespace}/${item.name}`
      const currentState = healthFromSummary(item)
      next.set(key, currentState)

      // Fire alert only on transition to error/degraded
      if (currentState === 'error' || currentState === 'degraded') {
        const previousState = prev.get(key)
        // Only fire if: (a) we have a previous state AND (b) it wasn't already error/degraded
        if (previousState !== undefined && previousState !== 'error' && previousState !== 'degraded') {
          try {
            const stateLabel = currentState === 'error' ? 'error' : 'degraded'
            new Notification('kro-ui: Health Alert', {
              body: `${item.name} (${item.namespace}/${item.rgdName}) → ${stateLabel}`,
              tag: `kro-ui-health-${key}`, // Deduplicate concurrent notifications for same instance
            })
          } catch {
            // Notification constructor can throw in some environments — non-fatal
          }
        }
      }
    }

    prevStateRef.current = next
  }, [subscribed, permission])

  return { available, permission, subscriptionState, toggleSubscription, checkTransitions }
}
