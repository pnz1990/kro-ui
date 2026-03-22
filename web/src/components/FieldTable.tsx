// FieldTable.tsx — Table of spec or status fields for the RGD Docs tab.
//
// Renders a table of ParsedField objects with columns appropriate to the
// variant: 'spec' shows field name, type, required/optional indicator, and
// default value; 'status' shows field name, inferred type, and CEL source
// expression via KroCodeBlock.
//
// Spec: .specify/specs/020-schema-doc-generator/

import KroCodeBlock from '@/components/KroCodeBlock'
import type { ParsedField } from '@/lib/schema'
import './FieldTable.css'

// ── Type display helpers ───────────────────────────────────────────────────

/**
 * Format a ParsedType into a human-readable display string.
 * E.g. array → "[]string", map → "map[string]string".
 */
function formatType(field: ParsedField): string {
  const pt = field.parsedType
  if (!pt) return field.inferredType ?? 'string'

  switch (pt.type) {
    case 'array':
      return pt.items ? `[]${pt.items}` : '[]'
    case 'map':
      return pt.key && pt.value ? `map[${pt.key}]${pt.value}` : 'map'
    default:
      return pt.type
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export interface FieldTableProps {
  fields: ParsedField[]
  /** 'spec' — configurable input fields; 'status' — CEL projection fields. */
  variant: 'spec' | 'status'
}

/**
 * FieldTable — renders a table of spec or status fields.
 *
 * Spec: .specify/specs/020-schema-doc-generator/ FR-002, FR-003
 */
export default function FieldTable({ fields, variant }: FieldTableProps) {
  if (fields.length === 0) return null

  if (variant === 'status') {
    return (
      <div className="field-table" data-testid="field-table">
        <table className="field-table__table">
          <thead>
            <tr>
              <th className="field-table__th">Field</th>
              <th className="field-table__th">Type</th>
              <th className="field-table__th field-table__th--source">Source Expression</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr
                key={field.name}
                className="field-table__row"
                data-testid="field-row"
              >
                <td className="field-table__td">
                  <code className="field-table__field-name">{field.name}</code>
                </td>
                <td className="field-table__td">
                  <code className="field-table__type-badge">
                    {formatType(field)}
                  </code>
                </td>
                <td className="field-table__td field-table__td--source">
                  <KroCodeBlock code={field.raw} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // variant === 'spec'
  return (
    <div className="field-table" data-testid="field-table">
      <table className="field-table__table">
        <thead>
          <tr>
            <th className="field-table__th">Field</th>
            <th className="field-table__th">Type</th>
            <th className="field-table__th field-table__th--center">Required</th>
            <th className="field-table__th">Default</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const hasDefault = field.parsedType?.default !== undefined
            // A field is considered "required" when there's no default
            const required = !hasDefault

            return (
              <tr
                key={field.name}
                className="field-table__row"
                data-testid="field-row"
              >
                <td className="field-table__td">
                  <code className="field-table__field-name">{field.name}</code>
                </td>
                <td className="field-table__td">
                  <code className="field-table__type-badge">
                    {formatType(field)}
                  </code>
                </td>
                <td className="field-table__td field-table__td--center">
                  {required ? (
                    <span
                      className="field-table__required-dot field-table__required-dot--required"
                      title="required"
                      aria-label="required"
                    >
                      ●
                    </span>
                  ) : (
                    <span
                      className="field-table__required-dot field-table__required-dot--optional"
                      title="optional"
                      aria-label="optional"
                    >
                      ●
                    </span>
                  )}
                </td>
                <td className="field-table__td">
                  {hasDefault ? (
                    <code className="field-table__default">
                      {field.parsedType?.default === ''
                        ? '""'
                        : field.parsedType?.default}
                    </code>
                  ) : (
                    <span className="field-table__no-default">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
