// generator.test.ts — unit tests for web/src/lib/generator.ts
//
// Spec: .specify/specs/026-rgd-yaml-generator/ Testing Requirements

import { describe, it, expect } from 'vitest'
import {
  kindToSlug,
  parseBatchRow,
  generateInstanceYAML,
  generateBatchYAML,
  generateRGDYAML,
} from '@/lib/generator'
import type {
  InstanceFormState,
  RGDAuthoringState,
} from '@/lib/generator'
import type { SchemaDoc } from '@/lib/schema'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeSchema(overrides: Partial<SchemaDoc> = {}): SchemaDoc {
  return {
    kind: 'WebApp',
    apiVersion: 'v1alpha1',
    group: 'kro.run',
    specFields: [],
    statusFields: [],
    ...overrides,
  }
}

function makeState(overrides: Partial<InstanceFormState> = {}): InstanceFormState {
  return { metadataName: 'my-webapp', fields: [], ...overrides }
}

// ── T011: kindToSlug ──────────────────────────────────────────────────────

describe('kindToSlug', () => {
  it('converts PascalCase to lowercase-hyphenated', () => {
    expect(kindToSlug('WebApplication')).toBe('web-application')
  })

  it('converts two-word PascalCase', () => {
    expect(kindToSlug('MyApp')).toBe('my-app')
  })

  it('converts two-word PascalCase — ConfigMap', () => {
    expect(kindToSlug('ConfigMap')).toBe('config-map')
  })

  it('converts single-word lowercase', () => {
    expect(kindToSlug('Deployment')).toBe('deployment')
  })

  it('returns empty string for empty input', () => {
    expect(kindToSlug('')).toBe('')
  })

  it('handles already-lowercase single word', () => {
    expect(kindToSlug('app')).toBe('app')
  })
})

// ── T013: parseBatchRow ───────────────────────────────────────────────────

describe('parseBatchRow', () => {
  it('parses single key=value pair', () => {
    const row = parseBatchRow('name=foo', 0)
    expect(row.values).toEqual({ name: 'foo' })
    expect(row.error).toBeUndefined()
    expect(row.index).toBe(0)
  })

  it('parses multiple key=value pairs', () => {
    const row = parseBatchRow('name=foo image=nginx', 1)
    expect(row.values).toEqual({ name: 'foo', image: 'nginx' })
    expect(row.error).toBeUndefined()
  })

  it('sets error on malformed token (starts with =)', () => {
    const row = parseBatchRow('=bad', 0)
    expect(row.error).toBeDefined()
    expect(row.error).toContain('malformed')
  })

  it('still parses valid tokens when one is malformed', () => {
    const row = parseBatchRow('name=foo =bad image=nginx', 0)
    expect(row.values).toEqual({ name: 'foo', image: 'nginx' })
    expect(row.error).toBeDefined()
  })

  it('returns empty values for empty line', () => {
    const row = parseBatchRow('', 0)
    expect(row.values).toEqual({})
    expect(row.error).toBeUndefined()
  })

  it('returns empty values for whitespace-only line', () => {
    const row = parseBatchRow('   ', 0)
    expect(row.values).toEqual({})
    expect(row.error).toBeUndefined()
  })

  it('handles value containing equals sign', () => {
    // First = is the delimiter; value may contain further = chars
    const row = parseBatchRow('expr=a=b', 0)
    expect(row.values).toEqual({ expr: 'a=b' })
  })
})

// ── T015: generateInstanceYAML ────────────────────────────────────────────

describe('generateInstanceYAML', () => {
  it('generates valid YAML with required string field filled', () => {
    const schema = makeSchema({
      specFields: [
        { name: 'name', raw: 'string', parsedType: { type: 'string' } },
      ],
    })
    const state = makeState({
      fields: [{ name: 'name', value: 'hello', items: [], isArray: false }],
    })
    const yaml = generateInstanceYAML(schema, state)
    expect(yaml).toContain('kind: WebApp')
    expect(yaml).toContain('name: hello')
    expect(yaml).toContain('apiVersion: kro.run/v1alpha1')
  })

  it('uses metadata.name from state', () => {
    const schema = makeSchema()
    const state = makeState({ metadataName: 'my-custom-name' })
    const yaml = generateInstanceYAML(schema, state)
    expect(yaml).toContain('name: my-custom-name')
  })

  it('falls back to kind-slug for metadata.name when name is empty', () => {
    const schema = makeSchema({ kind: 'FooBar' })
    const state = makeState({ metadataName: '' })
    const yaml = generateInstanceYAML(schema, state)
    expect(yaml).toContain('name: my-foo-bar')
  })

  it('serializes boolean field as actual boolean', () => {
    const schema = makeSchema({
      specFields: [
        { name: 'enabled', raw: 'boolean', parsedType: { type: 'boolean' } },
      ],
    })
    const state = makeState({
      fields: [{ name: 'enabled', value: 'true', items: [], isArray: false }],
    })
    const yaml = generateInstanceYAML(schema, state)
    expect(yaml).toContain('enabled: true')
    // Must not be quoted string
    expect(yaml).not.toContain('enabled: "true"')
  })

  it('serializes integer field as number', () => {
    const schema = makeSchema({
      specFields: [
        { name: 'replicas', raw: 'integer', parsedType: { type: 'integer' } },
      ],
    })
    const state = makeState({
      fields: [{ name: 'replicas', value: '3', items: [], isArray: false }],
    })
    const yaml = generateInstanceYAML(schema, state)
    expect(yaml).toContain('replicas: 3')
    expect(yaml).not.toContain('replicas: "3"')
  })

  it('serializes array field as YAML list block', () => {
    const schema = makeSchema({
      specFields: [
        { name: 'tags', raw: '[]string', parsedType: { type: 'array', items: 'string' } },
      ],
    })
    const state = makeState({
      fields: [{ name: 'tags', value: '', items: ['alpha', 'beta'], isArray: true }],
    })
    const yaml = generateInstanceYAML(schema, state)
    expect(yaml).toContain('- alpha')
    expect(yaml).toContain('- beta')
  })

  it('omits spec section when there are no spec fields', () => {
    const schema = makeSchema({ specFields: [] })
    const state = makeState({ fields: [] })
    const yaml = generateInstanceYAML(schema, state)
    expect(yaml).not.toContain('spec:')
    expect(yaml).toContain('kind: WebApp')
  })
})

