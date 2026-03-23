// SpecPanel.tsx — Dynamic key-value rendering of spec.* fields.
//
// No hardcoded field list (FR-009 / spec US3).
// Updates on every successful poll cycle via props.
// Issue #122: empty-string values render as em-dash (§XII graceful degradation).

import type { K8sObject } from '@/lib/api'
import './SpecPanel.css'

interface SpecPanelProps {
  instance: K8sObject
}

function extractSpecFields(instance: K8sObject): Array<{ key: string; value: string; isEmpty: boolean }> {
  const spec = instance.spec as Record<string, unknown> | undefined
  if (!spec) return []
  return Object.entries(spec).map(([key, value]) => {
    if (value === null || value === undefined) {
      return { key, value: '—', isEmpty: true }
    }
    if (typeof value === 'object') {
      return { key, value: JSON.stringify(value), isEmpty: false }
    }
    const str = String(value)
    return { key, value: str === '' ? '—' : str, isEmpty: str === '' }
  })
}

/**
 * SpecPanel — renders all spec.* fields dynamically.
 *
 * Spec: .specify/specs/005-instance-detail-live/ US3
 */
export default function SpecPanel({ instance }: SpecPanelProps) {
  const fields = extractSpecFields(instance)

  return (
    <div data-testid="spec-panel" className="spec-panel">
      <div className="panel-heading">Spec</div>
      {fields.length === 0 ? (
        <div className="panel-empty">No spec fields.</div>
      ) : (
        <table className="spec-table">
          <tbody>
            {fields.map(({ key, value, isEmpty }) => (
              <tr key={key} className="spec-row">
                <td className="spec-key">{key}</td>
                <td className={`spec-value${isEmpty ? ' spec-value--empty' : ''}`}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
