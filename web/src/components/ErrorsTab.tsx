// ErrorsTab.tsx — Errors tab for the RGD detail page.
//
// Fetches all instances of the RGD, groups status.conditions entries where
// status=False by (conditionType, reason), and presents them sorted worst-first
// (highest affected instance count first). Each group shows a human-readable
// rewrite when available, with a "Show raw error" toggle for the original
// Go controller message.
//
// Spec: .specify/specs/030-error-patterns-tab/
//
// Issue #159: conditions where False is the healthy value (e.g. ReconciliationSuspended)
// are excluded from error aggregation — they represent active/healthy state, not failure.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listInstances } from '@/lib/api'
import type { K8sObject } from '@/lib/api'
import { rewriteConditionMessage, isHealthyCondition } from '@/lib/conditions'
import { translateApiError } from '@/lib/errors'
import './ErrorsTab.css'

// ── Internal types ────────────────────────────────────────────────────────

interface K8sCondition {
  type?: string
  status?: string           // "True" | "False" | "Unknown"
  reason?: string
  message?: string
  lastTransitionTime?: string
}

interface InstanceRef {
  name: string
  namespace: string
  lastTransitionTime?: string
}

interface ErrorGroup {
  conditionType: string
  reason: string             // "" when absent from condition
  message: string            // canonical message (latest lastTransitionTime)
  count: number
  instances: InstanceRef[]   // full list, sorted name asc
}

// ── Pure aggregation function ─────────────────────────────────────────────

/**
 * groupErrorPatterns — aggregate instances into error groups.
 *
 * Groups failing conditions (status=False) by (conditionType, reason).
 * Sort order: count desc → conditionType asc → reason asc.
 * Instances within each group: name asc → namespace asc.
 *
 * Graceful degradation per constitution §XII:
 *   - Instances with absent metadata.name or metadata.namespace are skipped.
 *   - Conditions with absent type are skipped.
 *   - Absent status.conditions arrays are treated as [].
 *   - Absent message renders as "(no message)".
 */
export function groupErrorPatterns(instances: K8sObject[]): ErrorGroup[] {
  // Map<groupKey, { group, canonicalTime }>
  const acc = new Map<string, { group: ErrorGroup; canonicalTime: string }>()

  for (const instance of instances) {
    const meta = instance.metadata as Record<string, unknown> | undefined
    const name = typeof meta?.name === 'string' ? meta.name : ''
    const namespace = typeof meta?.namespace === 'string' ? meta.namespace : ''
    if (!name || !namespace) continue

    const status = instance.status as Record<string, unknown> | undefined
    const rawConditions = status?.conditions
    if (!Array.isArray(rawConditions)) continue

    for (const raw of rawConditions) {
      const c = raw as K8sCondition
      if (!c.type) continue
      // Issue #159: only aggregate conditions that are genuinely unhealthy.
      // isHealthyCondition correctly handles inverted conditions like
      // ReconciliationSuspended where False=healthy and True=problem.
      // Skip any condition that is in its healthy state.
      if (isHealthyCondition(c.type, c.status ?? '')) continue

      const key = c.type + '/' + (c.reason ?? '')
      const ref: InstanceRef = {
        name,
        namespace,
        lastTransitionTime: c.lastTransitionTime,
      }

      if (!acc.has(key)) {
        acc.set(key, {
          group: {
            conditionType: c.type,
            reason: c.reason ?? '',
            message: c.message ?? '(no message)',
            count: 0,
            instances: [],
          },
          canonicalTime: c.lastTransitionTime ?? '',
        })
      }

      const entry = acc.get(key)!
      entry.group.count++
      entry.group.instances.push(ref)

      // Track canonical message: use the message from the most recent condition.
      const t = c.lastTransitionTime ?? ''
      if (t > entry.canonicalTime) {
        entry.canonicalTime = t
        entry.group.message = c.message ?? '(no message)'
      }
    }
  }

  const groups = Array.from(acc.values()).map((e) => e.group)

  // Sort instances within each group: name asc, namespace asc
  for (const g of groups) {
    g.instances.sort((a, b) =>
      a.name !== b.name ? a.name.localeCompare(b.name) : a.namespace.localeCompare(b.namespace),
    )
  }

  // Sort groups: count desc → conditionType asc → reason asc
  groups.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    if (a.conditionType !== b.conditionType) return a.conditionType.localeCompare(b.conditionType)
    return a.reason.localeCompare(b.reason)
  })

  return groups
}

// ── Component ─────────────────────────────────────────────────────────────

const MAX_VISIBLE_INSTANCES = 10

interface ErrorsTabProps {
  /** RGD name from URL params — used to fetch instances. */
  rgdName: string
  /** Optional namespace filter from ?namespace= URL query param. */
  namespace?: string
}

/**
 * ErrorsTab — aggregates instance-level error signals for all instances of
 * the RGD and presents them grouped by error pattern.
 *
 * Spec: .specify/specs/030-error-patterns-tab/
 */
