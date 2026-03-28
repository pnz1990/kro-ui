// TelemetryPanel.tsx — Compact telemetry strip for a kro CR instance.
//
// Renders 4 metric cells: Age, Time in state, Children health, Warning count.
// All data is derived from props — no API calls are made by this component.
// A 1s setInterval keeps Age and Time-in-state cells current between poll cycles.
//
// Implements spec 027-instance-telemetry-panel FR-001 through FR-010.

import { useState, useEffect } from 'react'
import type { K8sObject, K8sList } from '@/lib/api'
import type { NodeStateMap } from '@/lib/instanceNodeState'
import {
  extractInstanceAge,
  extractTimeInState,
  countHealthyChildren,
  countWarningEvents,
  countFailedConditions,
} from '@/lib/telemetry'
import './TelemetryPanel.css'

// ── Props ─────────────────────────────────────────────────────────────────

interface TelemetryPanelProps {
  /** The live CR instance — source of age and condition timing. */
  instance: K8sObject
  /** Pre-computed node state map — source of child health counts. */
  nodeStateMap: NodeStateMap
  /** Events for this instance — source of warning count. */
  events: K8sList
}

// ── MetricCell sub-component ─────────────────────────────────────────────

interface MetricCellProps {
  label: string
  value: string
  /** Optional CSS modifier class for the value element (e.g. 'alive', 'error'). */
  colorModifier?: 'alive' | 'error' | 'warning' | 'muted'
  testId?: string
  /** Optional tooltip surfaced on hover via the native title attribute. */
  title?: string
}

function MetricCell({ label, value, colorModifier, testId, title }: MetricCellProps) {
  const valueClass = colorModifier
    ? `telemetry-panel__value telemetry-panel__value--${colorModifier}`
    : 'telemetry-panel__value'

  return (
    <div className="telemetry-panel__cell" data-testid={testId ?? 'telemetry-cell'} title={title}>
      <span className={valueClass}>
        {value}
      </span>
      <span className="telemetry-panel__label">{label}</span>
    </div>
  )
}

// ── TelemetryPanel ────────────────────────────────────────────────────────

/**
 * TelemetryPanel — 4-cell horizontal strip showing instance health metrics.
 *
 * Cells:
 *  1. Age            — time since creationTimestamp (ticks every second)
 *  2. Time in state  — time since Ready condition last changed
 *  3. Children       — healthy/total child resources (color-coded)
 *  4. Warnings       — count of Warning-type events (color-coded)
 *
 * Route: rendered inside InstanceDetail.tsx below the banners, above the DAG.
 * Spec:  .specify/specs/027-instance-telemetry-panel/
 */
export default function TelemetryPanel({ instance, nodeStateMap, events }: TelemetryPanelProps) {
  // Ticker: forces a re-render every second so formatAge() stays current.
  // Same pattern as RefreshIndicator in InstanceDetail.tsx.
  // FR-007: 1s interval, cleared on unmount.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Derive metric values ──────────────────────────────────────────────
  const age = extractInstanceAge(instance)
  const timeInState = extractTimeInState(instance)
  const { healthy, total, hasError } = countHealthyChildren(nodeStateMap)
  const eventWarningCount = countWarningEvents(events)
  const conditionWarningCount = countFailedConditions(instance)
  // Total warnings = Kubernetes Warning events + non-healthy non-Ready conditions.
  // Conditions are a reliable indicator of persistent issues; events expire after ~1h.
  // Spec: .specify/specs/059-condition-warnings/spec.md
  const warningCount = eventWarningCount + conditionWarningCount

  // ── Children cell: value string, color modifier, and tooltip ────────────
  // FR-005: --color-error when any child errored; --color-alive when all
  // healthy and total > 0; --color-text-muted when total === 0.
  // FR-010: title attribute surfaces the data source (label-search count).
  const childrenValue = `${healthy}/${total}`
  const childrenColor: MetricCellProps['colorModifier'] =
    total === 0 ? 'muted' : hasError ? 'error' : 'alive'
  const childrenTitle = `${total} child Kubernetes object${total === 1 ? '' : 's'} found via kro.run/instance-name label`

  // ── Warnings cell: value string and color modifier ────────────────────
  // FR-006: --color-status-warning when count > 0; --color-text-muted when 0.
  const warningsColor: MetricCellProps['colorModifier'] =
    warningCount > 0 ? 'warning' : 'muted'

  return (
    <div
      data-testid="telemetry-panel"
      className="telemetry-panel"
      role="status"
      aria-label="Instance telemetry"
    >
      <MetricCell
        label="Age"
        value={age}
        title="Time since this instance was created (metadata.creationTimestamp)"
        testId="telemetry-cell-age"
      />
      <MetricCell
        label="Time in state"
        value={timeInState}
        title="Time since the Ready condition last changed status — how long this instance has been in its current state"
        testId="telemetry-cell-time-in-state"
      />
      <MetricCell
        label="Children"
        value={childrenValue}
        colorModifier={childrenColor}
        title={childrenTitle}
        testId="telemetry-cell-children"
      />
      <MetricCell
        label="Warnings"
        value={String(warningCount)}
        colorModifier={warningsColor}
        title={warningCount > 0
          ? [
              eventWarningCount > 0
                ? `${eventWarningCount} Warning-severity Kubernetes event${eventWarningCount === 1 ? '' : 's'} (expire after ~1 hour)`
                : '',
              conditionWarningCount > 0
                ? `${conditionWarningCount} non-healthy condition${conditionWarningCount === 1 ? '' : 's'} (excluding Ready)`
                : '',
            ].filter(Boolean).join(' + ')
          : 'No warnings — all conditions healthy and no Warning-severity Kubernetes events'}
        testId="telemetry-cell-warnings"
      />
    </div>
  )
}
