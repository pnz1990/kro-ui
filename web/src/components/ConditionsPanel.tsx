// ConditionsPanel.tsx — Table of Kubernetes conditions for an instance.
//
// Renders type, status, reason, message, last transition time.
// Updates on every poll cycle via props.

import type { K8sObject } from '@/lib/api'
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

function statusClass(status: string): string {
  switch (status) {
    case 'True':    return 'condition-status--true'
    case 'False':   return 'condition-status--false'
    default:        return 'condition-status--unknown'
  }
}

/**
 * ConditionsPanel — renders all status.conditions fields.
 *
 * Spec: .specify/specs/005-instance-detail-live/ US3 acceptance 2
 */
export default function ConditionsPanel({ instance }: ConditionsPanelProps) {
  const conditions = extractConditions(instance)

  return (
    <div data-testid="conditions-panel" className="conditions-panel">
      <div className="panel-heading">Conditions</div>
      {conditions.length === 0 ? (
        <div className="panel-empty">No conditions.</div>
      ) : (
        <div className="conditions-list">
          {conditions.map((c, i) => (
            <div key={`${c.type}-${i}`} className="condition-row">
              <div className="condition-header">
                <span className="condition-type">{c.type}</span>
                <span className={`condition-status ${statusClass(c.status)}`}>
                  {c.status}
                </span>
                {c.reason && (
                  <span className="condition-reason">{c.reason}</span>
                )}
              </div>
              {c.message && (
                <div className="condition-message">{c.message}</div>
              )}
              <div className="condition-time">
                Last transition: {formatTime(c.lastTransitionTime)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