export default function ErrorsTab({ rgdName, namespace }: ErrorsTabProps) {
  const [instances, setInstances] = useState<K8sObject[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Per-group UI toggles: expanded = show all instances; rawGroups = show raw error message
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [rawGroups, setRawGroups] = useState<Set<string>>(new Set())

  // ── Data fetch ───────────────────────────────────────────────────────────

  const fetchInstances = useCallback(() => {
    setLoading(true)
    setError(null)
    listInstances(rgdName, namespace)
      .then((data) => {
        setInstances(data.items ?? [])
        setError(null)
      })
      .catch((err: Error) => {
        setError(err.message)
        setInstances(null)
      })
      .finally(() => setLoading(false))
  }, [rgdName, namespace])

  useEffect(() => {
    fetchInstances()
  }, [fetchInstances])

  // ── Aggregation ──────────────────────────────────────────────────────────

  const groups = useMemo(
    () => groupErrorPatterns(instances ?? []),
    [instances],
  )

  // ── Toggle helpers ───────────────────────────────────────────────────────

  function toggleExpanded(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function setRaw(key: string, raw: boolean) {
    setRawGroups((prev) => {
      const next = new Set(prev)
      if (raw) next.add(key)
      else next.delete(key)
      return next
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  // Count unique affected instances across all groups.
  // groups.reduce((s, g) => s + g.count) would double-count instances that
  // have multiple failing conditions (e.g. both Ready=False and ResourcesReady=False).
  const affectedSet = new Set<string>()
  for (const g of groups) {
    for (const inst of g.instances) {
      affectedSet.add(`${inst.namespace}/${inst.name}`)
    }
  }
  const totalAffected = affectedSet.size

  return (
    <div className="errors-tab" data-testid="errors-tab">

      {/* Loading */}
      {loading && (
        <div className="errors-tab__loading" data-testid="errors-loading">
          Loading instances…
        </div>
      )}

      {/* API error */}
      {!loading && error && (
        <div className="errors-tab__api-error" role="alert" data-testid="errors-api-error">
          <span className="errors-tab__api-error-msg">
            {translateApiError(error, { tab: 'validation' })}
          </span>
          <button
            type="button"
            className="errors-tab__retry-btn"
            data-testid="errors-retry-btn"
            onClick={fetchInstances}
          >
            Retry
          </button>
        </div>
      )}

      {/* No instances yet */}
      {!loading && !error && instances !== null && instances.length === 0 && (
        <div className="errors-tab__empty" data-testid="errors-empty">
          No instances yet. Create one with <code>kubectl apply</code> or use the{' '}
          <Link to={{ search: '?tab=generate' }}>Generate tab</Link>.
        </div>
      )}

      {/* All healthy */}
      {!loading && !error && instances !== null && instances.length > 0 && groups.length === 0 && (
        <div className="errors-tab__all-healthy" data-testid="errors-all-healthy">
          <span
            className="errors-tab__healthy-icon"
            aria-label="All instances healthy"
            aria-hidden="false"
          >
            ✓
          </span>
          All instances are healthy
        </div>
      )}

      {/* Error groups */}
      {!loading && !error && groups.length > 0 && (
        <>
          {/* Summary */}
          <div
            className="errors-tab__summary"
            title="Error patterns are grouped by condition type and reason across all instances. Counts reflect the state at the last fetch."
          >
            {groups.length} error {groups.length === 1 ? 'pattern' : 'patterns'} across{' '}
            {totalAffected} {totalAffected === 1 ? 'instance' : 'instances'}
          </div>

          <div className="errors-tab__groups">
            {groups.map((group) => {
              const key = group.conditionType + '/' + group.reason
              const isExpanded = expandedGroups.has(key)
              const showRaw = rawGroups.has(key)
              const rewritten = rewriteConditionMessage(group.reason || undefined, group.message)
              const displayAsRewritten = rewritten !== null && !showRaw
              const visibleInstances = isExpanded
                ? group.instances
                : group.instances.slice(0, MAX_VISIBLE_INSTANCES)
              const overflow = group.instances.length - MAX_VISIBLE_INSTANCES

              return (
                <div key={key} className="error-group" data-testid="error-group">
                  {/* Header */}
                  <div className="error-group__header" data-testid="error-group-header">
                    <span className="error-group__type">{group.conditionType}</span>
                    {group.reason && (
                      <>
                        <span className="error-group__separator" aria-hidden="true">/</span>
                        <span className="error-group__reason">{group.reason}</span>
                      </>
                    )}
                    <span className="error-group__count" data-testid="error-group-count">
                      {group.count} {group.count === 1 ? 'instance' : 'instances'}
                    </span>
                  </div>

                  {/* Message */}
                  <div className="error-group__message" data-testid="error-group-message">
                    {displayAsRewritten ? (
                      <>
                        <p className="error-group__message--rewritten">{rewritten}</p>
                        <button
                          type="button"
                          className="error-group__toggle"
                          data-testid="error-group-toggle-raw"
                          onClick={() => setRaw(key, true)}
                        >
                          Show raw error
                        </button>
                      </>
                    ) : (
                      <>
                        <pre className="error-group__message--raw">{group.message}</pre>
                        {rewritten !== null && (
                          <button
                            type="button"
                            className="error-group__toggle"
                            data-testid="error-group-toggle-summary"
                            onClick={() => setRaw(key, false)}
                          >
                            Show summary
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Instance list */}
                  <ul className="error-group__instances">
                    {visibleInstances.map((inst) => (
                      <li key={`${inst.namespace}/${inst.name}`} className="error-group__instance-item">
                        <Link
                          to={`/rgds/${rgdName}/instances/${inst.namespace}/${inst.name}`}
                          className="error-group__instance-link"
                          data-testid="error-instance-link"
                        >
                          {inst.name} ({inst.namespace})
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {/* Overflow */}
                  {!isExpanded && overflow > 0 && (
                    <div className="error-group__overflow" data-testid="error-group-overflow">
                      and {overflow} more{' '}
                      <button
                        type="button"
                        className="error-group__show-more-btn"
                        onClick={() => toggleExpanded(key)}
                      >
                        Show all
                      </button>
                    </div>
                  )}
                  {isExpanded && overflow > 0 && (
                    <div className="error-group__overflow">
                      <button
                        type="button"
                        className="error-group__show-more-btn"
                        onClick={() => toggleExpanded(key)}
                      >
                        Show less
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
