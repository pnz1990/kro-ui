// useHealthTrend — accumulates per-poll health distribution snapshots for a set
// of kro instances. Used to drive the HealthTrendSparkline on the RGD detail page
// and the Overview SRE dashboard (spec issue-712).
//
// Spec: .specify/specs/issue-539/spec.md  O3, O5
//
// Design constraint (docs/design/30-health-system.md §Zone 3):
//   "Health history persistence beyond the current session" is SCOPED OUT.
//   No localStorage, no backend changes — in-session accumulation only.

import { useCallback, useRef, useState } from 'react'
import type { K8sObject } from '@/lib/api'
import type { HealthDistribution } from '@/lib/format'
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

/** Build a HealthSample from a pre-computed HealthDistribution. */
function snapshotFromDistribution(dist: HealthDistribution): HealthSample {
  return {
    timestamp: Date.now(),
    total: dist.total,
    ready: dist.ready,
    error: dist.error,
    degraded: dist.degraded,
    reconciling: dist.reconciling,
    pending: dist.pending,
    unknown: dist.unknown,
  }
}

export interface UseHealthTrendResult {
  samples: HealthSample[]
  /** Record a snapshot from raw K8sObjects (used in RGDDetail — listInstances). */
  record: (items: K8sObject[]) => void
  /**
   * Record a snapshot from a pre-computed HealthDistribution (used in Home —
   * buildHealthDistribution already aggregates InstanceSummary[] health).
   * Avoids re-processing the items through extractInstanceHealth.
   */
  recordDistribution: (dist: HealthDistribution) => void
}

/**
 * Manages in-session health trend sampling for a set of instances.
 *
 * Two recording methods:
 * - `record(items)`: processes raw K8sObjects via extractInstanceHealth
 * - `recordDistribution(dist)`: uses pre-computed HealthDistribution directly
 *
 * Returns the accumulated `samples` array (FIFO, capped at MAX_SAMPLES).
 */
export function useHealthTrend(): UseHealthTrendResult {
  const [samples, setSamples] = useState<HealthSample[]>([])
  // lastTimestamp prevents duplicate samples within the same render cycle
  const lastTimestampRef = useRef<number>(0)

  const pushSnapshot = useCallback((snapshot: HealthSample) => {
    const now = snapshot.timestamp
    // Deduplicate: if called twice within 1s (React strict mode, double render), skip
    if (now - lastTimestampRef.current < 1000) return
    lastTimestampRef.current = now

    setSamples((prev) => {
      const next = [...prev, snapshot]
      // FIFO: keep only the most recent MAX_SAMPLES
      return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next
    })
  }, [])

  const record = useCallback((items: K8sObject[]) => {
    pushSnapshot(snapshotFromItems(items))
  }, [pushSnapshot])

  const recordDistribution = useCallback((dist: HealthDistribution) => {
    pushSnapshot(snapshotFromDistribution(dist))
  }, [pushSnapshot])

  return { samples, record, recordDistribution }
}
