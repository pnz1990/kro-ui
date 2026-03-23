// InstanceForm.tsx — Interactive form for generating a Kubernetes instance manifest.
//
// Renders one input row per spec field with a type-appropriate control.
// Calls onChange synchronously on every user interaction.
//
// Spec: .specify/specs/026-rgd-yaml-generator/ FR-003, FR-005

import type { SchemaDoc } from '@/lib/schema'
import type { FieldValue, InstanceFormState } from '@/lib/generator'
import './InstanceForm.css'

export interface InstanceFormProps {
  schema: SchemaDoc
  state: InstanceFormState
  onChange: (state: InstanceFormState) => void
}

// ── Field update helpers ──────────────────────────────────────────────────

function updateMetadataName(
  state: InstanceFormState,
  value: string,
): InstanceFormState {
  return { ...state, metadataName: value }
}

function updateField(
  state: InstanceFormState,
  name: string,
  patch: Partial<FieldValue>,
): InstanceFormState {
  return {
    ...state,
    fields: state.fields.map((f) =>
      f.name === name ? { ...f, ...patch } : f,
    ),
  }
}

// ── Sub-components ────────────────────────────────────────────────────────

interface FieldRowProps {
  fv: FieldValue
  schema: SchemaDoc
  onChange: (patch: Partial<FieldValue>) => void
}

function FieldRow({ fv, schema, onChange }: FieldRowProps) {
  const field = schema.specFields.find((f) => f.name === fv.name)
  const pt = field?.parsedType
  const type = pt?.type ?? 'string'
  const isRequired = pt?.required === true || !('default' in (pt ?? {}))
  const typeName =
    type === 'array' && pt?.items
      ? `[]${pt.items}`
      : type === 'map' && pt?.key && pt.value
        ? `map[${pt.key}]${pt.value}`
        : type

  // ── Render the appropriate input control ──────────────────────────────

  let control: React.ReactNode

  if (pt?.enum) {
    const options = pt.enum.split(',').map((v) => v.trim())
    control = (
      <select
        className="instance-form__input"
        value={fv.value}
        onChange={(e) => onChange({ value: e.target.value })}
        aria-label={fv.name}
        aria-required={isRequired}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  } else if (type === 'boolean') {
    control = (
      <input
        type="checkbox"
        className="instance-form__checkbox"
        checked={fv.value === 'true'}
        onChange={(e) => onChange({ value: e.target.checked ? 'true' : 'false' })}
        aria-label={fv.name}
        aria-required={isRequired}
      />
    )
  } else if (type === 'integer' || type === 'number') {
    control = (
      <input
        type="number"
        className="instance-form__input"
        value={fv.value}
        step={type === 'integer' ? 1 : undefined}
        onChange={(e) => onChange({ value: e.target.value })}
        aria-label={fv.name}
        aria-required={isRequired}
      />
    )
  } else if (fv.isArray) {
    control = (
      <div className="instance-form__array-editor">
        {fv.items.map((item, idx) => (
          <div key={idx} className="instance-form__array-row">
            <input
              type="text"
              className="instance-form__input instance-form__input--array"
              value={item}
              onChange={(e) => {
                const newItems = [...fv.items]
                newItems[idx] = e.target.value
                onChange({ items: newItems })
              }}
              aria-label={`${fv.name} item ${idx + 1}`}
              aria-required={isRequired && idx === 0}
            />
            <button
              type="button"
              className="instance-form__array-remove"
              onClick={() => {
                const newItems = fv.items.filter((_, i) => i !== idx)
                onChange({ items: newItems })
              }}
              aria-label={`Remove ${fv.name} item ${idx + 1}`}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="instance-form__array-add"
          onClick={() => onChange({ items: [...fv.items, ''] })}
          aria-label={`Add ${fv.name} item`}
        >
          + Add item
        </button>
      </div>
    )
  } else if (type === 'object' || type === 'map') {
    control = (
      <textarea
        className="instance-form__textarea"
        value={fv.value}
        rows={3}
        onChange={(e) => onChange({ value: e.target.value })}
        aria-label={fv.name}
        aria-required={isRequired}
        placeholder="# YAML value"
      />
    )
  } else {
    control = (
      <input
        type="text"
        className="instance-form__input"
        value={fv.value}
        onChange={(e) => onChange({ value: e.target.value })}
        aria-label={fv.name}
        aria-required={isRequired}
      />
    )
  }

  return (
    <div className="instance-form__row">
      <div className="instance-form__label-cell">
        <code className="instance-form__field-name">{fv.name}</code>
        <span className="instance-form__type-badge">{typeName}</span>
        <span
          className={`instance-form__required-dot instance-form__required-dot--${isRequired ? 'required' : 'optional'}`}
          title={isRequired ? 'Required field' : 'Optional field'}
          aria-hidden="true"
        >
          ●
        </span>
      </div>
      <div className="instance-form__control-cell">{control}</div>
    </div>
  )
}

// ── InstanceForm ──────────────────────────────────────────────────────────

/**
 * InstanceForm — interactive per-field form for instance manifest generation.
 *
 * First row is always metadata.name.
 * Each spec field maps to a type-appropriate input control.
 * All onChange calls update state synchronously.
 */
export default function InstanceForm({ schema, state, onChange }: InstanceFormProps) {
  // True when at least one spec field is required — controls legend visibility.
  // Mirrors the isRequired logic in FieldRow: required flag OR no default defined.
  const hasRequiredField = schema.specFields.some((f) => {
    const pt = f.parsedType
    return pt?.required === true || !('default' in (pt ?? {}))
  })
  return (
    <div className="instance-form" data-testid="instance-form">
      {/* metadata.name row — always first */}
      <div className="instance-form__row">
        <div className="instance-form__label-cell">
          <code className="instance-form__field-name">metadata.name</code>
          <span className="instance-form__type-badge">string</span>
        </div>
        <div className="instance-form__control-cell">
          <input
            type="text"
            className="instance-form__input"
            value={state.metadataName}
            onChange={(e) => onChange(updateMetadataName(state, e.target.value))}
            aria-label="metadata.name"
            aria-required="true"
          />
        </div>
      </div>

      {/* Required/optional legend — shown only when at least one required field exists */}
      {hasRequiredField && (
        <div className="instance-form__legend">
          <span>
            <span
              className="instance-form__required-dot instance-form__required-dot--required"
              title="Required field"
              aria-hidden="true"
            >●</span>
            {' '}required
          </span>
          <span>
            <span
              className="instance-form__required-dot instance-form__required-dot--optional"
              title="Optional field"
              aria-hidden="true"
            >●</span>
            {' '}optional
          </span>
        </div>
      )}

      {/* Spec fields */}
      {state.fields.length === 0 ? (
        <p className="instance-form__empty">This RGD has no configurable fields</p>
      ) : (
        state.fields.map((fv) => (
          <FieldRow
            key={fv.name}
            fv={fv}
            schema={schema}
            onChange={(patch) => onChange(updateField(state, fv.name, patch))}
          />
        ))
      )}
    </div>
  )
}
