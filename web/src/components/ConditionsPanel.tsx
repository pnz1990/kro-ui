// ConditionsPanel.tsx — Table of Kubernetes conditions for an instance.
//
// Renders type, status, reason, message, last transition time.
// Updates on every poll cycle via props.
//
// spec 028: "Not reported" empty state, summary header, absent-field omission.
//
// Issue #159: ReconciliationSuspended=False is healthy (Kubernetes inversion convention).
// isHealthyCondition() lives in @/lib/conditions and is reused here and in ErrorsTab.

import type { K8sObject } from '@/lib/api'
import { isHealthyCondition } from '@/lib/conditions'
import './ConditionsPanel.css'

interface ConditionsPanelProps {
  instance: K8sObject
}

interface K8sCondition {
  type: string
  status: string
  reason?: string
  message?: string
  lastTransitionTime?: string
}

function extractConditions(instance: K8sObject): K8sCondition[] {
  const status = instance.status as Record<string, unknown> | undefined
  if (!status) return []
  const conditions = status.conditions
  if (!Array.isArray(conditions)) return []
  return conditions as K8sCondition[]
}

function formatTime(ts: string | undefined): string {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ts
  }
}

function statusClass(type: string, status: string): string {
  if (isHealthyCondition(type, status)) return 'condition-status--true'
  if (status === 'Unknown') return 'condition-status--unknown'
  return 'condition-status--false'
}

/**
 * ConditionsPanel — renders all status.conditions fields.
 *
 * Empty state: "Not reported" (constitution §XII — absent data is "not reported",
 * never "No conditions." which implies the data was checked and found empty).
 *
 * Summary header: "{trueCount} / {total} conditions healthy"
 *
 * Absent optional fields (reason, message, lastTransitionTime) are omitted
 * entirely — never rendered as empty strings, undefined, or placeholders.
 *
 * Spec: .specify/specs/028-instance-health-rollup/ US4 FR-009, FR-010
 */
export default function ConditionsPanel({ instance }: ConditionsPanelProps) {
  const conditions = extractConditions(instance)

  if (conditions.length === 0) {
    return (
      <div data-testid="conditions-panel" className="conditions-panel">
        <div className="panel-heading">Conditions</div>
        <div data-testid="conditions-panel-empty" className="panel-empty">Not reported</div>
      </div>
    )
  }

  const trueCount = conditions.filter((c) => isHealthyCondition(c.type, c.status)).length

  return (
    <div data-testid="conditions-panel" className="conditions-panel">
      <div className="panel-heading">Conditions</div>
      <div className="conditions-summary">
        {trueCount} / {conditions.length} conditions healthy
      </div>
      <div className="conditions-list">
        {conditions.map((c, i) => (
          <div key={`${c.type}-${i}`} className="condition-row">
            <div className="condition-header">
              <span className="condition-type">{c.type}</span>
              <span className={`condition-status ${statusClass(c.type, c.status)}`}>
                {c.status}
              </span>
              {c.reason && c.reason !== '' && (
                <span className="condition-reason">{c.reason}</span>
              )}
            </div>
            {c.message && c.message !== '' && (
              <div className="condition-message">{c.message}</div>
            )}
            {c.lastTransitionTime && (
              <div className="condition-time">
                Last transition: {formatTime(c.lastTransitionTime)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
