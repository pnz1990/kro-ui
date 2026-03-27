// RGDAuthoringForm.tsx — Guided form to scaffold a new ResourceGraphDefinition YAML.
//
// Sections: Metadata (+ scope toggle), Spec Fields (+ constraints), Status Fields,
//           Resources (+ resource type, template editor, forEach, externalRef,
//           includeWhen, readyWhen).
//
// Spec: .specify/specs/044-rgd-designer-full-features/

import { useState } from 'react'
import type {
  RGDAuthoringState,
  AuthoringField,
  AuthoringResource,
  AuthoringStatusField,
  ForEachIterator,
  ValidationState,
} from '@/lib/generator'
import { validateRGDState } from '@/lib/generator'
import type { StaticIssue } from '@/lib/api'
import './RGDAuthoringForm.css'

export interface RGDAuthoringFormProps {
  state: RGDAuthoringState
  onChange: (state: RGDAuthoringState) => void
  /** Offline static validation issues from POST /api/v1/rgds/validate/static (spec 045 US10). */
  staticIssues?: StaticIssue[]
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

function newStatusFieldId(): string {
  return `sf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function newForEachKey(): string {
  return `fe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function newSelectorKey(): string {
  return `sl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Returns a fully-defaulted new AuthoringResource. */
function makeNewResource(): AuthoringResource {
  return {
    _key: newResourceId(),
    id: 'resource',
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    resourceType: 'managed',
    templateYaml: '',
    includeWhen: '',
    readyWhen: [],
    forEachIterators: [{ _key: newForEachKey(), variable: '', expression: '' }],
    externalRef: {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      namespace: '',
      name: '',
      selectorLabels: [],
    },
  }
}

// ── RGDAuthoringForm ──────────────────────────────────────────────────────

/**
 * RGDAuthoringForm — guided RGD YAML scaffolder with full kro feature coverage.
 *
 * Section 1 — Metadata: rgdName, kind, group, apiVersion, scope radio (US7)
 * Section 2 — Spec Fields: name/type/default/required + constraint expansion (US8)
 * Section 3 — Status Fields: name + CEL expression rows (US2)
 * Section 4 — Resources: type toggle, template editor, forEach iterators,
 *              externalRef fields, advanced options (includeWhen/readyWhen)
 *              (US1, US3, US4, US5, US6)
 */
export default function RGDAuthoringForm({ state, onChange, staticIssues }: RGDAuthoringFormProps) {
  // ── Local UI state (not persisted to RGDAuthoringState) ──────────────────
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set())
  const [expandedAdvanced, setExpandedAdvanced] = useState<Set<string>>(new Set())
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set())

  // ── Validation (spec 045) — computed on every render, O(N) ──────────────
  const validation: ValidationState = validateRGDState(state)

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
    setExpandedFields((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function toggleFieldExpanded(id: string) {
    setExpandedFields((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Status field handlers (US2) ───────────────────────────────────────────

  function addStatusField() {
    const newSF: AuthoringStatusField = {
      id: newStatusFieldId(),
      name: '',
      expression: '',
    }
    onChange({ ...state, statusFields: [...(state.statusFields ?? []), newSF] })
  }

  function updateStatusField(id: string, patch: Partial<AuthoringStatusField>) {
    onChange({
      ...state,
      statusFields: (state.statusFields ?? []).map((sf) =>
        sf.id === id ? { ...sf, ...patch } : sf,
      ),
    })
  }

  function removeStatusField(id: string) {
    onChange({
      ...state,
      statusFields: (state.statusFields ?? []).filter((sf) => sf.id !== id),
    })
  }

  // ── Resource handlers ─────────────────────────────────────────────────────

  function addResource() {
    onChange({ ...state, resources: [...state.resources, makeNewResource()] })
  }

  function updateResource(_key: string, patch: Partial<AuthoringResource>) {
    onChange({
      ...state,
      resources: state.resources.map((r) => (r._key === _key ? { ...r, ...patch } : r)),
    })
  }

  function removeResource(_key: string) {
    onChange({ ...state, resources: state.resources.filter((r) => r._key !== _key) })
    setExpandedTemplates((prev) => {
      const next = new Set(prev)
      next.delete(_key)
      return next
    })
    setExpandedAdvanced((prev) => {
      const next = new Set(prev)
      next.delete(_key)
      return next
    })
  }

  function toggleTemplateExpanded(_key: string) {
    setExpandedTemplates((prev) => {
      const next = new Set(prev)
      if (next.has(_key)) next.delete(_key)
      else next.add(_key)
      return next
    })
  }

  function toggleAdvancedExpanded(_key: string) {
    setExpandedAdvanced((prev) => {
      const next = new Set(prev)
      if (next.has(_key)) next.delete(_key)
      else next.add(_key)
      return next
    })
  }

  // Resource type change — reset mode-specific fields, preserve shared fields
  function changeResourceType(_key: string, newType: AuthoringResource['resourceType']) {
    updateResource(_key, {
      resourceType: newType,
      // Reset mode-specific fields on switch
      forEachIterators: [{ _key: newForEachKey(), variable: '', expression: '' }],
      externalRef: {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        namespace: '',
        name: '',
        selectorLabels: [],
      },
    })
  }

  // forEach iterator handlers (US5)
  function addForEachIterator(_key: string) {
    const res = state.resources.find((r) => r._key === _key)
    if (!res) return
    updateResource(_key, {
      forEachIterators: [
        ...(res.forEachIterators ?? []),
        { _key: newForEachKey(), variable: '', expression: '' },
      ],
    })
  }

  function updateForEachIterator(_key: string, iterKey: string, patch: Partial<ForEachIterator>) {
    const res = state.resources.find((r) => r._key === _key)
    if (!res) return
    updateResource(_key, {
      forEachIterators: (res.forEachIterators ?? []).map((it) =>
        it._key === iterKey ? { ...it, ...patch } : it,
      ),
    })
  }

  function removeForEachIterator(_key: string, iterKey: string) {
    const res = state.resources.find((r) => r._key === _key)
    if (!res) return
    updateResource(_key, {
      forEachIterators: (res.forEachIterators ?? []).filter((it) => it._key !== iterKey),
    })
  }

  // readyWhen handlers (US4)
  function addReadyWhen(_key: string) {
    const res = state.resources.find((r) => r._key === _key)
    if (!res) return
    updateResource(_key, { readyWhen: [...(res.readyWhen ?? []), ''] })
  }

  function updateReadyWhen(_key: string, idx: number, val: string) {
    const res = state.resources.find((r) => r._key === _key)
    if (!res) return
    const next = [...(res.readyWhen ?? [])]
    next[idx] = val
    updateResource(_key, { readyWhen: next })
  }

  function removeReadyWhen(_key: string, idx: number) {
    const res = state.resources.find((r) => r._key === _key)
    if (!res) return
    updateResource(_key, { readyWhen: (res.readyWhen ?? []).filter((_, i) => i !== idx) })
  }

  // externalRef selector label handlers (US6)
  function addSelectorLabel(_key: string) {
    const res = state.resources.find((r) => r._key === _key)
    if (!res) return
    updateResource(_key, {
      externalRef: {
        ...res.externalRef,
        selectorLabels: [
          ...(res.externalRef.selectorLabels ?? []),
          { _key: newSelectorKey(), labelKey: '', labelValue: '' },
        ],
      },
    })
  }

  function updateSelectorLabel(
    _key: string,
    labelKey: string,
    patch: { labelKey?: string; labelValue?: string },
  ) {
    const res = state.resources.find((r) => r._key === _key)
    if (!res) return
    updateResource(_key, {
      externalRef: {
        ...res.externalRef,
        selectorLabels: (res.externalRef.selectorLabels ?? []).map((lbl) =>
          lbl._key === labelKey ? { ...lbl, ...patch } : lbl,
        ),
      },
    })
  }

  function removeSelectorLabel(_key: string, labelKey: string) {
    const res = state.resources.find((r) => r._key === _key)
    if (!res) return
    updateResource(_key, {
      externalRef: {
        ...res.externalRef,
        selectorLabels: (res.externalRef.selectorLabels ?? []).filter(
          (lbl) => lbl._key !== labelKey,
        ),
      },
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rgd-authoring-form" data-testid="rgd-authoring-form">
      {/* Spec 045: validation summary badge — shown when any issue exists */}
      {validation.totalCount > 0 && (
        <div
          className="rgd-authoring-form__validation-summary"
          data-testid="validation-summary"
          role="status"
          aria-live="polite"
        >
          ⚠ {validation.totalCount} {validation.totalCount === 1 ? 'warning' : 'warnings'}
        </div>
      )}

      {/* Spec 045 US10: deep validation issues from kro-library static check */}
      {staticIssues && staticIssues.length > 0 && (
        <div
          className="rgd-authoring-form__deep-validation"
          data-testid="static-validation-section"
        >
          <p className="rgd-authoring-form__deep-validation-title">Deep validation</p>
          {staticIssues.map((issue, idx) => (
            <div key={idx} className="rgd-authoring-form__deep-issue">
              <span className="rgd-authoring-form__deep-issue-field">{issue.field}</span>
              <span className="rgd-authoring-form__deep-issue-msg">{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Section 1 — Metadata */}
      <section className="rgd-authoring-form__section">
        <h3 className="rgd-authoring-form__section-title">Metadata</h3>
        <div className="rgd-authoring-form__meta-grid">
          <label className="rgd-authoring-form__label" htmlFor="rgd-name">
            RGD name
          </label>
          <div>
            <input
              id="rgd-name"
              className="rgd-authoring-form__input"
              type="text"
              value={state.rgdName}
              onChange={(e) => setMeta({ rgdName: e.target.value })}
              aria-label="RGD name"
            />
            {/* Spec 045: inline validation message for rgdName */}
            <span
              role="alert"
              aria-live="polite"
              className={
                validation.rgdName
                  ? validation.rgdName.type === 'error'
                    ? 'rgd-authoring-form__field-msg'
                    : 'rgd-authoring-form__field-msg rgd-authoring-form__field-msg--warn'
                  : 'rgd-authoring-form__field-msg'
              }
            >
              {validation.rgdName?.message ?? ''}
            </span>
          </div>

          <label className="rgd-authoring-form__label" htmlFor="rgd-kind">
            Kind
          </label>
          <div>
            <input
              id="rgd-kind"
              className="rgd-authoring-form__input"
              type="text"
              value={state.kind}
              onChange={(e) => setMeta({ kind: e.target.value })}
              aria-label="Kind"
            />
            {/* Spec 045: inline validation message for kind */}
            <span
              role="alert"
              aria-live="polite"
              className={
                validation.kind
                  ? validation.kind.type === 'error'
                    ? 'rgd-authoring-form__field-msg'
                    : 'rgd-authoring-form__field-msg rgd-authoring-form__field-msg--warn'
                  : 'rgd-authoring-form__field-msg'
              }
            >
              {validation.kind?.message ?? ''}
            </span>
          </div>

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

          {/* US7: Scope toggle */}
          <span className="rgd-authoring-form__label">Scope</span>
          <div className="rgd-authoring-form__scope-group">
            <label className="rgd-authoring-form__scope-label">
              <input
                type="radio"
                name="rgd-scope"
                value="Namespaced"
                checked={state.scope === 'Namespaced'}
                onChange={() => setMeta({ scope: 'Namespaced' })}
                data-testid="scope-namespaced"
                aria-label="Namespaced scope"
              />
              Namespaced
            </label>
            <label className="rgd-authoring-form__scope-label">
              <input
                type="radio"
                name="rgd-scope"
                value="Cluster"
                checked={state.scope === 'Cluster'}
                onChange={() => setMeta({ scope: 'Cluster' })}
                data-testid="scope-cluster"
                aria-label="Cluster scope"
              />
              Cluster
            </label>
          </div>
        </div>
      </section>

      {/* Section 2 — Spec Fields */}
      <section className="rgd-authoring-form__section">
        <h3 className="rgd-authoring-form__section-title">Spec Fields</h3>
        {state.specFields.map((field) => (
          <div key={field.id} className="rgd-authoring-form__field-block">
            <div className="rgd-authoring-form__field-row">
              {/* US8: constraint expand toggle */}
              <button
                type="button"
                className="rgd-authoring-form__expand-btn"
                onClick={() => toggleFieldExpanded(field.id)}
                data-testid={`field-expand-${field.id}`}
                aria-label={expandedFields.has(field.id) ? 'Collapse constraints' : 'Expand constraints'}
                aria-expanded={expandedFields.has(field.id)}
              >
                {expandedFields.has(field.id) ? '▾' : '▸'}
              </button>
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
                Required
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
            {/* Spec 045: inline message for duplicate spec field name */}
            {validation.specFieldIssues[field.id]?.message !== 'minimum must be \u2264 maximum' && (
              <span
                role="alert"
                aria-live="polite"
                className="rgd-authoring-form__field-msg rgd-authoring-form__field-msg--warn"
              >
                {validation.specFieldIssues[field.id]?.message ?? ''}
              </span>
            )}
            {/* US8: constraint expansion area */}
            {expandedFields.has(field.id) && (
              <div className="rgd-authoring-form__field-constraints">
                <label className="rgd-authoring-form__constraint-label">
                  enum
                  <input
                    type="text"
                    className="rgd-authoring-form__input rgd-authoring-form__input--constraint"
                    placeholder="dev,staging,prod"
                    value={field.enum ?? ''}
                    onChange={(e) => updateField(field.id, { enum: e.target.value })}
                    data-testid={`field-enum-${field.id}`}
                    aria-label="Enum values"
                  />
                </label>
                <label className="rgd-authoring-form__constraint-label">
                  min
                  <input
                    type="number"
                    className="rgd-authoring-form__input rgd-authoring-form__input--constraint"
                    placeholder="1"
                    value={field.minimum ?? ''}
                    onChange={(e) => updateField(field.id, { minimum: e.target.value })}
                    data-testid={`field-min-${field.id}`}
                    aria-label="Minimum value"
                  />
                </label>
                <label className="rgd-authoring-form__constraint-label">
                  max
                  <input
                    type="number"
                    className="rgd-authoring-form__input rgd-authoring-form__input--constraint"
                    placeholder="100"
                    value={field.maximum ?? ''}
                    onChange={(e) => updateField(field.id, { maximum: e.target.value })}
                    data-testid={`field-max-${field.id}`}
                    aria-label="Maximum value"
                  />
                </label>
                <label className="rgd-authoring-form__constraint-label">
                  pattern
                  <input
                    type="text"
                    className="rgd-authoring-form__input rgd-authoring-form__input--constraint"
                    placeholder="^[a-z]+"
                    value={field.pattern ?? ''}
                    onChange={(e) => updateField(field.id, { pattern: e.target.value })}
                    data-testid={`field-pattern-${field.id}`}
                    aria-label="Pattern"
                  />
                </label>
                {/* Spec 045: inline message for min > max constraint */}
                {validation.specFieldIssues[field.id]?.message === 'minimum must be \u2264 maximum' && (
                  <span
                    role="alert"
                    aria-live="polite"
                    className="rgd-authoring-form__field-msg rgd-authoring-form__field-msg--warn"
                  >
                    {validation.specFieldIssues[field.id]?.message}
                  </span>
                )}
              </div>
            )}
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

      {/* Section 3 — Status Fields (US2) */}
      <section className="rgd-authoring-form__section" data-testid="status-fields-section">
        <h3 className="rgd-authoring-form__section-title">Status Fields</h3>
        {(state.statusFields ?? []).map((sf) => (
          <div key={sf.id}>
            <div className="rgd-authoring-form__status-row">
              <input
                type="text"
                className="rgd-authoring-form__input rgd-authoring-form__input--name"
                placeholder="fieldName"
                value={sf.name}
                onChange={(e) => updateStatusField(sf.id, { name: e.target.value })}
                data-testid={`status-field-name-${sf.id}`}
                aria-label="Status field name"
              />
              <div className="rgd-authoring-form__cel-wrap">
                <input
                  type="text"
                  className="rgd-authoring-form__input rgd-authoring-form__input--cel"
                  placeholder="${resource.status.field}"
                  value={sf.expression}
                  onChange={(e) => updateStatusField(sf.id, { expression: e.target.value })}
                  data-testid={`status-field-expr-${sf.id}`}
                  aria-label="Status field CEL expression"
                />
                <span className="rgd-authoring-form__cel-badge">CEL</span>
              </div>
              <button
                type="button"
                className="rgd-authoring-form__remove-btn"
                onClick={() => removeStatusField(sf.id)}
                data-testid={`status-field-remove-${sf.id}`}
                aria-label="Remove status field"
              >
                ×
              </button>
            </div>
            {/* Spec 045: inline message for duplicate status field name */}
            <span
              role="alert"
              aria-live="polite"
              className="rgd-authoring-form__field-msg rgd-authoring-form__field-msg--warn"
            >
              {validation.statusFieldIssues[sf.id]?.message ?? ''}
            </span>
          </div>
        ))}
        <button
          type="button"
          className="rgd-authoring-form__add-btn"
          onClick={addStatusField}
          data-testid="add-status-field-btn"
        >
          + Add Status Field
        </button>
      </section>

      {/* Section 4 — Resources */}
      <section className="rgd-authoring-form__section">
        <h3 className="rgd-authoring-form__section-title">Resources</h3>
        {state.resources.map((res) => {
          const isTemplateOpen = expandedTemplates.has(res._key)
          const isAdvancedOpen = expandedAdvanced.has(res._key)
          const hasIncludeWhen = !!res.includeWhen?.trim()
          const hasReadyWhen = (res.readyWhen ?? []).some((rw) => rw.trim())

          // Detect if templateYaml has no valid key: value pairs (simple check)
          const templateUnparseable =
            res.templateYaml?.trim() !== '' &&
            !/^\s*\w+\s*:/m.test(res.templateYaml ?? '')

          return (
            <div key={res._key} className="rgd-authoring-form__resource-block">
              {/* Resource header row */}
              <div className="rgd-authoring-form__resource-row">
                {/* US5: Resource type select */}
                <select
                  className="rgd-authoring-form__select rgd-authoring-form__select--type"
                  value={res.resourceType}
                  onChange={(e) =>
                    changeResourceType(res._key, e.target.value as AuthoringResource['resourceType'])
                  }
                  data-testid={`resource-type-${res._key}`}
                  aria-label="Resource type"
                >
                  <option value="managed">Managed</option>
                  <option value="forEach">Collection (forEach)</option>
                  <option value="externalRef">External ref</option>
                </select>
                <input
                  type="text"
                  className="rgd-authoring-form__input rgd-authoring-form__input--id"
                  placeholder="id"
                  value={res.id}
                  onChange={(e) => updateResource(res._key, { id: e.target.value })}
                  aria-label="Resource id"
                />
                <input
                  type="text"
                  className="rgd-authoring-form__input"
                  placeholder="apiVersion"
                  value={res.resourceType === 'externalRef' ? res.externalRef.apiVersion : res.apiVersion}
                  onChange={(e) =>
                    res.resourceType === 'externalRef'
                      ? updateResource(res._key, {
                          externalRef: { ...res.externalRef, apiVersion: e.target.value },
                        })
                      : updateResource(res._key, { apiVersion: e.target.value })
                  }
                  aria-label="Resource apiVersion"
                />
                <input
                  type="text"
                  className="rgd-authoring-form__input"
                  placeholder="kind"
                  value={res.resourceType === 'externalRef' ? res.externalRef.kind : res.kind}
                  onChange={(e) =>
                    res.resourceType === 'externalRef'
                      ? updateResource(res._key, {
                          externalRef: { ...res.externalRef, kind: e.target.value },
                        })
                      : updateResource(res._key, { kind: e.target.value })
                  }
                  aria-label="Resource kind"
                />
                {/* Status badges */}
                {hasIncludeWhen && (
                  <span className="rgd-authoring-form__badge rgd-authoring-form__badge--conditional">
                    conditional
                  </span>
                )}
                {hasReadyWhen && (
                  <span className="rgd-authoring-form__badge rgd-authoring-form__badge--ready">
                    ready-gated
                  </span>
                )}
                <button
                  type="button"
                  className="rgd-authoring-form__remove-btn"
                  onClick={() => removeResource(res._key)}
                  aria-label="Remove resource"
                >
                  ×
                </button>
              </div>
              {/* Spec 045: inline message for duplicate resource ID or forEach-no-iterator */}
              {validation.resourceIssues[res._key] && (
                <span
                  role="alert"
                  aria-live="polite"
                  className="rgd-authoring-form__field-msg rgd-authoring-form__field-msg--warn"
                >
                  {validation.resourceIssues[res._key]?.message}
                </span>
              )}

              {/* Resource action buttons row */}
              <div className="rgd-authoring-form__resource-actions">
                {/* US1: Template editor toggle (only for non-externalRef modes) */}
                {res.resourceType !== 'externalRef' && (
                  <button
                    type="button"
                    className="rgd-authoring-form__disclosure-btn"
                    onClick={() => toggleTemplateExpanded(res._key)}
                    data-testid={`template-expand-${res._key}`}
                    aria-expanded={isTemplateOpen}
                    aria-label={isTemplateOpen ? 'Hide template editor' : 'Edit template'}
                  >
                    {isTemplateOpen ? '▾' : '▸'} Edit template
                    {templateUnparseable && (
                      <span
                        className="rgd-authoring-form__warn-badge"
                        title="Template not parseable for DAG — edges may be missing"
                      >
                        ⚠
                      </span>
                    )}
                  </button>
                )}
                {/* US3: Advanced options toggle */}
                <button
                  type="button"
                  className="rgd-authoring-form__disclosure-btn"
                  onClick={() => toggleAdvancedExpanded(res._key)}
                  data-testid={`advanced-expand-${res._key}`}
                  aria-expanded={isAdvancedOpen}
                  aria-label={isAdvancedOpen ? 'Hide advanced options' : 'Show advanced options'}
                >
                  {isAdvancedOpen ? '▾' : '▸'} Advanced options
                </button>
              </div>

              {/* US1: Template editor textarea */}
              {res.resourceType !== 'externalRef' && isTemplateOpen && (
                <div className="rgd-authoring-form__template-editor">
                  <textarea
                    className="rgd-authoring-form__template-textarea"
                    value={res.templateYaml ?? ''}
                    onChange={(e) => updateResource(res._key, { templateYaml: e.target.value })}
                    placeholder={'metadata:\n  name: ${schema.metadata.name}-' + (res.id || 'resource') + '\nspec:\n  replicas: ${schema.spec.replicas}'}
                    data-testid={`template-body-${res._key}`}
                    aria-label="Template YAML body"
                    rows={8}
                    spellCheck={false}
                  />
                </div>
              )}

              {/* US5: forEach iterator rows */}
              {res.resourceType === 'forEach' && (
                <div className="rgd-authoring-form__foreach-section">
                  <span className="rgd-authoring-form__subsection-label">forEach iterators</span>
                  {(res.forEachIterators ?? []).map((it, i) => (
                    <div key={it._key} className="rgd-authoring-form__foreach-row">
                      <input
                        type="text"
                        className="rgd-authoring-form__input"
                        placeholder="variable"
                        value={it.variable}
                        onChange={(e) =>
                          updateForEachIterator(res._key, it._key, { variable: e.target.value })
                        }
                        data-testid={`foreach-var-${res._key}-${i}`}
                        aria-label="Iterator variable name"
                      />
                      <span className="rgd-authoring-form__foreach-in">in</span>
                      <div className="rgd-authoring-form__cel-wrap">
                        <input
                          type="text"
                          className="rgd-authoring-form__input rgd-authoring-form__input--cel"
                          placeholder="${schema.spec.regions}"
                          value={it.expression}
                          onChange={(e) =>
                            updateForEachIterator(res._key, it._key, {
                              expression: e.target.value,
                            })
                          }
                          data-testid={`foreach-expr-${res._key}-${i}`}
                          aria-label="Iterator CEL expression"
                        />
                        <span className="rgd-authoring-form__cel-badge">CEL</span>
                      </div>
                      {/* FR-060: Hide Remove button when there is only 1 iterator.
                          Prevents accidentally leaving a forEach with 0 iterators. */}
                      {(res.forEachIterators?.length ?? 0) > 1 && (
                        <button
                          type="button"
                          className="rgd-authoring-form__remove-btn"
                          onClick={() => removeForEachIterator(res._key, it._key)}
                          data-testid={`foreach-remove-${res._key}-${i}`}
                          aria-label="Remove iterator"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="rgd-authoring-form__add-btn rgd-authoring-form__add-btn--sm"
                    onClick={() => addForEachIterator(res._key)}
                    data-testid={`foreach-add-${res._key}`}
                  >
                    + Add iterator
                  </button>
                </div>
              )}

              {/* US6: externalRef fields */}
              {res.resourceType === 'externalRef' && (
                <div className="rgd-authoring-form__extref-section">
                  <div className="rgd-authoring-form__extref-row">
                    <label className="rgd-authoring-form__sublabel">Namespace (optional)</label>
                    <input
                      type="text"
                      className="rgd-authoring-form__input"
                      placeholder="platform-system"
                      value={res.externalRef.namespace}
                      onChange={(e) =>
                        updateResource(res._key, {
                          externalRef: { ...res.externalRef, namespace: e.target.value },
                        })
                      }
                      data-testid={`extref-ns-${res._key}`}
                      aria-label="externalRef namespace"
                    />
                  </div>
                  <div className="rgd-authoring-form__extref-mode">
                    <label className="rgd-authoring-form__scope-label">
                      <input
                        type="radio"
                        name={`extref-mode-${res._key}`}
                        value="byname"
                        checked={
                          !(res.externalRef.selectorLabels.length > 0 && !res.externalRef.name)
                        }
                        onChange={() =>
                          updateResource(res._key, {
                            externalRef: {
                              ...res.externalRef,
                              selectorLabels: [],
                            },
                          })
                        }
                        data-testid={`extref-byname-${res._key}`}
                        aria-label="By name"
                      />
                      By name
                    </label>
                    <label className="rgd-authoring-form__scope-label">
                      <input
                        type="radio"
                        name={`extref-mode-${res._key}`}
                        value="byselector"
                        checked={
                          res.externalRef.selectorLabels.length > 0 && !res.externalRef.name
                        }
                        onChange={() =>
                          updateResource(res._key, {
                            externalRef: {
                              ...res.externalRef,
                              name: '',
                              selectorLabels:
                                res.externalRef.selectorLabels.length === 0
                                  ? [{ _key: newSelectorKey(), labelKey: '', labelValue: '' }]
                                  : res.externalRef.selectorLabels,
                            },
                          })
                        }
                        data-testid={`extref-byselector-${res._key}`}
                        aria-label="By selector"
                      />
                      By selector
                    </label>
                  </div>

                  {/* By name: single name input */}
                  {!(res.externalRef.selectorLabels.length > 0 && !res.externalRef.name) && (
                    <div className="rgd-authoring-form__extref-row">
                      <label className="rgd-authoring-form__sublabel">Name</label>
                      <input
                        type="text"
                        className="rgd-authoring-form__input"
                        placeholder="platform-config"
                        value={res.externalRef.name}
                        onChange={(e) =>
                          updateResource(res._key, {
                            externalRef: { ...res.externalRef, name: e.target.value },
                          })
                        }
                        data-testid={`extref-name-${res._key}`}
                        aria-label="externalRef name"
                      />
                    </div>
                  )}

                  {/* By selector: matchLabels rows */}
                  {res.externalRef.selectorLabels.length > 0 && !res.externalRef.name && (
                    <div className="rgd-authoring-form__selector-section">
                      <span className="rgd-authoring-form__subsection-label">matchLabels</span>
                      {res.externalRef.selectorLabels.map((lbl, i) => (
                        <div key={lbl._key} className="rgd-authoring-form__selector-row">
                          <input
                            type="text"
                            className="rgd-authoring-form__input"
                            placeholder="role"
                            value={lbl.labelKey}
                            onChange={(e) =>
                              updateSelectorLabel(res._key, lbl._key, {
                                labelKey: e.target.value,
                              })
                            }
                            data-testid={`extref-label-key-${res._key}-${i}`}
                            aria-label="Label key"
                          />
                          <span className="rgd-authoring-form__foreach-in">=</span>
                          <input
                            type="text"
                            className="rgd-authoring-form__input"
                            placeholder="team-config"
                            value={lbl.labelValue}
                            onChange={(e) =>
                              updateSelectorLabel(res._key, lbl._key, {
                                labelValue: e.target.value,
                              })
                            }
                            data-testid={`extref-label-val-${res._key}-${i}`}
                            aria-label="Label value"
                          />
                          <button
                            type="button"
                            className="rgd-authoring-form__remove-btn"
                            onClick={() => removeSelectorLabel(res._key, lbl._key)}
                            data-testid={`extref-label-remove-${res._key}-${i}`}
                            aria-label="Remove label"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="rgd-authoring-form__add-btn rgd-authoring-form__add-btn--sm"
                        onClick={() => addSelectorLabel(res._key)}
                        data-testid={`extref-label-add-${res._key}`}
                      >
                        + Add label
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* US3 + US4: Advanced options (includeWhen + readyWhen) */}
              {isAdvancedOpen && (
                <div className="rgd-authoring-form__advanced-section">
                  {/* US3: includeWhen */}
                  <div className="rgd-authoring-form__advanced-row">
                    <label className="rgd-authoring-form__sublabel">includeWhen</label>
                    <div className="rgd-authoring-form__cel-wrap">
                      <input
                        type="text"
                        className="rgd-authoring-form__input rgd-authoring-form__input--cel"
                        placeholder="${schema.spec.monitoring}"
                        value={res.includeWhen ?? ''}
                        onChange={(e) =>
                          updateResource(res._key, { includeWhen: e.target.value })
                        }
                        data-testid={`resource-include-when-${res._key}`}
                        aria-label="includeWhen CEL expression"
                      />
                      <span className="rgd-authoring-form__cel-badge">CEL</span>
                    </div>
                  </div>

                  {/* US4: readyWhen repeatable rows */}
                  <div className="rgd-authoring-form__advanced-row">
                    <label className="rgd-authoring-form__sublabel">readyWhen</label>
                    <div className="rgd-authoring-form__readywhen-rows">
                      {(res.readyWhen ?? []).map((rw, i) => (
                        <div key={i} className="rgd-authoring-form__readywhen-row">
                          <div className="rgd-authoring-form__cel-wrap">
                            <input
                              type="text"
                              className="rgd-authoring-form__input rgd-authoring-form__input--cel"
                              placeholder={`\${${res.id || 'resource'}.status.ready}`}
                              value={rw}
                              onChange={(e) => updateReadyWhen(res._key, i, e.target.value)}
                              data-testid={`readywhen-expr-${res._key}-${i}`}
                              aria-label={`readyWhen expression ${i + 1}`}
                            />
                            <span className="rgd-authoring-form__cel-badge">CEL</span>
                          </div>
                          <button
                            type="button"
                            className="rgd-authoring-form__remove-btn"
                            onClick={() => removeReadyWhen(res._key, i)}
                            data-testid={`readywhen-remove-${res._key}-${i}`}
                            aria-label="Remove readyWhen"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="rgd-authoring-form__add-btn rgd-authoring-form__add-btn--sm"
                        onClick={() => addReadyWhen(res._key)}
                        data-testid={`readywhen-add-${res._key}`}
                      >
                        + Add readyWhen
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
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
