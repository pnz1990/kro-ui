// TerminatingBanner.tsx — Rose banner shown when a kro instance is Terminating.
//
// Displays "⊗ Terminating since {relative time}" with the full ISO timestamp
// accessible via the title attribute on hover.
//
// The `tick` prop is used as a useMemo dependency so the relative time label
// updates each poll cycle (every 5s) without any separate setInterval.
//
// Spec: .specify/specs/031-deletion-debugger/ FR-001

import { useMemo } from 'react'
import { formatRelativeTime } from '@/lib/k8s'
import './TerminatingBanner.css'

interface TerminatingBannerProps {
  /** RFC3339 ISO timestamp when deletionTimestamp was set. */
  deletionTimestamp: string
  /**
   * Poll tick counter from usePolling — used as a useMemo dependency so the
   * relative time label updates with each data refresh cycle.
   * Do NOT introduce a setInterval — use the polling tick instead.
   */
  tick: number
}

/**
 * TerminatingBanner — displays a prominent rose banner while an instance
 * is in Terminating state (deletionTimestamp set, not yet gone).
 *
 * Takes precedence over the Reconciling banner (caller is responsible for
 * ensuring mutual exclusivity — render this instead of reconciling banner
 * when isTerminating() is true).
 */
export default function TerminatingBanner({ deletionTimestamp, tick }: TerminatingBannerProps) {
  // Recompute relative time on every poll tick.
  // tick is declared in deps to silence the exhaustive-deps lint rule —
  // its value changing is exactly the signal we want to re-compute.
  const relativeTime = useMemo(
    () => formatRelativeTime(deletionTimestamp),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deletionTimestamp, tick],
  )

  return (
    <div
      role="status"
      aria-live="polite"
      className="terminating-banner"
      title={deletionTimestamp}
    >
      <span className="terminating-banner-icon" aria-hidden="true">⊗</span>
      <span className="terminating-banner-text">
        Terminating since {relativeTime}
      </span>
    </div>
  )
}
