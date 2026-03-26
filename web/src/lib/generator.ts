// generator.ts — RGD YAML generator: pure functions for instance, batch, and RGD authoring.
//
// All functions are pure (no React dependencies, no side effects).
// Reuses SchemaDoc / ParsedField from spec 020-schema-doc-generator.
//
// Spec: .specify/specs/044-rgd-designer-full-features/

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
  // NEW: optional constraint fields (spec 044)
  /** Comma-separated allowed values, e.g. "dev,staging,prod". Applies to string type. */
  enum?: string
  /** Numeric minimum (stored as string, empty = absent). Applies to integer/number. */
  minimum?: string
  /** Numeric maximum (stored as string, empty = absent). Applies to integer/number. */
  maximum?: string
  /** Regex pattern string, empty = absent. Applies to string type. */
  pattern?: string
}

/** A user-defined status field in the RGD authoring form. Spec 044. */
export interface AuthoringStatusField {
  /** Stable React key. */
  id: string
  /** Status field name (key in spec.schema.status). */
  name: string
  /** CEL expression string, including ${...} wrapper. */
  expression: string
}

/** A single iterator entry in a forEach collection resource. Spec 044. */
export interface ForEachIterator {
  /** Stable React key. */
  _key: string
  /** Iterator variable name (YAML key in the forEach entry). */
  variable: string
  /** CEL expression that evaluates to an array. */
  expression: string
}

