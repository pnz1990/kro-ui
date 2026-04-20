// Copyright 2026 The Kubernetes Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// ConditionsPanel.tsx — Collapsible condition drill-down for Kubernetes conditions.
//
// Each condition row is collapsed by default (type + status badge only).
// Unhealthy conditions (non-healthy status) are auto-expanded on mount so operators
// see error details without a click.
// Clicking a row header expands/collapses the full detail: message, reason,
// lastTransitionTime.
//
// spec pr-565: condition detail drill-down (🔲 → ✅)
// spec 028: "Not reported" empty state, summary header, absent-field omission.
// spec 028 US5: negation-polarity conditions counted correctly via isHealthyCondition.
//
// Issue #159: ReconciliationSuspended=False is healthy (Kubernetes inversion convention).
// isHealthyCondition() lives in @/lib/conditions and is reused here and in ErrorsTab.

import { useState, useCallback } from 'react'
import type { K8sObject } from '@/lib/api'
import { isHealthyCondition, conditionStatusLabel } from '@/lib/conditions'
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

/** Returns true when a condition's detail section has any content to show. */
function hasDetail(c: K8sCondition): boolean {
  return !!(c.message || c.reason || c.lastTransitionTime)
}

/**
 * ConditionsPanel — renders all status.conditions fields with expand/collapse drill-down.
 *
 * Collapsed view (default): condition type + status badge only.
 * Expanded view (click to toggle): adds message, reason, lastTransitionTime.
 * Unhealthy conditions auto-expand on mount so errors are immediately visible.
 *
 * Empty state: "Not reported" (constitution §XII — absent data is "not reported",
 * never "No conditions." which implies the data was checked and found empty).
 *
 * Summary header: "{trueCount} / {total} conditions healthy"
 *
 * Absent optional fields (reason, message, lastTransitionTime) are omitted
 * entirely — never rendered as empty strings, undefined, or placeholders.
 *
 * Spec: .specify/specs/pr-565/ O1-O8
 * Spec: .specify/specs/028-instance-health-rollup/ US4 FR-009, FR-010
 */
export default function ConditionsPanel({ instance }: ConditionsPanelProps) {
  const conditions = extractConditions(instance)

  // Initialize: unhealthy conditions are expanded by default (spec O4).
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const c of conditions) {
      if (!isHealthyCondition(c.type, c.status) && hasDetail(c)) {
        initial.add(c.type)
      }
    }
    return initial
  })

  const toggle = useCallback((type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

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
      <div
        data-testid="conditions-summary"
        className="conditions-summary"
        title="A condition is 'healthy' when it is in its expected positive state. For most conditions True=healthy; for ReconciliationSuspended, False=healthy."
      >
        {trueCount} / {conditions.length} conditions healthy
      </div>
      <div className="conditions-list">
        {conditions.map((c, i) => {
          const expanded = expandedTypes.has(c.type)
          const expandable = hasDetail(c)
          const sClass = statusClass(c.type, c.status)

          return (
            <div
              key={`${c.type}-${i}`}
              data-testid={`condition-row-${c.type}`}
              className={`condition-row${expanded ? ' condition-row--expanded' : ''}`}
            >
              {/* Header row — always visible; click to expand if detail exists */}
              <div
                className={`condition-header${expandable ? ' condition-header--clickable' : ''}`}
                role={expandable ? 'button' : undefined}
                tabIndex={expandable ? 0 : undefined}
                aria-expanded={expandable ? expanded : undefined}
                onClick={expandable ? () => toggle(c.type) : undefined}
                onKeyDown={expandable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle(c.type)
                  }
                } : undefined}
              >
                {expandable && (
                  <span
                    className={`condition-chevron${expanded ? ' condition-chevron--open' : ''}`}
                    aria-hidden="true"
                  >
                    ▶
                  </span>
                )}
                <span className="condition-type">{c.type}</span>
                <span className={`condition-status ${sClass}`}>
                  {conditionStatusLabel(c.type, c.status)}
                </span>
                {/* Reason shown inline in collapsed state for quick scan */}
                {!expanded && c.reason && c.reason !== '' && (
                  <span className="condition-reason condition-reason--inline">{c.reason}</span>
                )}
              </div>

              {/* Detail section — visible only when expanded */}
              {expanded && (
                <div
                  data-testid={`condition-row-${c.type}-detail`}
                  className="condition-detail"
                >
                  {c.reason && c.reason !== '' && (
                    <div className="condition-detail-row">
                      <span className="condition-detail-label">Reason</span>
                      <span className="condition-reason">{c.reason}</span>
                    </div>
                  )}
                  {c.message && c.message !== '' && (
                    <div className="condition-detail-row">
                      <span className="condition-detail-label">Message</span>
                      <span className="condition-message">{c.message}</span>
                    </div>
                  )}
                  {c.lastTransitionTime && (
                    <div className="condition-detail-row">
                      <span className="condition-detail-label">Last transition</span>
                      <span className="condition-time">{formatTime(c.lastTransitionTime)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
