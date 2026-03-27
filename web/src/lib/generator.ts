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

// ── Validation types (spec 045) ───────────────────────────────────────────

/**
 * A single validation issue attached to a specific form field.
 *
 * type: 'error' = definite problem (required field missing, etc.)
 *       'warning' = advisory (format hint, constraint inconsistency, etc.)
 */
export interface ValidationIssue {
  type: 'error' | 'warning'
  /** Human-readable message shown beneath the affected input. */
  message: string
}

/**
 * Complete validation state derived from RGDAuthoringState.
 *
 * All records are keyed by the stable React key of the affected row:
 *   - resourceIssues:    keyed by AuthoringResource._key
 *   - specFieldIssues:   keyed by AuthoringField.id
 *   - statusFieldIssues: keyed by AuthoringStatusField.id
 *
 * Invariant:
 *   totalCount === (rgdName ? 1 : 0) + (kind ? 1 : 0)
 *                + Object.keys(resourceIssues).length
 *                + Object.keys(specFieldIssues).length
 *                + Object.keys(statusFieldIssues).length
 */
export interface ValidationState {
  /** Issue on the rgdName metadata field (required or DNS subdomain format). */
  rgdName?: ValidationIssue
  /** Issue on the kind metadata field (required or PascalCase format). */
  kind?: ValidationIssue
  /** Per-resource issues keyed by AuthoringResource._key.
   *  Covers: duplicate ID, forEach-no-iterator. */
  resourceIssues: Record<string, ValidationIssue>
  /** Per-spec-field issues keyed by AuthoringField.id.
   *  Covers: duplicate name, minimum > maximum. */
  specFieldIssues: Record<string, ValidationIssue>
  /** Per-status-field issues keyed by AuthoringStatusField.id.
   *  Covers: duplicate name. */
  statusFieldIssues: Record<string, ValidationIssue>
  /** Total count of all issues across all fields. Drives the summary badge. */
  totalCount: number
}

// ── validateRGDState ──────────────────────────────────────────────────────

/** RFC 1123 DNS subdomain: lowercase alphanumeric and single hyphens, dots for subdomain parts.
 * Each label: starts/ends with alphanumeric, no consecutive hyphens. */
const DNS_SUBDOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?))*$/

/** Returns true if the string contains consecutive hyphens (--). */
function hasConsecutiveHyphens(s: string): boolean {
  return s.includes('--')
}

/** Kubernetes kind PascalCase: starts with uppercase, followed by alphanumeric. */
const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/

/**
 * Derive a ValidationState from RGDAuthoringState.
 *
 * Pure function — never throws, never mutates the input.
 * STARTER_RGD_STATE always produces { totalCount: 0 } (no false positives on load).
 *
 * Validation rules:
 *   1. rgdName: required (error) → DNS subdomain format (warning)
 *   2. kind: required (error) → PascalCase format (warning)
 *   3. Duplicate resource IDs (non-empty ids appearing > 1 time) → warning
 *   4. forEach resource with no valid iterator → warning
 *      (duplicate ID takes priority on same resource _key)
 *   5. Duplicate spec field names (non-empty) → warning
 *   6. Spec field minimum > maximum (when both set) → warning
 *      (skipped if field already has a duplicate-name issue)
 *   7. Duplicate status field names (non-empty) → warning
 *
 * Spec: .specify/specs/045-rgd-designer-validation-optimizer/
 */
