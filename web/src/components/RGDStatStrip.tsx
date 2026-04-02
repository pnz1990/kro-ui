// RGDStatStrip.tsx — Compact stat strip for the RGD detail page header.
//
// Mirrors the TelemetryPanel layout (AGE / RESOURCES / INSTANCES / REVISIONS)
// so the RGD detail page feels visually consistent with the instance detail page.
// All data is derived from props — no API calls are made by this component.

import { useState, useEffect } from 'react'
import type { K8sObject } from '@/lib/api'
import { formatAge, extractResourceCount, extractCreationTimestamp } from '@/lib/format'
import './RGDStatStrip.css'

// ── Props ─────────────────────────────────────────────────────────────────

export interface RGDStatStripProps {
  /** The RGD object — source of age, resource count, and lastIssuedRevision. */
  rgd: K8sObject
  /**
   * Total number of instances across all namespaces.
   * Pass `null` while loading, `undefined` if fetch failed.
   */
  instanceCount: number | null | undefined
  /** Whether kro v0.9.0+ GraphRevision feature is supported by this cluster. */
  hasRevisions?: boolean
}

// ── StatCell sub-component ─────────────────────────────────────────────

interface StatCellProps {
  label: string
  value: string
  colorModifier?: 'alive' | 'muted'
  testId?: string
  title?: string
}

function StatCell({ label, value, colorModifier, testId, title }: StatCellProps) {
  const valueClass = colorModifier
    ? `rgd-stat-strip__value rgd-stat-strip__value--${colorModifier}`
    : 'rgd-stat-strip__value'

  return (
    <div className="rgd-stat-strip__cell" data-testid={testId ?? 'rgd-stat-cell'} title={title}>
      <span className={valueClass}>{value}</span>
      <span className="rgd-stat-strip__label">{label}</span>
    </div>
  )
}

// ── RGDStatStrip ──────────────────────────────────────────────────────────

/**
 * RGDStatStrip — 4-cell horizontal strip for the RGD detail header.
 *
 * Cells:
 *  1. Age       — time since creationTimestamp (ticks every second)
 *  2. Resources — number of managed resource nodes in the RGD spec
 *  3. Instances — total CR instance count (null while loading)
 *  4. Revisions — lastIssuedRevision from status (kro v0.9.0+); "—" on older clusters
 */
export default function RGDStatStrip({ rgd, instanceCount, hasRevisions }: RGDStatStripProps) {
  // 1s ticker so Age cell stays current between re-renders.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Age ───────────────────────────────────────────────────────────────
  const createdAt = extractCreationTimestamp(rgd)
  const age = createdAt ? formatAge(createdAt) : '—'

  // ── Resources ─────────────────────────────────────────────────────────
  const resourceCount = extractResourceCount(rgd)

  // ── Instances ─────────────────────────────────────────────────────────
  const instanceValue =
    instanceCount === null ? '…' :
    instanceCount === undefined ? '—' :
    String(instanceCount)
  const instanceColor: StatCellProps['colorModifier'] =
    instanceCount === null || instanceCount === undefined ? 'muted' :
    instanceCount > 0 ? 'alive' : 'muted'

  // ── Revisions ─────────────────────────────────────────────────────────
  // kro v0.9.0 does not have status.lastIssuedRevision — the revision number
  // is embedded in the GraphRevisionsResolved condition message:
  //   "revision N compiled and active"
  // Fall back to status.lastIssuedRevision for forward compatibility.
  const conditions = (rgd.status as Record<string, unknown> | undefined)?.conditions
  const grCondition = Array.isArray(conditions)
    ? (conditions as Array<Record<string, unknown>>).find((c) => c.type === 'GraphRevisionsResolved')
    : undefined
  const grMessage = typeof grCondition?.message === 'string' ? grCondition.message : ''
  const revFromCondition = grCondition?.status === 'True'
    ? (grMessage.match(/^revision\s+(\d+)/i)?.[1] ?? null)
    : null
  const rawRevision = (rgd.status as Record<string, unknown> | undefined)?.lastIssuedRevision
  const revFromStatus = typeof rawRevision === 'number' && rawRevision > 0 ? String(rawRevision) : null
  const lastRevisionStr = revFromCondition ?? revFromStatus

  const revisionValue = lastRevisionStr !== null ? `#${lastRevisionStr}` : (hasRevisions ? '—' : '—')
  const revisionColor: StatCellProps['colorModifier'] = lastRevisionStr !== null ? 'alive' : 'muted'
  const revisionTitle = lastRevisionStr !== null
    ? `Graph revision ${lastRevisionStr} — ${grMessage || `status.lastIssuedRevision: ${lastRevisionStr}`}`
    : hasRevisions
      ? 'No revision issued yet'
      : 'GraphRevision requires kro v0.9.0+'

  return (
    <div
      className="rgd-stat-strip"
      data-testid="rgd-stat-strip"
      role="status"
      aria-label="RGD statistics"
    >
      <StatCell
        label="Age"
        value={age}
        testId="rgd-stat-age"
        title="Time since this RGD was created (metadata.creationTimestamp)"
      />
      <StatCell
        label="Resources"
        value={String(resourceCount)}
        testId="rgd-stat-resources"
        title={`${resourceCount} managed resource node${resourceCount === 1 ? '' : 's'} defined in spec.resources`}
      />
      <StatCell
        label="Instances"
        value={instanceValue}
        colorModifier={instanceColor}
        testId="rgd-stat-instances"
        title="Total CR instances across all namespaces"
      />
      <StatCell
        label="Latest revision"
        value={revisionValue}
        colorModifier={revisionColor}
        testId="rgd-stat-revision"
        title={revisionTitle}
      />
    </div>
  )
}
