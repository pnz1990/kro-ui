// TerminatingBanner.tsx — Rose banner shown when a kro instance is Terminating.
//
// Shows "⊗ Terminating since {relative time}" plus, when finalizers are
// present for > 5 minutes, an escalation section with a ready-to-copy
// kubectl patch command for force-removal.
//
// Spec: .specify/specs/031-deletion-debugger/ FR-001
// GH #289: stuck finalizer escalation (kubectl patch command)

import { useMemo } from 'react'
import { formatRelativeTime } from '@/lib/k8s'
import './TerminatingBanner.css'

interface TerminatingBannerProps {
  /** RFC3339 ISO timestamp when deletionTimestamp was set. */
  deletionTimestamp: string
  /**
   * Poll tick counter from usePolling — used as a useMemo dependency so the
   * relative time label updates with each data refresh cycle.
   */
  tick: number
  /** Kubernetes Kind of the instance (e.g. "AutoscaledApp"). Used for kubectl command. */
  instanceKind?: string
  /** Name of the instance. Used for kubectl command. */
  instanceName?: string
  /** Namespace of the instance. Empty string for cluster-scoped. */
  instanceNamespace?: string
  /** Current finalizer list. When non-empty and stuck > 5m, shows escalation. */
  finalizers?: string[]
}

/** Minutes elapsed since a given ISO timestamp. Returns null if unparseable. */
function minutesSince(iso: string): number | null {
  const ms = Date.parse(iso)
  if (isNaN(ms)) return null
  return Math.floor((Date.now() - ms) / 60_000)
}

/**
 * TerminatingBanner — displays a prominent rose banner while an instance
 * is in Terminating state (deletionTimestamp set, not yet gone).
 *
 * When finalizers are present and the instance has been terminating for
 * >= 5 minutes, shows an escalation section with the exact kubectl command
 * to force-remove all finalizers. (GH #289)
 */
export default function TerminatingBanner({
  deletionTimestamp,
  tick,
  instanceKind,
  instanceName,
  instanceNamespace,
  finalizers = [],
}: TerminatingBannerProps) {
  const relativeTime = useMemo(
    () => formatRelativeTime(deletionTimestamp),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deletionTimestamp, tick],
  )

  const mins = useMemo(
    () => minutesSince(deletionTimestamp),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deletionTimestamp, tick],
  )

  const isStuck = finalizers.length > 0 && mins !== null && mins >= 5

  // Build the kubectl patch command to force-remove all finalizers
  const kubectlCmd = useMemo(() => {
    if (!isStuck || !instanceKind || !instanceName) return null
    const nsFlag = instanceNamespace
      ? ` -n ${instanceNamespace}`
      : ''
    const resourceType = instanceKind.toLowerCase()
    return `kubectl patch ${resourceType} ${instanceName}${nsFlag} --type=json -p='[{"op":"remove","path":"/metadata/finalizers"}]'`
  }, [isStuck, instanceKind, instanceName, instanceNamespace])

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
        {isStuck && (
          <span className="terminating-banner-escalation">
            {' '}— blocked by {finalizers.length === 1 ? 'finalizer' : `${finalizers.length} finalizers`}{' '}
            <code className="terminating-banner-finalizers">
              {finalizers.join(', ')}
            </code>
            {' '}for {mins}m.
            {kubectlCmd && (
              <>
                {' '}To force remove:{' '}
                <code className="terminating-banner-cmd">{kubectlCmd}</code>
              </>
            )}
          </span>
        )}
      </span>
    </div>
  )
}