export function validateRGDState(state: RGDAuthoringState): ValidationState {
  const resourceIssues: Record<string, ValidationIssue> = {}
  const specFieldIssues: Record<string, ValidationIssue> = {}
  const statusFieldIssues: Record<string, ValidationIssue> = {}
  let rgdNameIssue: ValidationIssue | undefined
  let kindIssue: ValidationIssue | undefined

  // ── 1. rgdName ──────────────────────────────────────────────────────────
  if (!state.rgdName) {
    rgdNameIssue = { type: 'error', message: 'RGD name is required' }
  } else if (!DNS_SUBDOMAIN_RE.test(state.rgdName) || hasConsecutiveHyphens(state.rgdName)) {
    rgdNameIssue = {
      type: 'warning',
      message: 'RGD name should be a valid DNS subdomain (lowercase alphanumeric and hyphens)',
    }
  }

  // ── 2. kind ─────────────────────────────────────────────────────────────
  if (!state.kind) {
    kindIssue = { type: 'error', message: 'Kind is required' }
  } else if (!PASCAL_CASE_RE.test(state.kind)) {
    kindIssue = {
      type: 'warning',
      message: 'Kind should be PascalCase (e.g. WebApp, MyService)',
    }
  }

  // ── 3. Duplicate resource IDs ────────────────────────────────────────────
  const idFreq: Record<string, number> = {}
  for (const res of state.resources) {
    if (res.id) {
      idFreq[res.id] = (idFreq[res.id] ?? 0) + 1
    }
  }
  for (const res of state.resources) {
    if (res.id && (idFreq[res.id] ?? 0) > 1) {
      resourceIssues[res._key] = { type: 'warning', message: 'Duplicate resource ID' }
    }
  }

  // ── 4. forEach-no-iterator ───────────────────────────────────────────────
  for (const res of state.resources) {
    // Duplicate ID takes priority — skip if already has an issue
    if (resourceIssues[res._key]) continue
    if (res.resourceType === 'forEach') {
      const validIterators = (res.forEachIterators ?? []).filter(
        (it) => it.variable.trim() && it.expression.trim(),
      )
      if (validIterators.length === 0) {
        resourceIssues[res._key] = {
          type: 'warning',
          message: 'forEach resources require at least one iterator',
        }
      }
    }
  }

  // ── 5. Duplicate spec field names ────────────────────────────────────────
  const specNameFreq: Record<string, number> = {}
  for (const field of state.specFields) {
    if (field.name) {
      specNameFreq[field.name] = (specNameFreq[field.name] ?? 0) + 1
    }
  }
  for (const field of state.specFields) {
    if (field.name && (specNameFreq[field.name] ?? 0) > 1) {
      specFieldIssues[field.id] = { type: 'warning', message: 'Duplicate spec field name' }
    }
  }

  // ── 6. min > max constraint ──────────────────────────────────────────────
  for (const field of state.specFields) {
    // Skip if field already has a duplicate-name issue
    if (specFieldIssues[field.id]) continue
    const min = field.minimum
    const max = field.maximum
    if (min && min !== '' && max && max !== '') {
      if (Number(min) > Number(max)) {
        specFieldIssues[field.id] = {
          type: 'warning',
          message: 'minimum must be \u2264 maximum',
        }
      }
    }
  }

  // ── 7. Duplicate status field names ─────────────────────────────────────
  const statusNameFreq: Record<string, number> = {}
  for (const sf of state.statusFields ?? []) {
    if (sf.name) {
      statusNameFreq[sf.name] = (statusNameFreq[sf.name] ?? 0) + 1
    }
  }
  for (const sf of state.statusFields ?? []) {
    if (sf.name && (statusNameFreq[sf.name] ?? 0) > 1) {
      statusFieldIssues[sf.id] = { type: 'warning', message: 'Duplicate status field name' }
    }
  }

  // ── 8. totalCount ────────────────────────────────────────────────────────
  const totalCount =
    (rgdNameIssue !== undefined ? 1 : 0) +
    (kindIssue !== undefined ? 1 : 0) +
    Object.keys(resourceIssues).length +
    Object.keys(specFieldIssues).length +
    Object.keys(statusFieldIssues).length

  return {
    ...(rgdNameIssue !== undefined ? { rgdName: rgdNameIssue } : {}),
    ...(kindIssue !== undefined ? { kind: kindIssue } : {}),
    resourceIssues,
    specFieldIssues,
    statusFieldIssues,
    totalCount,
  }
}

// ── parseSimpleSchemaStr (spec 045 US8) ───────────────────────────────────

