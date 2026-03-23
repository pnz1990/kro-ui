// generator.ts — RGD YAML generator: pure functions for instance, batch, and RGD authoring.
//
// All functions are pure (no React dependencies, no side effects).
// Reuses SchemaDoc / ParsedField from spec 020-schema-doc-generator.
//
// Spec: .specify/specs/026-rgd-yaml-generator/

import type { SchemaDoc } from '@/lib/schema'
import { toYaml } from '@/lib/yaml'

// ── Types ─────────────────────────────────────────────────────────────────

/** Runtime form state for one spec field in the instance form. */
export interface FieldValue {
  /** Field name (matches ParsedField.name). */
  name: string
  /** Scalar value — used when isArray === false. */
  value: string
  /** Array items — used when isArray === true. */
  items: string[]
  /** True when the field is an array type (parsedType.type === 'array'). */
  isArray: boolean
}

/** Complete form state for instance manifest generation. */
export interface InstanceFormState {
  /** Value for metadata.name. Pre-filled with my-<kind-slug>. */
  metadataName: string
  /** One entry per SchemaDoc.specFields item. */
  fields: FieldValue[]
}

/** A parsed line from the batch mode textarea. */
export interface BatchRow {
  /** Key-value pairs extracted from the line. */
  values: Record<string, string>
  /** Non-null when the line contained a malformed token. */
  error: string | undefined
  /** 0-based line index. */
  index: number
}

/** A user-defined spec field in the RGD authoring form. */
export interface AuthoringField {
  /** Unique row key (e.g. nanoid or index-based string). */
  id: string
  /** Field name in spec.schema.spec. */
  name: string
  /** SimpleSchema base type: 'string' | 'integer' | 'boolean' | '[]string' | etc. */
  type: string
  /** Default value — empty string means no default (required field). */
  defaultValue: string
  /** If true, appends '| required' modifier instead of '| default=X'. */
  required: boolean
}

/** A resource template entry in the RGD authoring form. */
export interface AuthoringResource {
  /** Stable internal React key — never exposed in the UI or in generated YAML. */
  _key: string
  /** User-editable resource id in spec.resources[]. */
  id: string
  /** Template resource apiVersion (e.g. 'apps/v1'). */
  apiVersion: string
  /** Template resource kind (e.g. 'Deployment'). */
  kind: string
}

/** Complete state for the RGD authoring scaffolding form. */
export interface RGDAuthoringState {
  /** metadata.name for the ResourceGraphDefinition. */
  rgdName: string
  /** spec.schema.kind — the user-defined CR kind. */
  kind: string
  /** spec.schema.group (default: 'kro.run'). */
  group: string
  /** spec.schema.apiVersion (default: 'v1alpha1'). */
  apiVersion: string
  /** Spec fields to include in spec.schema.spec. */
  specFields: AuthoringField[]
  /** Resource templates to scaffold in spec.resources[]. */
  resources: AuthoringResource[]
}

// ── kindToSlug ────────────────────────────────────────────────────────────

/**
 * Convert a PascalCase kind string to a lowercase-hyphenated slug.
 *
 * Examples:
 *   "WebApplication" → "web-application"
 *   "MyApp"          → "my-app"
 *   "ConfigMap"      → "config-map"
 *   ""               → ""
 *
 * Replicates the slug logic from ExampleYAML.tsx for consistency.
 */
export function kindToSlug(kind: string): string {
  if (!kind) return ''
  return kind
    .replace(/([A-Z])/g, (match, _, offset: number) =>
      offset === 0 ? match.toLowerCase() : `-${match.toLowerCase()}`,
    )
    .replace(/^-/, '')
}

// ── parseBatchRow ─────────────────────────────────────────────────────────

/**
 * Parse a single batch input line into a key-value map.
 *
 * Line format: space-separated key=value tokens.
 * First '=' in each token is the key/value delimiter.
 * Tokens with no key (eqIdx <= 0) are skipped and produce an error message.
 *
 * Empty line → { values: {}, error: undefined, index }
 */
export function parseBatchRow(line: string, index: number): BatchRow {
  const trimmed = line.trim()
  if (!trimmed) return { values: {}, error: undefined, index }

  const result: Record<string, string> = {}
  let error: string | undefined
  const tokens = trimmed.split(/\s+/)

  for (const token of tokens) {
    const eqIdx = token.indexOf('=')
    if (eqIdx <= 0) {
      error = `malformed token "${token}" — expected key=value`
      continue
    }
    const key = token.slice(0, eqIdx)
    const value = token.slice(eqIdx + 1)
    result[key] = value
  }

  return { values: result, error, index }
}

// ── generateInstanceYAML ──────────────────────────────────────────────────

/**
 * Generate a Kubernetes instance manifest YAML string from a SchemaDoc
 * and current InstanceFormState.
 *
 * - Uses toYaml() for value serialization
 * - Omits the spec section entirely when there are no spec fields
 * - Converts boolean string values ("true"/"false") to actual booleans
 * - Converts integer/number string values to Number (when non-empty)
 * - Array fields become YAML list blocks (string[])
 */
