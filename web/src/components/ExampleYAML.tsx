// ExampleYAML.tsx — Generates and displays an example YAML manifest for a kro RGD schema.
//
// Produces a copy-pasteable minimal instance manifest from the schema's spec fields.
// Required fields (no default) appear as active lines with placeholder values.
// Optional fields (have a default) appear as commented-out lines with the default.
// The copy button is built into KroCodeBlock.
//
// Spec: .specify/specs/020-schema-doc-generator/ FR-004, FR-005

import KroCodeBlock from '@/components/KroCodeBlock'
import type { SchemaDoc, ParsedField } from '@/lib/schema'
import './ExampleYAML.css'

// ── YAML generation ────────────────────────────────────────────────────────

/**
 * Return a placeholder value string for the given SimpleSchema type.
 * Used for required fields with no default.
 */
function typePlaceholder(type: string | undefined): string {
  switch (type) {
    case 'integer':
    case 'number':
      return '0'
    case 'boolean':
      return 'false'
    case 'array':
      return '[]'
    case 'map':
    case 'object':
      return '{}'
    default:
      return '""'
  }
}

/**
 * Generate the `spec:` block lines for the example manifest.
 *
 * Required fields (no default):
 *   `  name: ""     # required - string`
 *
 * Optional fields (have a default):
 *   `  # replicas: 2    # optional - integer (default: 2)`
 */
function generateSpecLines(specFields: ParsedField[]): string[] {
  return specFields.map((field) => {
    const pt = field.parsedType
    const typeName = pt?.type === 'array' && pt.items
      ? `[]${pt.items}`
      : pt?.type === 'map' && pt.key && pt.value
        ? `map[${pt.key}]${pt.value}`
        : (pt?.type ?? 'string')

    // Use key existence (not `!== undefined`) so falsy defaults like
    // default=0, default=false, default="" are correctly detected as present.
    // See: https://github.com/pnz1990/kro-ui/issues/106 (AGENTS.md anti-pattern #61)
    const hasDefault = pt != null && 'default' in pt
    const defaultVal = pt?.default === '' ? '""' : (pt?.default ?? '')

    if (hasDefault) {
      // Optional: commented out with default value
      return `  # ${field.name}: ${defaultVal}    # optional - ${typeName} (default: ${defaultVal})`
    } else {
      // Required: active line with placeholder
      const placeholder = typePlaceholder(pt?.type)
      return `  ${field.name}: ${placeholder}     # required - ${typeName}`
    }
  })
}

/**
 * Generate the full example YAML manifest string from a SchemaDoc.
 *
 * Exported as a pure function for testability.
 */
export function generateExampleYAML(schema: SchemaDoc): string {
  const { kind, apiVersion, group, specFields } = schema

  // Build metadata.name: my-<kind-lowercased-hyphenated>
  const kindSlug = kind
    .replace(/([A-Z])/g, (match, _, offset) =>
      offset === 0 ? match.toLowerCase() : `-${match.toLowerCase()}`,
    )
    .replace(/^-/, '')
  const metadataName = `my-${kindSlug}`

  const header = [
    `apiVersion: ${group}/${apiVersion}`,
    `kind: ${kind}`,
    'metadata:',
    `  name: ${metadataName}`,
  ]

  const lines: string[] = [...header]

  if (specFields.length > 0) {
    lines.push('spec:')
    lines.push(...generateSpecLines(specFields))
  }

  return lines.join('\n')
}

// ── Component ─────────────────────────────────────────────────────────────

export interface ExampleYAMLProps {
  schema: SchemaDoc
}

/**
 * ExampleYAML — shows the generated example manifest with a copy button.
 *
 * Delegates rendering and copy behavior to KroCodeBlock.
 * Spec: .specify/specs/020-schema-doc-generator/ FR-004, FR-005
 */
export default function ExampleYAML({ schema }: ExampleYAMLProps) {
  const yaml = generateExampleYAML(schema)

  return (
    <div className="example-yaml" data-testid="example-yaml">
      <KroCodeBlock code={yaml} title="Example Manifest" />
    </div>
  )
}
