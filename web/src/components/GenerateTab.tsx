// GenerateTab.tsx — Top-level Generate tab for RGD detail page.
//
// Owns mode state (form / batch / rgd) and derived YAML for each mode.
// Renders the active mode's input component + YAMLPreview side-by-side.
//
// Spec: .specify/specs/026-rgd-yaml-generator/ FR-001, FR-011, FR-012

import { useState, useMemo } from 'react'
import type { K8sObject } from '@/lib/api'
import { buildSchemaDoc } from '@/lib/schema'
import {
  kindToSlug,
  generateInstanceYAML,
  generateBatchYAML,
  generateRGDYAML,
} from '@/lib/generator'
import type {
  InstanceFormState,
  RGDAuthoringState,
} from '@/lib/generator'
import InstanceForm from '@/components/InstanceForm'
import BatchForm from '@/components/BatchForm'
import RGDAuthoringForm from '@/components/RGDAuthoringForm'
import YAMLPreview from '@/components/YAMLPreview'
import './GenerateTab.css'

export interface GenerateTabProps {
  rgd: K8sObject
}

type GenerateMode = 'form' | 'batch' | 'rgd'

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
    const defaultVal = ('default' in (pt ?? {})) ? (pt!.default ?? '') : ''
    return {
      name: field.name,
      value: isArray ? '' : defaultVal,
      items: [],
      isArray,
    }
  })
  return { metadataName, fields }
}

/** Default starter state for RGD authoring. */
const STARTER_RGD_STATE: RGDAuthoringState = {
  rgdName: 'my-app',
  kind: 'MyApp',
  group: 'kro.run',
  apiVersion: 'v1alpha1',
  specFields: [],
  resources: [{ id: 'web', apiVersion: 'apps/v1', kind: 'Deployment' }],
}

/**
 * GenerateTab — three YAML generation modes on the RGD detail page.
 *
 * Modes:
 *   "form"  — per-field interactive instance form (US1)
 *   "batch" — textarea batch generator (US2)
 *   "rgd"   — guided RGD authoring scaffolder (US3)
 */
export default function GenerateTab({ rgd }: GenerateTabProps) {
  const schema = useMemo(() => buildSchemaDoc(rgd), [rgd])

  // ── Mode state ───────────────────────────────────────────────────────────
  const [mode, setMode] = useState<GenerateMode>('form')

  // ── Form mode state (US1) ────────────────────────────────────────────────
  const [formState, setFormState] = useState<InstanceFormState>(() =>
    buildInitialFormState(schema),
  )

  // ── Batch mode state (US2) ───────────────────────────────────────────────
  const [batchText, setBatchText] = useState('')
  const { yaml: batchYaml, rows: batchRows } = useMemo(
    () => generateBatchYAML(batchText, schema),
    [batchText, schema],
  )

  // ── RGD authoring state (US3) ────────────────────────────────────────────
  const [rgdState, setRgdState] = useState<RGDAuthoringState>(STARTER_RGD_STATE)

  // ── Derived YAML for form mode ───────────────────────────────────────────
  const formYaml = useMemo(
    () => generateInstanceYAML(schema, formState),
    [schema, formState],
  )

  // ── Derived YAML for RGD authoring ──────────────────────────────────────
  const rgdYaml = useMemo(() => generateRGDYAML(rgdState), [rgdState])

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
        <button
          type="button"
          data-testid="mode-btn-rgd"
          className={`generate-tab__mode-btn${mode === 'rgd' ? ' generate-tab__mode-btn--active' : ''}`}
          onClick={() => setMode('rgd')}
          aria-pressed={mode === 'rgd'}
        >
          New RGD
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
          {mode === 'rgd' && (
            <RGDAuthoringForm state={rgdState} onChange={setRgdState} />
          )}
        </div>

        <div className="generate-tab__preview-pane">
          {mode === 'form' && (
            <YAMLPreview yaml={formYaml} title="Instance Manifest" />
          )}
          {mode === 'batch' && (
            <YAMLPreview yaml={batchYaml} title="Batch Manifests" />
          )}
          {mode === 'rgd' && (
            <YAMLPreview yaml={rgdYaml} title="ResourceGraphDefinition" />
          )}
        </div>
      </div>
    </div>
  )
}
