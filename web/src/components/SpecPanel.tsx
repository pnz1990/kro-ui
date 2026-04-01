// SpecPanel.tsx — Dynamic key-value rendering of spec.* fields.
//
// No hardcoded field list (FR-009 / spec US3).
// Updates on every successful poll cycle via props.
// Issue #122: empty-string values render as em-dash (§XII graceful degradation).
// GH #401: nested objects rendered as YAML (not JSON.stringify) via toYaml.

import type { K8sObject } from '@/lib/api'
import { Link } from 'react-router-dom'
import { toYaml } from '@/lib/yaml'
import './SpecPanel.css'

interface SpecPanelProps {
  instance: K8sObject
}

function extractSpecFields(instance: K8sObject): Array<{ key: string; value: string; isEmpty: boolean; isMultiline: boolean }> {
  const spec = instance.spec as Record<string, unknown> | undefined
  if (!spec) return []
  return Object.entries(spec).map(([key, value]) => {
    if (value === null || value === undefined) {
      return { key, value: '—', isEmpty: true, isMultiline: false }
    }
    if (typeof value === 'object') {
      // GH #401: render objects/arrays as YAML, not compact JSON.
      const yamlStr = toYaml(value).trimEnd()
      return { key, value: yamlStr, isEmpty: false, isMultiline: yamlStr.includes('\n') }
    }
    const str = String(value)
    return { key, value: str === '' ? '—' : str, isEmpty: str === '', isMultiline: false }
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
        <div className="panel-empty">
          No spec fields defined. Check the RGD&apos;s{' '}
          <Link to="?tab=docs">Docs tab</Link>{' '}
          to see the schema.
        </div>
      ) : (
        <table className="spec-table">
          <tbody>
            {fields.map(({ key, value, isEmpty, isMultiline }) => (
              <tr key={key} className="spec-row">
                <td className="spec-key">{key}</td>
                <td className={`spec-value${isEmpty ? ' spec-value--empty' : ''}${isMultiline ? ' spec-value--yaml' : ''}`}>
                  {isMultiline ? <pre className="spec-value-pre">{value}</pre> : value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
