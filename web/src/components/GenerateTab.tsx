// GenerateTab.tsx — Top-level Generate tab for RGD detail page.
//
// Owns mode state (form / batch) and derived YAML for each mode.
// Renders the active mode's input component + YAMLPreview side-by-side.
//
// The "New RGD" mode was removed in spec 042-rgd-designer-nav — use the
// top-level /author route ("RGD Designer" in the nav) instead.
//
// Spec: .specify/specs/026-rgd-yaml-generator/ FR-001, FR-011, FR-012

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { K8sObject } from '@/lib/api'
import { buildSchemaDoc } from '@/lib/schema'
import {
  kindToSlug,
  generateInstanceYAML,
  generateBatchYAML,
} from '@/lib/generator'
import type {
  InstanceFormState,
} from '@/lib/generator'
import InstanceForm from '@/components/InstanceForm'
import BatchForm from '@/components/BatchForm'
import YAMLPreview from '@/components/YAMLPreview'
import './GenerateTab.css'

export interface GenerateTabProps {
  rgd: K8sObject
}

type GenerateMode = 'form' | 'batch'

/** Build default InstanceFormState from a SchemaDoc. */
function buildInitialFormState(
  schema: ReturnType<typeof buildSchemaDoc>,
): InstanceFormState {
  const slug = kindToSlug(schema.kind)
  const metadataName = slug ? `my-${slug}` : 'my-resource'
  const fields = schema.specFields.map((field) => {
    const pt = field.parsedType
    const isArray = pt?.type === 'array'
    // Use key-existence check for default detection (issue #61 guard)
    const hasDefault = 'default' in (pt ?? {})
    const defaultVal = hasDefault ? (pt!.default ?? '') : ''

    // For map/object types with no explicit default, use '{}' as the
    // placeholder — an empty string would produce `labels: ""` in the manifest
    // which is invalid YAML for a map field. Using '{}' is the correct
    // empty-map YAML literal. See: fix/schema-object-type-generate.
    const isMap = pt?.type === 'map' || pt?.type === 'object'
    const initValue = isArray ? '' : isMap && !hasDefault ? '{}' : defaultVal

    return {
      name: field.name,
      value: initValue,
      items: [],
      isArray,
    }
  })
  return { metadataName, fields }
}

/**
 * GenerateTab — two YAML generation modes on the RGD detail page.
 *
 * Modes:
 *   "form"  — per-field interactive instance form
 *   "batch" — textarea batch generator
 */
export default function GenerateTab({ rgd }: GenerateTabProps) {
  const schema = useMemo(() => buildSchemaDoc(rgd), [rgd])

  // ── Mode state ───────────────────────────────────────────────────────────
  const [mode, setMode] = useState<GenerateMode>('form')

  // ── Form mode state ──────────────────────────────────────────────────────
  const [formState, setFormState] = useState<InstanceFormState>(() =>
    buildInitialFormState(schema),
  )

  // ── Batch mode state ─────────────────────────────────────────────────────
  const [batchText, setBatchText] = useState('')
  const { yaml: batchYaml, rows: batchRows } = useMemo(
    () => generateBatchYAML(batchText, schema),
    [batchText, schema],
  )

  // ── Derived YAML for form mode ───────────────────────────────────────────
  const formYaml = useMemo(
    () => generateInstanceYAML(schema, formState),
    [schema, formState],
  )

  return (
    <div className="generate-tab" data-testid="generate-tab">
      {/* Mode switcher */}
      <div className="generate-tab__mode-bar" role="group" aria-label="Generation mode">
        <button
          type="button"
          data-testid="mode-btn-form"
          className={`generate-tab__mode-btn${mode === 'form' ? ' generate-tab__mode-btn--active' : ''}`}
          onClick={() => setMode('form')}
          aria-pressed={mode === 'form'}
        >
          Instance Form
        </button>
        <button
          type="button"
          data-testid="mode-btn-batch"
          className={`generate-tab__mode-btn${mode === 'batch' ? ' generate-tab__mode-btn--active' : ''}`}
          onClick={() => setMode('batch')}
          aria-pressed={mode === 'batch'}
        >
          Batch
        </button>
      </div>

      {/* Two-column layout: input left, preview right */}
      <div className="generate-tab__body">
        <div className="generate-tab__input-pane">
          {mode === 'form' && (
            <InstanceForm schema={schema} state={formState} onChange={setFormState} />
          )}
          {mode === 'batch' && (
            <BatchForm
              schema={schema}
              batchText={batchText}
              onBatchTextChange={setBatchText}
              rows={batchRows}
            />
          )}
          <p className="generate-tab__designer-hint">
            Authoring a new RGD?{' '}
            <Link to="/author">Open RGD Designer →</Link>
          </p>
        </div>

        <div className="generate-tab__preview-pane">
          {mode === 'form' && (
            <YAMLPreview yaml={formYaml} title="Instance Manifest" />
          )}
          {mode === 'batch' && (
            <YAMLPreview yaml={batchYaml} title="Batch Manifests" />
          )}
        </div>
      </div>
    </div>
  )
}
