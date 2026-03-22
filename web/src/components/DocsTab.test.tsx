// DocsTab.test.tsx — Unit tests for DocsTab, FieldTable, and ExampleYAML.
//
// Spec: .specify/specs/020-schema-doc-generator/ (Testing Requirements)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DocsTab from './DocsTab'
import FieldTable from './FieldTable'
import ExampleYAML from './ExampleYAML'
import { generateExampleYAML } from './ExampleYAML'
import type { K8sObject } from '@/lib/api'
import type { SchemaDoc } from '@/lib/schema'

// ── Fixtures ───────────────────────────────────────────────────────────────

/** Build a minimal RGD K8sObject for testing. */
function makeRGD(
  schemaSpec: Record<string, string> = {},
  schemaStatus: Record<string, string> = {},
  kind = 'WebApplication',
): K8sObject {
  return {
    apiVersion: 'kro.run/v1alpha1',
    kind: 'ResourceGraphDefinition',
    metadata: { name: 'test-app' },
    spec: {
      schema: {
        kind,
        apiVersion: 'v1alpha1',
        group: 'kro.run',
        spec: schemaSpec,
        status: schemaStatus,
      },
      resources: [],
    },
  }
}

// ── Mock navigator.clipboard ───────────────────────────────────────────────

let clipboardWritten = ''

beforeEach(() => {
  clipboardWritten = ''
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn((text: string) => {
        clipboardWritten = text
        return Promise.resolve()
      }),
    },
    configurable: true,
  })
})

// Mock useCapabilities (used inside KroCodeBlock)
vi.mock('@/lib/features', () => ({
  useCapabilities: () => ({
    capabilities: { featureGates: { CELOmitFunction: false } },
    loading: false,
    error: null,
  }),
}))

// ── DocsTab tests ──────────────────────────────────────────────────────────

describe('DocsTab', () => {
  it('renders with data-testid="docs-tab"', () => {
    const rgd = makeRGD({ name: 'string' })
    render(<DocsTab rgd={rgd} />)
    expect(screen.getByTestId('docs-tab')).toBeInTheDocument()
  })

  it('displays the kind in the header', () => {
    const rgd = makeRGD({ name: 'string' }, {}, 'WebApplication')
    render(<DocsTab rgd={rgd} />)
    // Use role-based query to target the h2 heading specifically
    expect(screen.getByRole('heading', { level: 2, name: 'WebApplication' })).toBeInTheDocument()
  })

  it('renders one field-row per spec field', () => {
    const rgd = makeRGD({
      name: 'string',
      image: 'string',
      replicas: 'integer | default=2',
    })
    render(<DocsTab rgd={rgd} />)
    const rows = screen.getAllByTestId('field-row')
    expect(rows).toHaveLength(3)
  })

  it('shows the default value when present', () => {
    const rgd = makeRGD({ replicas: 'integer | default=2' })
    render(<DocsTab rgd={rgd} />)
    // The default value "2" should appear in the table
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows required dot for fields without a default', () => {
    const rgd = makeRGD({ name: 'string' })
    render(<DocsTab rgd={rgd} />)
    const requiredDots = document.querySelectorAll(
      '.field-table__required-dot--required',
    )
    expect(requiredDots.length).toBeGreaterThan(0)
  })

  it('shows optional dot for fields with a default', () => {
    const rgd = makeRGD({ replicas: 'integer | default=2' })
    render(<DocsTab rgd={rgd} />)
    const optionalDots = document.querySelectorAll(
      '.field-table__required-dot--optional',
    )
    expect(optionalDots.length).toBeGreaterThan(0)
  })

  it('shows empty state message when there are no spec fields', () => {
    const rgd = makeRGD({})
    render(<DocsTab rgd={rgd} />)
    expect(screen.getByTestId('no-spec-fields')).toBeInTheDocument()
    expect(screen.getByTestId('no-spec-fields')).toHaveTextContent(
      'no configurable fields',
    )
  })

  it('shows status fields section when status fields are present', () => {
    const rgd = makeRGD(
      { name: 'string' },
      { ready: '${deployment.status.availableReplicas == 2}' },
    )
    render(<DocsTab rgd={rgd} />)
    // Status section heading should be present
    expect(screen.getByText('Status Fields')).toBeInTheDocument()
  })

  it('does NOT show status section when status fields are absent', () => {
    const rgd = makeRGD({ name: 'string' }, {})
    render(<DocsTab rgd={rgd} />)
    expect(screen.queryByText('Status Fields')).not.toBeInTheDocument()
  })

  it('renders the Example Manifest section', () => {
    const rgd = makeRGD({ name: 'string' })
    render(<DocsTab rgd={rgd} />)
    // Use role-based query to target the h3 section heading specifically
    expect(screen.getByRole('heading', { level: 3, name: 'Example Manifest' })).toBeInTheDocument()
    expect(screen.getByTestId('example-yaml')).toBeInTheDocument()
  })
})