/** External reference configuration for a resource in externalRef mode. Spec 044. */
export interface AuthoringExternalRef {
  apiVersion: string
  kind: string
  /** Optional namespace; empty = omit from YAML. */
  namespace: string
  /** For scalar refs: name of the resource. Mutually exclusive with selectorLabels. */
  name: string
  /** For collection refs: matchLabels entries. Mutually exclusive with name. */
  selectorLabels: { _key: string; labelKey: string; labelValue: string }[]
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
  // NEW fields (spec 044):
  /** Resource type toggle. Default: 'managed'. */
  resourceType: 'managed' | 'forEach' | 'externalRef'
  /**
   * Raw YAML string for the template body (everything below `template:`).
   * CEL expressions are preserved verbatim.
   * Empty string → fall back to 'spec: {}' in generated YAML.
   */
  templateYaml: string
  /**
   * includeWhen CEL expression (single entry).
   * Empty string → omit includeWhen from generated YAML.
   */
  includeWhen: string
  /** readyWhen CEL expressions. Empty entries are filtered before serialization. */
  readyWhen: string[]
  /** forEach iterators. Only used when resourceType === 'forEach'. */
  forEachIterators: ForEachIterator[]
  /** External ref config. Only used when resourceType === 'externalRef'. */
  externalRef: AuthoringExternalRef
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
  /** NEW: CRD scope. Default 'Namespaced' emits no scope key in YAML. Spec 044. */
  scope: 'Namespaced' | 'Cluster'
  /** Spec fields to include in spec.schema.spec. */
  specFields: AuthoringField[]
  /** NEW: Status field definitions. Spec 044. */
  statusFields: AuthoringStatusField[]
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

// ── buildSimpleSchemaStr ──────────────────────────────────────────────────

/**
 * Build a SimpleSchema type string from an AuthoringField.
 *
 * Extended in spec 044 to append constraint modifiers:
 *   'string | enum=dev,staging,prod'
 *   'integer | default=3 minimum=1 maximum=100'
 *   'string | required pattern=^[a-z]+'
 *
 * Order: base type, then required/default=, then minimum=, maximum=, enum=, pattern=
 */
export function buildSimpleSchemaStr(field: AuthoringField): string {
  const base = field.type || 'string'
  const parts: string[] = [base]

  if (field.required) {
    parts.push('required')
  } else if (field.defaultValue !== '') {
    parts.push(`default=${field.defaultValue}`)
  }

  if (field.minimum && field.minimum !== '') {
    parts.push(`minimum=${field.minimum}`)
  }
  if (field.maximum && field.maximum !== '') {
    parts.push(`maximum=${field.maximum}`)
  }
  if (field.enum && field.enum !== '') {
    parts.push(`enum=${field.enum}`)
  }
  if (field.pattern && field.pattern !== '') {
    parts.push(`pattern=${field.pattern}`)
  }

  return parts.join(' | ')
}

// ── generateRGDYAML ───────────────────────────────────────────────────────

/**
 * Generate a ResourceGraphDefinition YAML scaffold from authoring form state.
 *
 * Uses string construction (NOT toYaml) to preserve CEL ${...} placeholders
 * as-is in resource template metadata fields.
 *
 * Produces valid kro.run/v1alpha1 ResourceGraphDefinition YAML.
 *
 * Extended in spec 044 to emit: scope, statusFields, includeWhen, readyWhen,
 * forEach, externalRef, templateYaml body, and spec field constraints.
 */
export function generateRGDYAML(state: RGDAuthoringState): string {
  const { rgdName, kind, group, apiVersion, scope, specFields, statusFields, resources } = state

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

  // Emit scope: Cluster when non-default (T008)
  if (scope === 'Cluster') {
    lines.push('    scope: Cluster')
  }

  if (specFields.length > 0) {
    lines.push('    spec:')
    for (const field of specFields) {
      const typeStr = buildSimpleSchemaStr(field)
      lines.push(`      ${field.name || 'field'}: "${typeStr}"`)
    }
  }

  // Emit status block from statusFields (T009)
  const validStatusFields = (statusFields ?? []).filter((sf) => sf.name && sf.expression)
  if (validStatusFields.length > 0) {
    lines.push('    status:')
    for (const sf of validStatusFields) {
      lines.push(`      ${sf.name}: ${sf.expression}`)
    }
  }

  if (resources.length > 0) {
    lines.push('  resources:')
    for (const res of resources) {
      const resId = res.id || 'resource'
      lines.push(`    - id: ${resId}`)

      if (res.resourceType === 'externalRef') {
        // T013: externalRef block — no template
        const ref = res.externalRef
        lines.push('      externalRef:')
        lines.push(`        apiVersion: ${ref.apiVersion || 'v1'}`)
        lines.push(`        kind: ${ref.kind || 'ConfigMap'}`)
        lines.push('        metadata:')

        // Determine scalar vs collection
        const useSelector = ref.selectorLabels.length > 0 && !ref.name
        if (ref.namespace) {
          lines.push(`          namespace: ${ref.namespace}`)
        }
        if (!useSelector && ref.name) {
          lines.push(`          name: ${ref.name}`)
        }
        if (useSelector) {
          lines.push('          selector:')
          lines.push('            matchLabels:')
          for (const label of ref.selectorLabels) {
            if (label.labelKey) {
              lines.push(`              ${label.labelKey}: ${label.labelValue}`)
            }
          }
        }
      } else {
        // managed or forEach

        // T010: includeWhen before template (when non-empty)
        if (res.includeWhen && res.includeWhen.trim()) {
          lines.push('      includeWhen:')
          lines.push(`        - ${res.includeWhen.trim()}`)
        }

        // T010: readyWhen before template (when non-empty entries)
        const validReadyWhen = (res.readyWhen ?? []).filter((rw) => rw.trim())
        if (validReadyWhen.length > 0) {
          lines.push('      readyWhen:')
          for (const rw of validReadyWhen) {
            lines.push(`        - ${rw.trim()}`)
          }
        }

        // T012: forEach array before template for forEach-mode resources
        if (res.resourceType === 'forEach') {
          const validIterators = (res.forEachIterators ?? []).filter(
            (it) => it.variable && it.expression,
          )
          if (validIterators.length > 0) {
            lines.push('      forEach:')
            for (const it of validIterators) {
              lines.push(`        - ${it.variable}: ${it.expression}`)
            }
          }
        }

        // Template block
        lines.push('      template:')
        lines.push(`        apiVersion: ${res.apiVersion || 'apps/v1'}`)
        lines.push(`        kind: ${res.kind || 'Deployment'}`)

        // T011: inject templateYaml body or default metadata + spec
        const tmpl = res.templateYaml ?? ''
        if (tmpl.trim()) {
          // If templateYaml already contains metadata: inject raw, else prepend defaults
          if (/^\s*metadata\s*:/m.test(tmpl)) {
            // User provided metadata — inject verbatim (8-space indent)
            const indented = tmpl
              .split('\n')
              .map((line) => `        ${line}`)
              .join('\n')
            lines.push(indented)
          } else {
            // Prepend default metadata lines then inject the body
            lines.push('        metadata:')
            lines.push(`          name: \${schema.metadata.name}-${resId}`)
            lines.push('          namespace: ${schema.metadata.namespace}')
            const indented = tmpl
              .split('\n')
              .map((line) => `        ${line}`)
              .join('\n')
            lines.push(indented)
          }
        } else {
          // Empty templateYaml — emit default metadata + spec: {}
          lines.push('        metadata:')
          lines.push(`          name: \${schema.metadata.name}-${resId}`)
          lines.push('          namespace: ${schema.metadata.namespace}')
          lines.push('        spec: {}')
        }
      }
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

// ── STARTER_RGD_STATE ─────────────────────────────────────────────────────

/**
 * Default starter state for RGD authoring.
 *
 * Updated in spec 044 to include new fields with sensible defaults.
 */
export const STARTER_RGD_STATE: RGDAuthoringState = {
  rgdName: 'my-app',
  kind: 'MyApp',
  group: 'kro.run',
  apiVersion: 'v1alpha1',
  scope: 'Namespaced',
  specFields: [],
  statusFields: [],
  resources: [
    {
      _key: 'starter-web',
      id: 'web',
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      resourceType: 'managed',
      templateYaml: '',
      includeWhen: '',
      readyWhen: [],
      forEachIterators: [{ _key: 'fe-0', variable: '', expression: '' }],
      externalRef: {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        namespace: '',
        name: '',
        selectorLabels: [],
      },
    },
  ],
}

// ── rgdAuthoringStateToSpec ───────────────────────────────────────────────

/**
 * Convert RGDAuthoringState to a kro RGD spec object for DAG preview.
 *
 * Extended in spec 044 to correctly map all 5 kro node types:
 *   - managed → template with _raw passthrough
 *   - forEach → template + forEach array
 *   - externalRef → externalRef object (no template)
 *   - includeWhen/readyWhen forwarded on any resource type
 *
 * Called by AuthorPage's live DAG preview (debounced at 300ms).
 * Pure function — never throws; filters incomplete resources and fields.
 */
export function rgdAuthoringStateToSpec(
  state: RGDAuthoringState,
): Record<string, unknown> {
  const schemaSpec: Record<string, string> = {}
  for (const f of state.specFields) {
    if (f.name) schemaSpec[f.name] = f.type || 'string'
  }

  const resources = state.resources
    .filter((r) => r.id)
    .map((r): Record<string, unknown> => {
      // T015: externalRef mode — no template
      if (r.resourceType === 'externalRef') {
        const ref = r.externalRef
        const useSelector = ref.selectorLabels.length > 0 && !ref.name
        const metadata: Record<string, unknown> = {}
        if (ref.namespace) metadata.namespace = ref.namespace
        if (!useSelector && ref.name) {
          metadata.name = ref.name
        }
        if (useSelector) {
          const matchLabels: Record<string, string> = {}
          for (const lbl of ref.selectorLabels) {
            if (lbl.labelKey) matchLabels[lbl.labelKey] = lbl.labelValue
          }
          metadata.selector = { matchLabels }
        }
        return {
          id: r.id,
          externalRef: {
            apiVersion: ref.apiVersion || 'v1',
            kind: ref.kind || 'ConfigMap',
            metadata,
          },
        }
      }

      // T014: forEach mode
      // T016: managed mode with includeWhen / readyWhen / templateYaml
      const entry: Record<string, unknown> = {
        id: r.id,
        template: {
          apiVersion: r.apiVersion || 'apps/v1',
          kind: r.kind || 'Deployment',
          metadata: { name: '' },
          spec: {},
          // Pass raw template YAML string so walkTemplate can extract CEL expressions (T016)
          ...(r.templateYaml ? { _raw: r.templateYaml } : {}),
        },
      }

      // T014: forEach iterators
      if (r.resourceType === 'forEach') {
        const validIterators = (r.forEachIterators ?? []).filter(
          (it) => it.variable && it.expression,
        )
        if (validIterators.length > 0) {
          entry.forEach = validIterators.map((it) => ({ [it.variable]: it.expression }))
        }
      }

      // T016: includeWhen
      if (r.includeWhen && r.includeWhen.trim()) {
        entry.includeWhen = [r.includeWhen.trim()]
      }

      // T016: readyWhen
      const validReadyWhen = (r.readyWhen ?? []).filter((rw) => rw.trim())
      if (validReadyWhen.length > 0) {
        entry.readyWhen = validReadyWhen
      }

      return entry
    })

  return {
    schema: {
      kind: state.kind || 'MyApp',
      apiVersion: state.apiVersion || 'v1alpha1',
      ...(Object.keys(schemaSpec).length > 0 ? { spec: schemaSpec } : {}),
    },
    resources,
  }
}