// ── T017: generateBatchYAML ───────────────────────────────────────────────

describe('generateBatchYAML', () => {
  it('generates 3 documents for 3 non-empty lines', () => {
    const schema = makeSchema({
      specFields: [
        { name: 'name', raw: 'string', parsedType: { type: 'string' } },
      ],
    })
    const batchText = 'name=alpha\nname=beta\nname=gamma'
    const { yaml, rows } = generateBatchYAML(batchText, schema)
    expect(rows.filter((r) => !r.error && Object.keys(r.values).length > 0)).toHaveLength(3)
    // Three documents separated by ---
    const docs = yaml.split('\n---\n').filter((d) => d.trim())
    expect(docs).toHaveLength(3)
  })

  it('returns empty yaml and rows for empty input', () => {
    const schema = makeSchema()
    const { yaml, rows } = generateBatchYAML('', schema)
    expect(yaml).toBe('')
    expect(rows).toHaveLength(0)
  })

  it('returns empty yaml and rows for whitespace-only input', () => {
    const schema = makeSchema()
    const { yaml } = generateBatchYAML('   \n  \n  ', schema)
    expect(yaml).toBe('')
  })

  it('uses schema default for missing field in batch row', () => {
    const schema = makeSchema({
      specFields: [
        {
          name: 'replicas',
          raw: 'integer | default=2',
          parsedType: { type: 'integer', default: '2' },
        },
      ],
    })
    const { yaml } = generateBatchYAML('name=foo', schema)
    // The replicas field should use default value 2
    expect(yaml).toContain('replicas: 2')
  })

  it('uses name from batch row as metadata.name', () => {
    const schema = makeSchema()
    const { yaml } = generateBatchYAML('name=my-instance', schema)
    expect(yaml).toContain('name: my-instance')
  })
})

// ── T019: generateRGDYAML ─────────────────────────────────────────────────

describe('generateRGDYAML', () => {
  function makeRGDState(overrides: Partial<RGDAuthoringState> = {}): RGDAuthoringState {
    return {
      rgdName: 'my-app',
      kind: 'WebApp',
      group: 'kro.run',
      apiVersion: 'v1alpha1',
      specFields: [],
      resources: [],
      ...overrides,
    }
  }

  it('produces apiVersion: kro.run/v1alpha1', () => {
    const yaml = generateRGDYAML(makeRGDState())
    expect(yaml).toContain('apiVersion: kro.run/v1alpha1')
  })

  it('produces kind: ResourceGraphDefinition', () => {
    const yaml = generateRGDYAML(makeRGDState())
    expect(yaml).toContain('kind: ResourceGraphDefinition')
  })

  it('includes spec.schema.kind from state', () => {
    const yaml = generateRGDYAML(makeRGDState({ kind: 'Platform' }))
    expect(yaml).toContain('kind: Platform')
  })

  it('includes spec fields as SimpleSchema strings', () => {
    const yaml = generateRGDYAML(
      makeRGDState({
        specFields: [
          { id: '1', name: 'replicas', type: 'integer', defaultValue: '2', required: false },
        ],
      }),
    )
    expect(yaml).toContain('replicas: "integer | default=2"')
  })

  it('marks required fields with | required modifier', () => {
    const yaml = generateRGDYAML(
      makeRGDState({
        specFields: [
          { id: '1', name: 'name', type: 'string', defaultValue: '', required: true },
        ],
      }),
    )
    expect(yaml).toContain('name: "string | required"')
  })

  it('includes resource template with CEL metadata.name placeholder', () => {
    const yaml = generateRGDYAML(
      makeRGDState({
        resources: [{ _key: 'k1', id: 'web', apiVersion: 'apps/v1', kind: 'Deployment' }],
      }),
    )
    expect(yaml).toContain('id: web')
    expect(yaml).toContain('kind: Deployment')
    expect(yaml).toContain('${schema.metadata.name}-web')
  })

  it('uses metadata.name from state', () => {
    const yaml = generateRGDYAML(makeRGDState({ rgdName: 'my-platform' }))
    expect(yaml).toContain('name: my-platform')
  })

  it('CEL placeholders are NOT quoted by yaml serializer', () => {
    const yaml = generateRGDYAML(
      makeRGDState({
        resources: [{ _key: 'k2', id: 'svc', apiVersion: 'v1', kind: 'Service' }],
      }),
    )
    // Should appear literally, not escaped
    expect(yaml).toContain('${schema.metadata.name}-svc')
    expect(yaml).not.toContain('"${schema')
  })
})
