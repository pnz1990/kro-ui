// useHealthTrend — accumulates per-poll health distribution snapshots for a set
// of kro instances. Used to drive the HealthTrendSparkline on the RGD detail page.
//
// Spec: .specify/specs/issue-539/spec.md  O3, O5
//
// Design constraint (docs/design/30-health-system.md §Zone 3):
//   "Health history persistence beyond the current session" is SCOPED OUT.
//   No localStorage, no backend changes — in-session accumulation only.

import { useCallback, useRef, useState } from 'react'
import type { K8sObject } from '@/lib/api'
import { extractInstanceHealth } from '@/lib/format'

/** A single health snapshot: counts at one point in time. */
export interface HealthSample {
  timestamp: number
  total: number
  ready: number
  error: number
  degraded: number
  reconciling: number
  pending: number
  unknown: number
}

/** Max samples to retain. 288 ≈ 24h at 5-minute polling; session will be shorter. */
const MAX_SAMPLES = 288

function snapshotFromItems(items: K8sObject[]): HealthSample {
  const sample: HealthSample = {
    timestamp: Date.now(),
    total: items.length,
    ready: 0,
    error: 0,
    degraded: 0,
    reconciling: 0,
    pending: 0,
    unknown: 0,
  }
  for (const item of items) {
    const { state } = extractInstanceHealth(item)
    sample[state] = (sample[state] ?? 0) + 1
  }
  return sample
}

export interface UseHealthTrendResult {
  samples: HealthSample[]
  record: (items: K8sObject[]) => void
}

/**
 * Manages in-session health trend sampling for a set of instances.
 *
 * Call `record(items)` on each successful fetch to append a new snapshot.
 * Returns the accumulated `samples` array (FIFO, capped at MAX_SAMPLES).
 *
 * Usage:
 *   const { samples, record } = useHealthTrend()
 *   // on each listInstances success:
 *   record(instanceList.items ?? [])
 */
export function useHealthTrend(): UseHealthTrendResult {
  const [samples, setSamples] = useState<HealthSample[]>([])
  // lastTimestamp prevents duplicate samples within the same render cycle
  const lastTimestampRef = useRef<number>(0)

  const record = useCallback((items: K8sObject[]) => {
    const now = Date.now()
    // Deduplicate: if called twice within 1s (React strict mode, double render), skip
    if (now - lastTimestampRef.current < 1000) return
    lastTimestampRef.current = now

    const snapshot = snapshotFromItems(items)
    setSamples((prev) => {
      const next = [...prev, snapshot]
      // FIFO: keep only the most recent MAX_SAMPLES
      return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next
    })
  }, [])

  return { samples, record }
}
