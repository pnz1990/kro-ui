// Capabilities detection + stale-while-revalidate hook.
// Module-level cache: all useCapabilities() consumers share one fetch.
//
// Spec ref: 008-feature-flags
// Constitution ref: §V (no state management libraries)

import { useState, useEffect } from 'react'
import { getCapabilities, type KroCapabilities } from './api'

// ── Conservative baseline (FR-007) ──────────────────────────────────

export type { KroCapabilities }

export const BASELINE: KroCapabilities = {
  version: 'unknown',
  apiVersion: 'kro.run/v1alpha1',
  featureGates: {
    CELOmitFunction: false,
    InstanceConditionEvents: false,
  },
  knownResources: ['resourcegraphdefinitions'],
  schema: {
    hasForEach: true,
    hasExternalRef: true,
    hasExternalRefSelector: true,
    hasScope: false,
    hasTypes: false,
    hasGraphRevisions: false,
  },
}

// ── Experimental mode (FR-008) ──────────────────────────────────────

/** Returns true if ?experimental=true is in the URL. */
export function isExperimental(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('experimental') === 'true'
}

// ── Module-level cache ──────────────────────────────────────────────

const STALE_MS = 30_000

interface Cache {
  data: KroCapabilities
  fetchedAt: number
  inflight: Promise<void> | null
}

const cache: Cache = {
  data: BASELINE,
  fetchedAt: 0,
  inflight: null,
}

const subscribers = new Set<() => void>()

function notifySubscribers(): void {
  subscribers.forEach((cb) => cb())
}

async function fetchCapabilities(): Promise<void> {
  try {
    const data = await getCapabilities()
    cache.data = data
    cache.fetchedAt = Date.now()
  } catch (_) {
    // SWR: keep stale data on failure — baseline is used if no prior fetch succeeded.
    if (cache.fetchedAt === 0) {
      cache.data = BASELINE
      cache.fetchedAt = Date.now()
    }
  } finally {
    cache.inflight = null
  }
}

function revalidate(): void {
  if (cache.inflight) return
  cache.inflight = fetchCapabilities().then(notifySubscribers)
}

/** Reset the cache — call this when the user switches kubeconfig context. */
export function invalidateCapabilities(): void {
  cache.data = BASELINE
  cache.fetchedAt = 0
  cache.inflight = null
}

// ── Hook ────────────────────────────────────────────────────────────

export interface UseCapabilitiesResult {
  capabilities: KroCapabilities
  loading: boolean
}

/**
 * Stale-while-revalidate hook for kro capabilities.
 * Returns cached data immediately; triggers background refresh if >30s old.
 * All consumers share a single module-level cache — no duplicate fetches.
 */
export function useCapabilities(): UseCapabilitiesResult {
  const [, setRevision] = useState(0)
  const [loading, setLoading] = useState(cache.fetchedAt === 0)

  useEffect(() => {
    const bump = () => {
      setRevision((r) => r + 1)
      setLoading(false)
    }
    subscribers.add(bump)

    const age = Date.now() - cache.fetchedAt
    if (cache.fetchedAt === 0 || age > STALE_MS) {
      revalidate()
    }

    return () => {
      subscribers.delete(bump)
    }
  }, [])

  return {
    capabilities: cache.data,
    loading,
  }
}