export function generateInstanceYAML(
  schema: SchemaDoc,
  state: InstanceFormState,
): string {
  const { kind, apiVersion, group } = schema
  const specObj: Record<string, unknown> = {}

  for (const fv of state.fields) {
    const field = schema.specFields.find((f) => f.name === fv.name)
    const pt = field?.parsedType
    const type = pt?.type ?? 'string'

    if (fv.isArray) {
      specObj[fv.name] = fv.items
    } else if (type === 'boolean') {
      specObj[fv.name] = fv.value === 'true'
    } else if ((type === 'integer' || type === 'number') && fv.value !== '') {
      specObj[fv.name] = Number(fv.value)
    } else {
      specObj[fv.name] = fv.value
    }
  }

  const obj: Record<string, unknown> = {
    apiVersion: `${group}/${apiVersion}`,
    kind,
    metadata: { name: state.metadataName || `my-${kindToSlug(kind)}` || 'my-resource' },
  }

  if (state.fields.length > 0) {
    obj.spec = specObj
  }

  return toYaml(obj)
}

// ── generateBatchYAML ─────────────────────────────────────────────────────

/**
 * Generate a multi-document YAML string from a batch textarea value.
 *
 * Each non-empty line becomes one YAML document separated by '---\n'.
 * Missing field values fall back to schema defaults, then to empty string.
 * Malformed rows are skipped; their errors are surfaced via the returned rows[].
 */
export function generateBatchYAML(
  batchText: string,
  schema: SchemaDoc,
): { yaml: string; rows: BatchRow[] } {
  if (!batchText.trim()) return { yaml: '', rows: [] }

  const lines = batchText.split('\n')
  const rows: BatchRow[] = lines.map((line, idx) => parseBatchRow(line, idx))

  const docs: string[] = []
  for (const row of rows) {
    if (!Object.keys(row.values).length && !row.error) continue // empty line

    // Build InstanceFormState from batch row values, falling back to schema defaults
    const fields: FieldValue[] = schema.specFields.map((field) => {
      const pt = field.parsedType
      const isArray = pt?.type === 'array'
      const defaultVal = ('default' in (pt ?? {})) ? (pt!.default ?? '') : ''
      const batchVal = row.values[field.name] ?? defaultVal

      return {
        name: field.name,
        value: isArray ? '' : batchVal,
        items: isArray ? (batchVal ? [batchVal] : []) : [],
        isArray,
      }
    })

    // Derive metadata.name from batch row or default
    const metadataName =
      row.values['name'] ??
      row.values['metadata.name'] ??
      `my-${kindToSlug(schema.kind) || 'resource'}`

    const state: InstanceFormState = { metadataName, fields }
    docs.push(generateInstanceYAML(schema, state))
  }

  return {
    yaml: docs.join('\n---\n'),
    rows,
  }
}

// ── generateRGDYAML ───────────────────────────────────────────────────────

/**
 * Generate a ResourceGraphDefinition YAML scaffold from authoring form state.
 *
 * Uses string construction (NOT toYaml) to preserve CEL ${...} placeholders
 * as-is in resource template metadata fields.
 *
 * Produces valid kro.run/v1alpha1 ResourceGraphDefinition YAML.
 */
export function generateRGDYAML(state: RGDAuthoringState): string {
  const { rgdName, kind, group, apiVersion, specFields, resources } = state

  const lines: string[] = [
    'apiVersion: kro.run/v1alpha1',
    'kind: ResourceGraphDefinition',
    'metadata:',
    `  name: ${rgdName || 'my-rgd'}`,
    'spec:',
    '  schema:',
    `    apiVersion: ${apiVersion || 'v1alpha1'}`,
    `    kind: ${kind || 'MyApp'}`,
  ]

  if (specFields.length > 0) {
    lines.push('    spec:')
    for (const field of specFields) {
      const typeStr = buildSimpleSchemaStr(field)
      lines.push(`      ${field.name || 'field'}: "${typeStr}"`)
    }
  }

  if (resources.length > 0) {
    lines.push('  resources:')
    for (const res of resources) {
      const resId = res.id || 'resource'
      lines.push(`    - id: ${resId}`)
      lines.push('      template:')
      lines.push(`        apiVersion: ${res.apiVersion || 'apps/v1'}`)
      lines.push(`        kind: ${res.kind || 'Deployment'}`)
      lines.push('        metadata:')
      lines.push(`          name: \${schema.metadata.name}-${resId}`)
      lines.push('          namespace: ${schema.metadata.namespace}')
      lines.push('        spec: {}')
    }
  }

  // Add group annotation if non-default
  if (group && group !== 'kro.run') {
    // Insert group under schema (after apiVersion line)
    const schemaApiIdx = lines.findIndex((l) => l.includes('    apiVersion:'))
    if (schemaApiIdx !== -1) {
      lines.splice(schemaApiIdx + 1, 0, `    group: ${group}`)
    }
  }

  return lines.join('\n')
}

/** Build a SimpleSchema type string from an AuthoringField. */
function buildSimpleSchemaStr(field: AuthoringField): string {
  const base = field.type || 'string'
  if (field.required) return `${base} | required`
  if (field.defaultValue !== '') return `${base} | default=${field.defaultValue}`
  return base
}
