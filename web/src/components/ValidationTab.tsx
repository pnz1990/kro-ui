// ValidationTab.tsx — Validation checklist + resource summary tab for RGDDetail.
//
// Reads status.conditions from the already-loaded RGD object (no API call).
// Displays known conditions with status icons and renders a resource summary
// computed client-side from spec.resources.
//
// Spec: .specify/specs/017-rgd-validation-linting/

import type { K8sObject } from '@/lib/api'
import ConditionItem from './ConditionItem'
import type { RGDCondition } from './ConditionItem'
import ResourceSummary from './ResourceSummary'
import './ValidationTab.css'

/** The four condition types kro sets on every RGD, in display order. */
const KNOWN_CONDITION_TYPES: ReadonlyArray<{ type: string; label: string }> = [
  { type: 'GraphVerified',                    label: 'Graph Verified' },
  { type: 'TopologyReady',                    label: 'Topology Ready' },
  { type: 'CustomResourceDefinitionSynced',   label: 'CRD Synced' },
  { type: 'Ready',                            label: 'Ready' },
]

/** Friendly label for a condition type. Unknown types use the raw type value. */
function conditionLabel(type: string): string {
  return KNOWN_CONDITION_TYPES.find((k) => k.type === type)?.label ?? type
}

function extractConditions(rgd: K8sObject): RGDCondition[] {
  const status = rgd.status as Record<string, unknown> | undefined
  if (!status) return []
  const conditions = status.conditions
  if (!Array.isArray(conditions)) return []
  // Cast to RGDCondition — fields are validated by ConditionItem at render time
  return conditions as RGDCondition[]
}

/**
 * Build the display list:
 *   - Known condition types are shown in fixed order.
 *     - If present in actual conditions: show with real status.
 *     - If absent: show as "Not reported" (neutral) — not "Pending".
 *       Absent means this kro version simply doesn't emit the condition;
 *       it does NOT mean the controller is stuck. See: #59
 *   - Unknown condition types (future kro versions) are appended at the end.
 */
function buildDisplayConditions(
  conditions: RGDCondition[],
): Array<{ condition: RGDCondition; label: string; isAbsent: boolean }> {
  const byType = new Map<string, RGDCondition>()
  for (const c of conditions) {
    if (c.type) byType.set(c.type, c)
  }

  const result: Array<{ condition: RGDCondition; label: string; isAbsent: boolean }> = []

  // Known types first, in order
  for (const { type, label } of KNOWN_CONDITION_TYPES) {
    const c = byType.get(type)
    if (c) {
      result.push({ condition: c, label, isAbsent: false })
    } else {
      // Condition absent from status.conditions — show as "Not reported"
      result.push({ condition: { type, status: 'Unknown' }, label, isAbsent: true })
    }
  }

  // Append any unknown types that are present in the actual conditions
  for (const c of conditions) {
    const isKnown = KNOWN_CONDITION_TYPES.some((k) => k.type === c.type)
    if (!isKnown) {
      result.push({ condition: c, label: conditionLabel(c.type), isAbsent: false })
    }
  }

  return result
}

interface ValidationTabProps {
  /** The already-loaded RGD object. */
  rgd: K8sObject
}

/**
 * ValidationTab — shows the RGD validation checklist and resource summary.
 *
 * Spec: .specify/specs/017-rgd-validation-linting/
 */
export default function ValidationTab({ rgd }: ValidationTabProps) {
  const conditions = extractConditions(rgd)
  const displayConditions = buildDisplayConditions(conditions)
  const spec = rgd.spec as Record<string, unknown> | undefined

  return (
    <div className="validation-tab" data-testid="validation-tab">
      {/* ── Validation Checklist ──────────────────────────────────────── */}
      <section className="validation-tab__section">
        <h2 className="validation-tab__section-title">Validation Conditions</h2>
        <div className="validation-tab__checklist">
          {displayConditions.map(({ condition, label, isAbsent }) => (
            <ConditionItem
              key={condition.type}
              condition={condition}
              label={label}
              isAbsent={isAbsent}
            />
          ))}
        </div>
      </section>

      {/* ── Resource Summary ─────────────────────────────────────────── */}
      {spec && (
        <section className="validation-tab__section">
          <ResourceSummary spec={spec} />
        </section>
      )}
    </div>
  )
}
