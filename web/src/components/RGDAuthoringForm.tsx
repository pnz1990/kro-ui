// RGDAuthoringForm.tsx — Guided form to scaffold a new ResourceGraphDefinition YAML.
//
// Three sections: Metadata, Spec Fields (repeatable rows), Resources (repeatable rows).
// Pre-populated with a starter state (kind=MyApp, one Deployment resource).
//
// Spec: .specify/specs/026-rgd-yaml-generator/ FR-010

import type { RGDAuthoringState, AuthoringField, AuthoringResource } from '@/lib/generator'
import './RGDAuthoringForm.css'

export interface RGDAuthoringFormProps {
  state: RGDAuthoringState
  onChange: (state: RGDAuthoringState) => void
}

const FIELD_TYPE_OPTIONS = [
  'string',
  'integer',
  'boolean',
  'number',
  '[]string',
  '[]integer',
  'map[string]string',
]

// ── Helpers ───────────────────────────────────────────────────────────────

function newFieldId(): string {
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function newResourceId(): string {
  return `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ── RGDAuthoringForm ──────────────────────────────────────────────────────

/**
 * RGDAuthoringForm — guided RGD YAML scaffolder.
 *
 * Section 1 — Metadata: rgdName, kind, group, apiVersion inputs.
 * Section 2 — Spec Fields: repeatable rows with name, type, default/required.
 * Section 3 — Resources: repeatable rows with id, apiVersion, kind.
 */
export default function RGDAuthoringForm({ state, onChange }: RGDAuthoringFormProps) {
  // ── Metadata handlers ────────────────────────────────────────────────────

  function setMeta(patch: Partial<RGDAuthoringState>) {
    onChange({ ...state, ...patch })
  }

  // ── Field handlers ────────────────────────────────────────────────────────

  function addField() {
    const newField: AuthoringField = {
      id: newFieldId(),
      name: '',
      type: 'string',
      defaultValue: '',
      required: false,
    }
    onChange({ ...state, specFields: [...state.specFields, newField] })
  }

  function updateField(id: string, patch: Partial<AuthoringField>) {
    onChange({
      ...state,
      specFields: state.specFields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    })
  }

  function removeField(id: string) {
    onChange({ ...state, specFields: state.specFields.filter((f) => f.id !== id) })
  }

  // ── Resource handlers ─────────────────────────────────────────────────────

  function addResource() {
    const newRes: AuthoringResource = {
      id: newResourceId(),
      apiVersion: 'apps/v1',
      kind: 'Deployment',
    }
    onChange({ ...state, resources: [...state.resources, newRes] })
  }

  function updateResource(id: string, patch: Partial<AuthoringResource>) {
    onChange({
      ...state,
      resources: state.resources.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })
  }

  function removeResource(id: string) {
    onChange({ ...state, resources: state.resources.filter((r) => r.id !== id) })
  }

  return (
    <div className="rgd-authoring-form" data-testid="rgd-authoring-form">
      {/* Section 1 — Metadata */}
      <section className="rgd-authoring-form__section">
        <h3 className="rgd-authoring-form__section-title">Metadata</h3>
        <div className="rgd-authoring-form__meta-grid">
          <label className="rgd-authoring-form__label" htmlFor="rgd-name">
            RGD name
          </label>
          <input
            id="rgd-name"
            className="rgd-authoring-form__input"
            type="text"
            value={state.rgdName}
            onChange={(e) => setMeta({ rgdName: e.target.value })}
            aria-label="RGD name"
          />

          <label className="rgd-authoring-form__label" htmlFor="rgd-kind">
            Kind
          </label>
          <input
            id="rgd-kind"
            className="rgd-authoring-form__input"
            type="text"
            value={state.kind}
            onChange={(e) => setMeta({ kind: e.target.value })}
            aria-label="Kind"
          />

          <label className="rgd-authoring-form__label" htmlFor="rgd-group">
            Group
          </label>
          <input
            id="rgd-group"
            className="rgd-authoring-form__input"
            type="text"
            value={state.group}
            onChange={(e) => setMeta({ group: e.target.value })}
            aria-label="Group"
          />

          <label className="rgd-authoring-form__label" htmlFor="rgd-apiversion">
            apiVersion
          </label>
          <input
            id="rgd-apiversion"
            className="rgd-authoring-form__input"
            type="text"
            value={state.apiVersion}
            onChange={(e) => setMeta({ apiVersion: e.target.value })}
            aria-label="apiVersion"
          />
        </div>
      </section>

      {/* Section 2 — Spec Fields */}
      <section className="rgd-authoring-form__section">
        <h3 className="rgd-authoring-form__section-title">Spec Fields</h3>
        {state.specFields.map((field) => (
          <div key={field.id} className="rgd-authoring-form__field-row">
            <input
              type="text"
              className="rgd-authoring-form__input rgd-authoring-form__input--name"
              placeholder="fieldName"
              value={field.name}
              onChange={(e) => updateField(field.id, { name: e.target.value })}
              aria-label="Field name"
            />
            <select
              className="rgd-authoring-form__select"
              value={field.type}
              onChange={(e) => updateField(field.id, { type: e.target.value })}
              aria-label="Field type"
            >
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="rgd-authoring-form__input rgd-authoring-form__input--default"
              placeholder="default value"
              value={field.defaultValue}
              onChange={(e) => updateField(field.id, { defaultValue: e.target.value })}
              disabled={field.required}
              aria-label="Default value"
            />
            <label className="rgd-authoring-form__required-label">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => updateField(field.id, { required: e.target.checked })}
                aria-label="Required"
              />
              req
            </label>
            <button
              type="button"
              className="rgd-authoring-form__remove-btn"
              onClick={() => removeField(field.id)}
              aria-label="Remove field"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="rgd-authoring-form__add-btn"
          onClick={addField}
        >
          + Add Field
        </button>
      </section>

      {/* Section 3 — Resources */}
      <section className="rgd-authoring-form__section">
        <h3 className="rgd-authoring-form__section-title">Resources</h3>
        {state.resources.map((res) => (
          <div key={res.id} className="rgd-authoring-form__resource-row">
            <input
              type="text"
              className="rgd-authoring-form__input rgd-authoring-form__input--id"
              placeholder="id"
              value={res.id}
              onChange={(e) => updateResource(res.id, { id: e.target.value })}
              aria-label="Resource id"
            />
            <input
              type="text"
              className="rgd-authoring-form__input"
              placeholder="apiVersion"
              value={res.apiVersion}
              onChange={(e) => updateResource(res.id, { apiVersion: e.target.value })}
              aria-label="Resource apiVersion"
            />
            <input
              type="text"
              className="rgd-authoring-form__input"
              placeholder="kind"
              value={res.kind}
              onChange={(e) => updateResource(res.id, { kind: e.target.value })}
              aria-label="Resource kind"
            />
            <button
              type="button"
              className="rgd-authoring-form__remove-btn"
              onClick={() => removeResource(res.id)}
              aria-label="Remove resource"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="rgd-authoring-form__add-btn"
          onClick={addResource}
        >
          + Add Resource
        </button>
      </section>
    </div>
  )
}
