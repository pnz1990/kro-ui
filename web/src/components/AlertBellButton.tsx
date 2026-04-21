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

// AlertBellButton — subscribe/unsubscribe toggle for health alert notifications.
// Placed in the TopBar between the nav links and the ContextSwitcher.
//
// Spec: .specify/specs/issue-540/spec.md  O1, O4, O6, O7

import type { AlertSubscriptionState } from '@/hooks/useAlertSubscription'
import './AlertBellButton.css'

interface AlertBellButtonProps {
  /** Whether the Notification API is available in this browser. */
  available: boolean
  /** Current subscription state. */
  subscriptionState: AlertSubscriptionState
  /** Called when the button is clicked — async toggles subscription. */
  onToggle: () => Promise<void>
}

/**
 * Subscribe/unsubscribe bell button for health alert notifications.
 *
 * States:
 *   inactive  — hollow bell; click to subscribe
 *   active    — filled bell; click to unsubscribe
 *   blocked   — muted bell with slash; tooltip explains notifications are blocked
 *
 * Hidden entirely when Notification API is unavailable (O6).
 */
export default function AlertBellButton({
  available,
  subscriptionState,
  onToggle,
}: AlertBellButtonProps) {
  // O6: hide entirely when Notification API is not available
  if (!available) return null

  const isActive = subscriptionState === 'active'
  const isBlocked = subscriptionState === 'blocked'

  const ariaLabel = isActive
    ? 'Unsubscribe from health alerts'
    : 'Subscribe to health alerts'

  const tooltipText = isBlocked
    ? 'Notifications blocked by browser'
    : isActive
      ? 'Health alerts on — click to unsubscribe'
      : 'Subscribe to health alerts'

  return (
    <button
      type="button"
      className={[
        'alert-bell-btn',
        isActive ? 'alert-bell-btn--active' : '',
        isBlocked ? 'alert-bell-btn--blocked' : '',
      ].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      title={tooltipText}
      onClick={isBlocked ? undefined : onToggle}
      disabled={isBlocked}
      data-testid="alert-bell-btn"
    >
      {isBlocked ? (
        // Bell-slash icon for blocked state
        <svg
          className="alert-bell-btn__icon"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Bell body */}
          <path
            d="M10 2a6 6 0 0 1 5.9 5L17 15H3l1.1-8A6 6 0 0 1 10 2Z"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Bell base */}
          <path d="M8.5 17.5a1.5 1.5 0 0 0 3 0" strokeWidth="1.5" strokeLinecap="round" />
          {/* Slash */}
          <line x1="3" y1="3" x2="17" y2="17" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : isActive ? (
        // Filled bell for active subscription
        <svg
          className="alert-bell-btn__icon"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 10 18Z" />
        </svg>
      ) : (
        // Outline bell for inactive state
        <svg
          className="alert-bell-btn__icon"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M10 2a6 6 0 0 1 6 6v3.586l.707.707A1 1 0 0 1 16 14H4a1 1 0 0 1-.707-1.707L4 11.586V8a6 6 0 0 1 6-6ZM10 18a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 10 18Z"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  )
}