/**
 * Parse a kro SimpleSchema type string back into AuthoringField-compatible fields.
 *
 * Handles the format produced by buildSimpleSchemaStr:
 *   'string | required | default=X | minimum=1 | maximum=100 | enum=a,b | pattern=^[a-z]+'
 *
 * Also handles quoted strings (surrounding double-quotes are stripped first).
 * Unknown modifier tokens are silently ignored (graceful degradation).
 *
 * Not exported — internal helper used only by parseRGDYAML.
 */
function parseSimpleSchemaStr(raw: string): {
  type: string
  required: boolean
  defaultValue: string
  minimum: string
  maximum: string
  enum: string
  pattern: string
} {
  // Strip surrounding double-quotes if present
  const s = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw

  const parts = s.split(' | ')
  const baseType = parts[0]?.trim() || 'string'

  let required = false
  let defaultValue = ''
  let minimum = ''
  let maximum = ''
  let enumVal = ''
  let pattern = ''

  for (let i = 1; i < parts.length; i++) {
    const token = parts[i].trim()
    if (token === 'required') {
      required = true
    } else if (token.startsWith('default=')) {
      defaultValue = token.slice('default='.length)
    } else if (token.startsWith('minimum=')) {
      minimum = token.slice('minimum='.length)
    } else if (token.startsWith('maximum=')) {
      maximum = token.slice('maximum='.length)
    } else if (token.startsWith('enum=')) {
      enumVal = token.slice('enum='.length)
    } else if (token.startsWith('pattern=')) {
      pattern = token.slice('pattern='.length)
    }
    // Unknown tokens are silently ignored
  }

  return { type: baseType, required, defaultValue, minimum, maximum, enum: enumVal, pattern }
}

// ── ParseResult (spec 045 US8) ────────────────────────────────────────────

/**
 * Result of parsing a ResourceGraphDefinition YAML string.
 *
 * On success: { ok: true, state: RGDAuthoringState }
 * On failure: { ok: false, error: string }
 *
 * parseRGDYAML never throws — all errors are returned as { ok: false }.
 */
export type ParseResult =
  | { ok: true; state: RGDAuthoringState }
  | { ok: false; error: string }

// ── parseRGDYAML (spec 045 US8) ───────────────────────────────────────────

/** Counter for generating stable IDs during a single parseRGDYAML call. */
let _parseCounter = 0

/** Generate a fresh field id for use during parsing. */
function freshFieldId(): string {
  return `import-f-${++_parseCounter}`
}

/** Generate a fresh resource key for use during parsing. */
function freshResKey(): string {
  return `import-r-${++_parseCounter}`
}

/** Generate a fresh iterator key for use during parsing. */
function freshIterKey(): string {
  return `import-i-${++_parseCounter}`
}

/** Generate a fresh selector label key for use during parsing. */
function freshLabelKey(): string {
  return `import-l-${++_parseCounter}`
}

/**
 * Grab the value after the first `:` on a line, trimmed.
 * Returns '' if no colon is found.
 */
function lineValue(line: string): string {
  const idx = line.indexOf(':')
  if (idx === -1) return ''
  return line.slice(idx + 1).trim()
}

/**
 * Parse a ResourceGraphDefinition YAML string into RGDAuthoringState.
 *
 * Uses a line-by-line state machine targeting the fixed-indent format produced
 * by generateRGDYAML. Also handles kubectl get output (extra fields ignored).
 *
 * Never throws — all errors are returned as { ok: false, error }.
 *
 * Spec: .specify/specs/045-rgd-designer-validation-optimizer/ US8, FR-011–FR-016
 */