// ── FieldTable tests ───────────────────────────────────────────────────────

describe('FieldTable', () => {
  it('renders with data-testid="field-table"', () => {
    const fields = [
      { name: 'name', raw: 'string', parsedType: { type: 'string' } },
    ]
    render(<FieldTable fields={fields} variant="spec" />)
    expect(screen.getByTestId('field-table')).toBeInTheDocument()
  })

  it('renders one data-testid="field-row" per field', () => {
    const fields = [
      { name: 'name', raw: 'string', parsedType: { type: 'string' } },
      { name: 'image', raw: 'string', parsedType: { type: 'string' } },
      {
        name: 'replicas',
        raw: 'integer | default=2',
        parsedType: { type: 'integer', default: '2' },
      },
    ]
    render(<FieldTable fields={fields} variant="spec" />)
    expect(screen.getAllByTestId('field-row')).toHaveLength(3)
  })

  it('shows type badge for each field', () => {
    const fields = [
      {
        name: 'replicas',
        raw: 'integer | default=2',
        parsedType: { type: 'integer', default: '2' },
      },
    ]
    render(<FieldTable fields={fields} variant="spec" />)
    expect(screen.getByText('integer')).toBeInTheDocument()
  })

  it('shows array type as []string in badge', () => {
    const fields = [
      {
        name: 'regions',
        raw: '[]string',
        parsedType: { type: 'array', items: 'string' },
      },
    ]
    render(<FieldTable fields={fields} variant="spec" />)
    expect(screen.getByText('[]string')).toBeInTheDocument()
  })

  it('shows map type in badge', () => {
    const fields = [
      {
        name: 'labels',
        raw: 'map[string]string',
        parsedType: { type: 'map', key: 'string', value: 'string' },
      },
    ]
    render(<FieldTable fields={fields} variant="spec" />)
    expect(screen.getByText('map[string]string')).toBeInTheDocument()
  })

  it('returns null for empty fields array', () => {
    const { container } = render(<FieldTable fields={[]} variant="spec" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders status variant with CEL expression text', () => {
    const fields = [
      {
        name: 'ready',
        raw: '${deployment.status.availableReplicas == 2}',
        isStatus: true,
        inferredType: 'boolean',
      },
    ]
    render(<FieldTable fields={fields} variant="status" />)
    const rows = screen.getAllByTestId('field-row')
    expect(rows).toHaveLength(1)
    // The CEL expression text should appear in the rendered output
    expect(screen.getByText(/availableReplicas/)).toBeInTheDocument()
  })
})

// ── generateExampleYAML tests ──────────────────────────────────────────────

describe('generateExampleYAML', () => {
  it('includes apiVersion and kind headers', () => {
    const schema: SchemaDoc = {
      kind: 'WebApplication',
      apiVersion: 'v1alpha1',
      group: 'kro.run',
      specFields: [],
      statusFields: [],
    }
    const yaml = generateExampleYAML(schema)
    expect(yaml).toContain('apiVersion: kro.run/v1alpha1')
    expect(yaml).toContain('kind: WebApplication')
  })

  it('generates metadata.name from kind', () => {
    const schema: SchemaDoc = {
      kind: 'WebApplication',
      apiVersion: 'v1alpha1',
      group: 'kro.run',
      specFields: [],
      statusFields: [],
    }
    const yaml = generateExampleYAML(schema)
    expect(yaml).toContain('name: my-web-application')
  })

  it('includes required fields as active YAML lines with placeholders', () => {
    const schema: SchemaDoc = {
      kind: 'WebApplication',
      apiVersion: 'v1alpha1',
      group: 'kro.run',
      specFields: [
        { name: 'name', raw: 'string', parsedType: { type: 'string' } },
        { name: 'image', raw: 'string', parsedType: { type: 'string' } },
      ],
      statusFields: [],
    }
    const yaml = generateExampleYAML(schema)
    // Required fields should appear as active lines (not commented)
    expect(yaml).toMatch(/^\s+name: ""/m)
    expect(yaml).toMatch(/^\s+image: ""/m)
  })

  it('includes optional fields (with defaults) as commented-out lines', () => {
    const schema: SchemaDoc = {
      kind: 'WebApplication',
      apiVersion: 'v1alpha1',
      group: 'kro.run',
      specFields: [
        {
          name: 'replicas',
          raw: 'integer | default=2',
          parsedType: { type: 'integer', default: '2' },
        },
      ],
      statusFields: [],
    }
    const yaml = generateExampleYAML(schema)
    // Optional field should be commented out
    expect(yaml).toMatch(/^\s+# replicas: 2/m)
  })

  it('uses integer placeholder 0 for integer fields', () => {
    const schema: SchemaDoc = {
      kind: 'App',
      apiVersion: 'v1alpha1',
      group: 'kro.run',
      specFields: [
        { name: 'count', raw: 'integer', parsedType: { type: 'integer' } },
      ],
      statusFields: [],
    }
    const yaml = generateExampleYAML(schema)
    expect(yaml).toMatch(/^\s+count: 0/m)
  })

  it('uses boolean placeholder false for boolean fields', () => {
    const schema: SchemaDoc = {
      kind: 'App',
      apiVersion: 'v1alpha1',
      group: 'kro.run',
      specFields: [
        {
          name: 'enabled',
          raw: 'boolean',
          parsedType: { type: 'boolean' },
        },
      ],
      statusFields: [],
    }
    const yaml = generateExampleYAML(schema)
    expect(yaml).toMatch(/^\s+enabled: false/m)
  })

  it('omits spec: block when there are no spec fields', () => {
    const schema: SchemaDoc = {
      kind: 'App',
      apiVersion: 'v1alpha1',
      group: 'kro.run',
      specFields: [],
      statusFields: [],
    }
    const yaml = generateExampleYAML(schema)
    expect(yaml).not.toContain('spec:')
  })
})

// ── ExampleYAML component tests ────────────────────────────────────────────

describe('ExampleYAML', () => {
  it('renders with data-testid="example-yaml"', () => {
    const schema: SchemaDoc = {
      kind: 'WebApplication',
      apiVersion: 'v1alpha1',
      group: 'kro.run',
      specFields: [
        { name: 'name', raw: 'string', parsedType: { type: 'string' } },
      ],
      statusFields: [],
    }
    render(<ExampleYAML schema={schema} />)
    expect(screen.getByTestId('example-yaml')).toBeInTheDocument()
  })

  it('renders a KroCodeBlock with the generated YAML', () => {
    const schema: SchemaDoc = {
      kind: 'WebApplication',
      apiVersion: 'v1alpha1',
      group: 'kro.run',
      specFields: [],
      statusFields: [],
    }
    render(<ExampleYAML schema={schema} />)
    expect(screen.getByTestId('kro-code-block')).toBeInTheDocument()
  })

  it('copies YAML to clipboard on copy button click', async () => {
    const schema: SchemaDoc = {
      kind: 'WebApplication',
      apiVersion: 'v1alpha1',
      group: 'kro.run',
      specFields: [
        { name: 'name', raw: 'string', parsedType: { type: 'string' } },
      ],
      statusFields: [],
    }
    render(<ExampleYAML schema={schema} />)
    const copyBtn = screen.getByTestId('code-block-copy-btn')
    fireEvent.click(copyBtn)
    // Allow the clipboard promise to resolve
    await Promise.resolve()
    expect(clipboardWritten).toContain('kind: WebApplication')
  })
})
