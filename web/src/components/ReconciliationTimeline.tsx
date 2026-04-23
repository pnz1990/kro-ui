// Copyright 2026 The Kubernetes Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// you may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// ReconciliationTimeline.tsx — Per-instance state transition timeline.
//
// Renders the last ≤10 condition lastTransitionTime events as a vertical
// timeline, newest first. Each entry shows: the condition type, a state
// label (Ready / Reconciling / Error / Unknown), absolute timestamp, and
// relative age via formatAge().
//
// Data source: instance.status.conditions — no new backend required.
// Spec: .specify/specs/issue-764/ O1–O7
// Design doc: docs/design/29-instance-management.md §29.1

import type { K8sObject } from '@/lib/api'
import { isHealthyCondition } from '@/lib/conditions'
import { formatAge } from '@/lib/format'
import './ReconciliationTimeline.css'

interface K8sCondition {
  type: string
  status: string
  reason?: string
  lastTransitionTime?: string
}

/** A single timeline entry derived from a condition transition. */
interface TimelineEntry {
  conditionType: string
  status: string
  reason?: string
  lastTransitionTime: string
}

/** Map condition type + status to a human-readable state label. */
function stateLabel(type: string, status: string): string {
  if (isHealthyCondition(type, status)) return 'Ready'
  if (status === 'Unknown') return 'Unknown'
  // For kro-specific conditions, preserve the type name for specificity
  if (type === 'Ready') return 'Not Ready'
  return type
}

/** CSS modifier class for the timeline dot, keyed by health. */
function dotModifier(type: string, status: string): string {
  if (isHealthyCondition(type, status)) return 'timeline-dot--ready'
  if (status === 'Unknown') return 'timeline-dot--unknown'
  return 'timeline-dot--error'
}

/** Format an ISO timestamp as a human-readable absolute date. */
function formatAbsolute(ts: string): string {
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

/** Extract and sort the last ≤10 transitions from instance conditions. */
export function extractTimelineEntries(instance: K8sObject): TimelineEntry[] {
  const status = instance.status as Record<string, unknown> | undefined
  if (!status) return []
  const conditions = status.conditions
  if (!Array.isArray(conditions)) return []

  const entries: TimelineEntry[] = (conditions as K8sCondition[])
    .filter((c) => !!c.lastTransitionTime)
    .map((c) => ({
      conditionType: c.type,
      status: c.status,
      reason: c.reason,
      lastTransitionTime: c.lastTransitionTime as string,
    }))

  // Sort newest-first
  entries.sort(
    (a, b) =>
      new Date(b.lastTransitionTime).getTime() - new Date(a.lastTransitionTime).getTime(),
  )

  // Cap at 10 entries
  return entries.slice(0, 10)
}

interface ReconciliationTimelineProps {
  instance: K8sObject
}

/**
 * ReconciliationTimeline — shows the last ≤10 condition state transitions.
 *
 * Returns null when fewer than 2 conditions have a lastTransitionTime
 * (insufficient data to show a meaningful timeline).
 *
 * Spec O1–O7: .specify/specs/issue-764/spec.md
 */
export default function ReconciliationTimeline({ instance }: ReconciliationTimelineProps) {
  const entries = extractTimelineEntries(instance)

  // O5: hide when insufficient data
  if (entries.length < 2) return null

  return (
    <div className="reconciliation-timeline" data-testid="reconciliation-timeline">
      <div className="timeline-header">State transition history</div>
      <ol className="timeline-list" aria-label="State transition history">
        {entries.map((entry, i) => (
          <li key={`${entry.conditionType}-${entry.lastTransitionTime}`} className="timeline-entry">
            <span
              className={`timeline-dot ${dotModifier(entry.conditionType, entry.status)}`}
              aria-hidden="true"
            />
            {i < entries.length - 1 && (
              <span className="timeline-connector" aria-hidden="true" />
            )}
            <div className="timeline-entry-body">
              <span className={`timeline-state-label timeline-state-label--${dotModifier(entry.conditionType, entry.status).replace('timeline-dot--', '')}`}>
                {stateLabel(entry.conditionType, entry.status)}
              </span>
              <span className="timeline-condition-type">{entry.conditionType}</span>
              {entry.reason && (
                <span className="timeline-reason">{entry.reason}</span>
              )}
              <span className="timeline-time" title={entry.lastTransitionTime}>
                {formatAbsolute(entry.lastTransitionTime)}
                {' '}
                <span className="timeline-age">({formatAge(entry.lastTransitionTime)} ago)</span>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