export function parseRGDYAML(yaml: string): ParseResult {
  try {
    // Reset parse counter for stable IDs per call
    _parseCounter = 0

    // ── Guard: empty input ───────────────────────────────────────────────
    if (!yaml.trim()) {
      return { ok: false, error: 'Empty input' }
    }

    // ── Guard: must be a ResourceGraphDefinition ─────────────────────────
    if (!yaml.includes('kind: ResourceGraphDefinition')) {
      return { ok: false, error: 'Not a ResourceGraphDefinition' }
    }

    const lines = yaml.split('\n')

    // ── Extract metadata.name ────────────────────────────────────────────
    let rgdName = 'my-rgd'
    for (const line of lines) {
      // metadata.name is at 2-space indent
      if (/^  name:\s/.test(line)) {
        rgdName = lineValue(line)
        break
      }
    }

    // ── Find spec.schema block boundaries ────────────────────────────────
    const schemaStartIdx = lines.findIndex((l) => /^  schema:/.test(l))
    if (schemaStartIdx === -1) {
      return { ok: false, error: 'Missing spec.schema' }
    }

    // ── Extract schema-level fields (4-space indent under schema:) ────────
    let kind = 'MyApp'
    let apiVersion = 'v1alpha1'
    let group = 'kro.run'
    let scope: 'Namespaced' | 'Cluster' = 'Namespaced'

    // Walk schema-level keys (lines starting with exactly 4 spaces that are
    // direct children of schema:, i.e. not deeper indent)
    for (let i = schemaStartIdx + 1; i < lines.length; i++) {
      const line = lines[i]
      // Stop at a sibling section (2-space indent non-empty line that isn't 4-space)
      if (/^  \S/.test(line)) break
      if (/^    kind:\s/.test(line)) kind = lineValue(line)
      else if (/^    apiVersion:\s/.test(line)) apiVersion = lineValue(line)
      else if (/^    group:\s/.test(line)) group = lineValue(line)
      else if (/^    scope:\s/.test(line)) {
        if (lineValue(line) === 'Cluster') scope = 'Cluster'
      }
    }

    // ── Extract spec.schema.spec fields (6-space indent) ──────────────────
    const specFields: AuthoringField[] = []
    const specSectionIdx = lines.findIndex((l, i) =>
      i > schemaStartIdx && /^    spec:/.test(l),
    )
    if (specSectionIdx !== -1) {
      for (let i = specSectionIdx + 1; i < lines.length; i++) {
        const line = lines[i]
        // 6-space indent = direct children of spec:
        if (/^      \S/.test(line) && !/^        /.test(line)) {
          const colon = line.indexOf(':')
          if (colon === -1) continue
          const name = line.slice(6, colon).trim()
          const rawType = line.slice(colon + 1).trim()
          if (!name) continue
          const parsed = parseSimpleSchemaStr(rawType)
          specFields.push({
            id: freshFieldId(),
            name,
            type: parsed.type,
            defaultValue: parsed.defaultValue,
            required: parsed.required,
            minimum: parsed.minimum || undefined,
            maximum: parsed.maximum || undefined,
            enum: parsed.enum || undefined,
            pattern: parsed.pattern || undefined,
          })
        } else if (/^    \S/.test(line)) {
          // Left spec: section
          break
        }
      }
    }

    // ── Extract spec.schema.status fields (6-space indent) ────────────────
    const statusFields: AuthoringStatusField[] = []
    const statusSectionIdx = lines.findIndex((l, i) =>
      i > schemaStartIdx && /^    status:/.test(l),
    )
    if (statusSectionIdx !== -1) {
      for (let i = statusSectionIdx + 1; i < lines.length; i++) {
        const line = lines[i]
        if (/^      \S/.test(line) && !/^        /.test(line)) {
          const colon = line.indexOf(':')
          if (colon === -1) continue
          const name = line.slice(6, colon).trim()
          const expression = line.slice(colon + 1).trim()
          if (!name) continue
          // Strip surrounding quotes from the expression
          const expr = expression.startsWith('"') && expression.endsWith('"')
            ? expression.slice(1, -1)
            : expression
          statusFields.push({ id: freshFieldId(), name, expression: expr })
        } else if (/^    \S/.test(line)) {
          break
        }
      }
    }

    // ── Extract spec.resources[] ───────────────────────────────────────────
    const resources: AuthoringResource[] = []
    const resourcesSectionIdx = lines.findIndex((l) => /^  resources:/.test(l))

    if (resourcesSectionIdx !== -1) {
      // Each resource block starts with "    - id:" at 4-space indent
      // Collect line ranges for each resource block
      const blockStarts: number[] = []
      for (let i = resourcesSectionIdx + 1; i < lines.length; i++) {
        const line = lines[i]
        // Stop at a sibling of resources: (2-space indent non-empty)
        if (/^  \S/.test(line)) break
        if (/^    - /.test(line)) blockStarts.push(i)
      }

      for (let b = 0; b < blockStarts.length; b++) {
        const start = blockStarts[b]
        const end = b + 1 < blockStarts.length ? blockStarts[b + 1] : lines.length

        const blockLines = lines.slice(start, end)

        // Detect resource id
        let resId = ''
        // id can be on the first line "    - id: web" or on a subsequent line "      id: web"
        const firstLine = blockLines[0]
        if (/^    - id:\s/.test(firstLine)) {
          resId = lineValue(firstLine.replace('    - ', '    '))
        } else {
          for (const bl of blockLines) {
            if (/^      id:\s/.test(bl)) { resId = lineValue(bl); break }
          }
        }

        // Detect node type
        const hasExternalRef = blockLines.some((l) => /^      externalRef:/.test(l))
        const hasForEach = blockLines.some((l) => /^      forEach:/.test(l))

        const _key = freshResKey()

        if (hasExternalRef) {
          // ── externalRef resource ────────────────────────────────────────
          let extApiVersion = ''
          let extKind = ''
          let extNamespace = ''
          let extName = ''
          const selectorLabels: { _key: string; labelKey: string; labelValue: string }[] = []

          let inExtRef = false
          let inMetadata = false
          let inSelector = false
          for (const bl of blockLines) {
            if (/^      externalRef:/.test(bl)) { inExtRef = true; continue }
            if (!inExtRef) continue
            if (/^        apiVersion:\s/.test(bl)) extApiVersion = lineValue(bl)
            else if (/^        kind:\s/.test(bl)) extKind = lineValue(bl)
            else if (/^        metadata:/.test(bl)) inMetadata = true
            else if (inMetadata && /^          namespace:\s/.test(bl)) extNamespace = lineValue(bl)
            else if (inMetadata && /^          name:\s/.test(bl)) extName = lineValue(bl)
            else if (inMetadata && /^          selector:/.test(bl)) inSelector = true
            else if (inSelector && /^            matchLabels:/.test(bl)) { /* continue */ }
            else if (inSelector && /^              \S/.test(bl)) {
              // matchLabels key: value
              const colon = bl.indexOf(':')
              if (colon !== -1) {
                const lk = bl.slice(0, colon).trim()
                const lv = bl.slice(colon + 1).trim()
                selectorLabels.push({ _key: freshLabelKey(), labelKey: lk, labelValue: lv })
              }
            } else if (/^      \S/.test(bl) && !/^        /.test(bl)) break
          }

          // Extract includeWhen / readyWhen
          const includeWhen = extractIncludeWhen(blockLines)
          const readyWhen = extractReadyWhen(blockLines)

          resources.push({
            _key,
            id: resId,
            apiVersion: extApiVersion,
            kind: extKind,
            resourceType: 'externalRef',
            templateYaml: '',
            includeWhen,
            readyWhen,
            forEachIterators: [{ _key: freshIterKey(), variable: '', expression: '' }],
            externalRef: {
              apiVersion: extApiVersion,
              kind: extKind,
              namespace: extNamespace,
              name: extName,
              selectorLabels,
            },
          })
        } else if (hasForEach) {
          // ── forEach resource ─────────────────────────────────────────────
          const forEachIterators: ForEachIterator[] = []
          let inForEach = false
          for (const bl of blockLines) {
            if (/^      forEach:/.test(bl)) { inForEach = true; continue }
            if (!inForEach) continue
            // Each iterator: "        - varName: ${expression}"
            if (/^        - \S/.test(bl)) {
              const dashContent = bl.slice(bl.indexOf('- ') + 2)
              const colon = dashContent.indexOf(':')
              if (colon !== -1) {
                const variable = dashContent.slice(0, colon).trim()
                const expression = dashContent.slice(colon + 1).trim()
                forEachIterators.push({ _key: freshIterKey(), variable, expression })
              }
            } else if (/^      \S/.test(bl) && !/^        /.test(bl)) break
          }
          if (forEachIterators.length === 0) {
            forEachIterators.push({ _key: freshIterKey(), variable: '', expression: '' })
          }

          const { resApiVersion, resKind, templateYaml } = extractTemplate(blockLines)
          const includeWhen = extractIncludeWhen(blockLines)
          const readyWhen = extractReadyWhen(blockLines)

          resources.push({
            _key,
            id: resId,
            apiVersion: resApiVersion,
            kind: resKind,
            resourceType: 'forEach',
            templateYaml,
            includeWhen,
            readyWhen,
            forEachIterators,
            externalRef: { apiVersion: '', kind: '', namespace: '', name: '', selectorLabels: [] },
          })
        } else {
          // ── managed resource ─────────────────────────────────────────────
          const { resApiVersion, resKind, templateYaml } = extractTemplate(blockLines)
          const includeWhen = extractIncludeWhen(blockLines)
          const readyWhen = extractReadyWhen(blockLines)

          resources.push({
            _key,
            id: resId,
            apiVersion: resApiVersion,
            kind: resKind,
            resourceType: 'managed',
            templateYaml,
            includeWhen,
            readyWhen,
            forEachIterators: [{ _key: freshIterKey(), variable: '', expression: '' }],
            externalRef: { apiVersion: '', kind: '', namespace: '', name: '', selectorLabels: [] },
          })
        }
      }
    }

    const state: RGDAuthoringState = {
      rgdName,
      kind,
      group,
      apiVersion,
      scope,
      specFields,
      statusFields,
      resources,
    }

    return { ok: true, state }
  } catch (err) {
    return {
      ok: false,
      error: `Parse failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ── parseRGDYAML helpers ──────────────────────────────────────────────────

function extractTemplate(blockLines: string[]): {
  resApiVersion: string
  resKind: string
  templateYaml: string
} {
  let resApiVersion = ''
  let resKind = ''
  const templateBodyLines: string[] = []
  let inTemplate = false
  let templateKindFound = false

  for (const bl of blockLines) {
    if (/^      template:/.test(bl)) { inTemplate = true; continue }
    if (!inTemplate) continue
    // apiVersion + kind are at 8-space indent inside template:
    if (/^        apiVersion:\s/.test(bl)) {
      resApiVersion = lineValue(bl)
      continue
    }
    if (/^        kind:\s/.test(bl)) {
      resKind = lineValue(bl)
      templateKindFound = true
      continue
    }
    // Remaining lines of template body (after kind:): collect verbatim, strip 8 leading spaces
    if (templateKindFound && /^        /.test(bl)) {
      templateBodyLines.push(bl.slice(8))
    } else if (inTemplate && /^      \S/.test(bl) && !/^        /.test(bl)) {
      // Left template: section
      break
    }
  }

  return {
    resApiVersion,
    resKind,
    templateYaml: templateBodyLines.join('\n').trimEnd(),
  }
}

function extractIncludeWhen(blockLines: string[]): string {
  let inIncludeWhen = false
  for (const bl of blockLines) {
    if (/^      includeWhen:/.test(bl)) { inIncludeWhen = true; continue }
    if (!inIncludeWhen) continue
    // First list entry: "        - 'expression'"
    if (/^        - /.test(bl)) {
      return bl.slice(bl.indexOf('- ') + 2).trim().replace(/^'|'$/g, '')
    }
    if (/^      \S/.test(bl)) break
  }
  return ''
}

function extractReadyWhen(blockLines: string[]): string[] {
  const result: string[] = []
  let inReadyWhen = false
  for (const bl of blockLines) {
    if (/^      readyWhen:/.test(bl)) { inReadyWhen = true; continue }
    if (!inReadyWhen) continue
    if (/^        - /.test(bl)) {
      result.push(bl.slice(bl.indexOf('- ') + 2).trim().replace(/^'|'$/g, ''))
    } else if (/^      \S/.test(bl)) break
  }
  return result
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
