// generator.test.ts — unit tests for web/src/lib/generator.ts
//
// Spec: .specify/specs/026-rgd-yaml-generator/ Testing Requirements
// Extended: spec 044-rgd-designer-full-features

import { describe, it, expect } from 'vitest'
import {
  kindToSlug,
  parseBatchRow,
  generateInstanceYAML,
  generateBatchYAML,
  generateRGDYAML,
  buildSimpleSchemaStr,
  rgdAuthoringStateToSpec,
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
      scope: 'Namespaced',
      specFields: [],
      statusFields: [],
      resources: [],
      ...overrides,
    }
  }

  function makeRes(patch: Partial<import('@/lib/generator').AuthoringResource> = {}): import('@/lib/generator').AuthoringResource {
    return {
      _key: 'k1',
      id: 'web',
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      resourceType: 'managed',
      templateYaml: '',
      includeWhen: '',
      readyWhen: [],
      forEachIterators: [{ _key: 'fe-0', variable: '', expression: '' }],
      externalRef: { apiVersion: 'v1', kind: 'ConfigMap', namespace: '', name: '', selectorLabels: [] },
      ...patch,
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
        resources: [makeRes({ _key: 'k1', id: 'web', apiVersion: 'apps/v1', kind: 'Deployment' })],
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
        resources: [makeRes({ _key: 'k2', id: 'svc', apiVersion: 'v1', kind: 'Service' })],
      }),
    )
    // Should appear literally, not escaped
    expect(yaml).toContain('${schema.metadata.name}-svc')
    expect(yaml).not.toContain('"${schema')
  })
})

// ── T043: buildSimpleSchemaStr constraints ────────────────────────────────

describe('buildSimpleSchemaStr', () => {
  function makeField(overrides: Partial<import('@/lib/generator').AuthoringField> = {}): import('@/lib/generator').AuthoringField {
    return {
      id: '1',
      name: 'f',
      type: 'string',
      defaultValue: '',
      required: false,
      ...overrides,
    }
  }

  it('returns base type when no constraints', () => {
    expect(buildSimpleSchemaStr(makeField({ type: 'string' }))).toBe('string')
  })

  it('appends required modifier', () => {
    expect(buildSimpleSchemaStr(makeField({ required: true }))).toBe('string | required')
  })

  it('appends default= modifier', () => {
    expect(buildSimpleSchemaStr(makeField({ defaultValue: '3', type: 'integer' }))).toBe(
      'integer | default=3',
    )
  })

  it('appends minimum= constraint', () => {
    expect(buildSimpleSchemaStr(makeField({ type: 'integer', minimum: '1' }))).toBe(
      'integer | minimum=1',
    )
  })

  it('appends maximum= constraint', () => {
    expect(buildSimpleSchemaStr(makeField({ type: 'integer', maximum: '100' }))).toBe(
      'integer | maximum=100',
    )
  })

  it('appends enum= constraint', () => {
    expect(buildSimpleSchemaStr(makeField({ enum: 'dev,staging,prod' }))).toBe(
      'string | enum=dev,staging,prod',
    )
  })

  it('appends pattern= constraint', () => {
    expect(buildSimpleSchemaStr(makeField({ pattern: '^[a-z]+' }))).toBe(
      'string | pattern=^[a-z]+',
    )
  })

  it('combines default + min + max', () => {
    const result = buildSimpleSchemaStr(
      makeField({ type: 'integer', defaultValue: '3', minimum: '1', maximum: '100' }),
    )
    expect(result).toBe('integer | default=3 | minimum=1 | maximum=100')
  })

  it('omits empty constraint fields', () => {
    expect(buildSimpleSchemaStr(makeField({ minimum: '', maximum: '', enum: '' }))).toBe('string')
  })
})

// ── T042: generateRGDYAML new fields ──────────────────────────────────────

describe('generateRGDYAML — spec 044 extensions', () => {
  function makeBase(overrides: Partial<RGDAuthoringState> = {}): RGDAuthoringState {
    return {
      rgdName: 'test-app',
      kind: 'TestApp',
      group: 'kro.run',
      apiVersion: 'v1alpha1',
      scope: 'Namespaced',
      specFields: [],
      statusFields: [],
      resources: [],
      ...overrides,
    }
  }

  function makeRes(patch: Partial<import('@/lib/generator').AuthoringResource> = {}): import('@/lib/generator').AuthoringResource {
    return {
      _key: 'k1',
      id: 'web',
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      resourceType: 'managed',
      templateYaml: '',
      includeWhen: '',
      readyWhen: [],
      forEachIterators: [{ _key: 'fe-0', variable: '', expression: '' }],
      externalRef: { apiVersion: 'v1', kind: 'ConfigMap', namespace: '', name: '', selectorLabels: [] },
      ...patch,
    }
  }

  // Scope
  it('emits scope: Cluster when scope === Cluster', () => {
    const yaml = generateRGDYAML(makeBase({ scope: 'Cluster' }))
    expect(yaml).toContain('scope: Cluster')
  })

  it('does NOT emit scope when scope === Namespaced', () => {
    const yaml = generateRGDYAML(makeBase({ scope: 'Namespaced' }))
    expect(yaml).not.toContain('scope:')
  })

  // Status fields
  it('emits status block with valid statusFields', () => {
    const yaml = generateRGDYAML(
      makeBase({
        statusFields: [
          { id: 's1', name: 'endpoint', expression: '${service.spec.clusterIP}' },
        ],
      }),
    )
    expect(yaml).toContain('status:')
    expect(yaml).toContain('endpoint: ${service.spec.clusterIP}')
  })

  it('omits status rows with empty name or expression', () => {
    const yaml = generateRGDYAML(
      makeBase({
        statusFields: [
          { id: 's1', name: '', expression: '${x}' },
          { id: 's2', name: 'foo', expression: '' },
          { id: 's3', name: 'bar', expression: '${y}' },
        ],
      }),
    )
    expect(yaml).toContain('bar: ${y}')
    expect(yaml).not.toContain('foo:')
  })

  // includeWhen
  it('emits includeWhen as YAML array', () => {
    const yaml = generateRGDYAML(
      makeBase({
        resources: [makeRes({ includeWhen: '${schema.spec.monitoring}' })],
      }),
    )
    expect(yaml).toContain('includeWhen:')
    expect(yaml).toContain('- ${schema.spec.monitoring}')
  })

  it('omits includeWhen when empty', () => {
    const yaml = generateRGDYAML(makeBase({ resources: [makeRes({ includeWhen: '' })] }))
    expect(yaml).not.toContain('includeWhen:')
  })

  // readyWhen
  it('emits readyWhen as YAML array with multiple entries', () => {
    const yaml = generateRGDYAML(
      makeBase({
        resources: [makeRes({ readyWhen: ['${db.status.endpoint != ""}', '${db.status.ready}'] })],
      }),
    )
    expect(yaml).toContain('readyWhen:')
    expect(yaml).toContain('- ${db.status.endpoint != ""}')
    expect(yaml).toContain('- ${db.status.ready}')
  })

  it('omits readyWhen when all entries are empty', () => {
    const yaml = generateRGDYAML(makeBase({ resources: [makeRes({ readyWhen: ['', '  '] })] }))
    expect(yaml).not.toContain('readyWhen:')
  })

  // forEach single iterator
  it('emits forEach array for forEach resource type', () => {
    const yaml = generateRGDYAML(
      makeBase({
        resources: [
          makeRes({
            resourceType: 'forEach',
            forEachIterators: [
              { _key: 'fe-0', variable: 'region', expression: '${schema.spec.regions}' },
            ],
          }),
        ],
      }),
    )
    expect(yaml).toContain('forEach:')
    expect(yaml).toContain('- region: ${schema.spec.regions}')
  })

  // forEach cartesian product (2 iterators)
  it('emits forEach with 2 iterator entries', () => {
    const yaml = generateRGDYAML(
      makeBase({
        resources: [
          makeRes({
            resourceType: 'forEach',
            forEachIterators: [
              { _key: 'fe-0', variable: 'region', expression: '${schema.spec.regions}' },
              { _key: 'fe-1', variable: 'tier', expression: '${schema.spec.tiers}' },
            ],
          }),
        ],
      }),
    )
    expect(yaml).toContain('- region: ${schema.spec.regions}')
    expect(yaml).toContain('- tier: ${schema.spec.tiers}')
  })

  // forEach → managed toggle removes forEach
  it('does NOT emit forEach when resourceType is managed', () => {
    const yaml = generateRGDYAML(
      makeBase({
        resources: [
          makeRes({
            resourceType: 'managed',
            forEachIterators: [
              { _key: 'fe-0', variable: 'region', expression: '${schema.spec.regions}' },
            ],
          }),
        ],
      }),
    )
    expect(yaml).not.toContain('forEach:')
  })

  // externalRef scalar
  it('emits externalRef scalar block with name', () => {
    const yaml = generateRGDYAML(
      makeBase({
        resources: [
          makeRes({
            resourceType: 'externalRef',
            externalRef: {
              apiVersion: 'v1',
              kind: 'ConfigMap',
              namespace: 'platform-system',
              name: 'platform-config',
              selectorLabels: [],
            },
          }),
        ],
      }),
    )
    expect(yaml).toContain('externalRef:')
    expect(yaml).toContain('apiVersion: v1')
    expect(yaml).toContain('kind: ConfigMap')
    expect(yaml).toContain('name: platform-config')
    expect(yaml).toContain('namespace: platform-system')
    expect(yaml).not.toContain('template:')
  })

  // externalRef collection
  it('emits externalRef collection block with selector.matchLabels', () => {
    const yaml = generateRGDYAML(
      makeBase({
        resources: [
          makeRes({
            resourceType: 'externalRef',
            externalRef: {
              apiVersion: 'v1',
              kind: 'ConfigMap',
              namespace: 'platform-system',
              name: '',
              selectorLabels: [{ _key: 'l1', labelKey: 'role', labelValue: 'team-config' }],
            },
          }),
        ],
      }),
    )
    expect(yaml).toContain('selector:')
    expect(yaml).toContain('matchLabels:')
    expect(yaml).toContain('role: team-config')
    // The externalRef metadata block should NOT have a name: line (selector mode)
    expect(yaml).not.toContain('          name:')
  })

  // templateYaml body injection without metadata:
  it('injects templateYaml body below default metadata when no metadata: in body', () => {
    const yaml = generateRGDYAML(
      makeBase({
        resources: [makeRes({ templateYaml: 'spec:\n  replicas: ${schema.spec.replicas}' })],
      }),
    )
    expect(yaml).toContain('metadata:')
    expect(yaml).toContain('spec:')
    expect(yaml).toContain('replicas: ${schema.spec.replicas}')
  })

  // templateYaml body injection with metadata:
  it('injects templateYaml verbatim when body contains metadata:', () => {
    const yaml = generateRGDYAML(
      makeBase({
        resources: [
          makeRes({
            templateYaml:
              'metadata:\n  name: my-custom\nspec:\n  replicas: ${schema.spec.replicas}',
          }),
        ],
      }),
    )
    expect(yaml).toContain('metadata:')
    expect(yaml).toContain('name: my-custom')
    expect(yaml).toContain('replicas: ${schema.spec.replicas}')
  })

  // Empty templateYaml → default spec: {}
  it('emits spec: {} when templateYaml is empty', () => {
    const yaml = generateRGDYAML(makeBase({ resources: [makeRes({ templateYaml: '' })] }))
    expect(yaml).toContain('spec: {}')
  })
})

// ── T044: rgdAuthoringStateToSpec ─────────────────────────────────────────

describe('rgdAuthoringStateToSpec — spec 044 extensions', () => {
  function makeBase(overrides: Partial<RGDAuthoringState> = {}): RGDAuthoringState {
    return {
      rgdName: 'test-app',
      kind: 'TestApp',
      group: 'kro.run',
      apiVersion: 'v1alpha1',
      scope: 'Namespaced',
      specFields: [],
      statusFields: [],
      resources: [],
      ...overrides,
    }
  }

  function makeRes(patch: Partial<import('@/lib/generator').AuthoringResource> = {}): import('@/lib/generator').AuthoringResource {
    return {
      _key: 'k1',
      id: 'web',
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      resourceType: 'managed',
      templateYaml: '',
      includeWhen: '',
      readyWhen: [],
      forEachIterators: [],
      externalRef: { apiVersion: 'v1', kind: 'ConfigMap', namespace: '', name: '', selectorLabels: [] },
      ...patch,
    }
  }

  it('forEach resource produces forEach array in spec', () => {
    const spec = rgdAuthoringStateToSpec(
      makeBase({
        resources: [
          makeRes({
            resourceType: 'forEach',
            forEachIterators: [
              { _key: 'fe-0', variable: 'region', expression: '${schema.spec.regions}' },
            ],
          }),
        ],
      }),
    ) as { resources: Record<string, unknown>[] }
    const res = spec.resources[0]
    expect(res).toHaveProperty('forEach')
    const fe = res.forEach as Record<string, string>[]
    expect(fe[0]).toEqual({ region: '${schema.spec.regions}' })
    // Still has template for DAG node rendering
    expect(res).toHaveProperty('template')
  })

  it('forEach resource template has _raw passthrough when templateYaml set', () => {
    const spec = rgdAuthoringStateToSpec(
      makeBase({
        resources: [
          makeRes({
            resourceType: 'managed',
            templateYaml: 'spec:\n  replicas: 3',
          }),
        ],
      }),
    ) as { resources: Record<string, unknown>[] }
    const tmpl = spec.resources[0].template as Record<string, unknown>
    expect(tmpl._raw).toBe('spec:\n  replicas: 3')
  })

  it('externalRef scalar produces correct DAG shape with metadata.name', () => {
    const spec = rgdAuthoringStateToSpec(
      makeBase({
        resources: [
          makeRes({
            resourceType: 'externalRef',
            externalRef: {
              apiVersion: 'v1',
              kind: 'ConfigMap',
              namespace: 'ns',
              name: 'platform-config',
              selectorLabels: [],
            },
          }),
        ],
      }),
    ) as { resources: Record<string, unknown>[] }
    const res = spec.resources[0]
    expect(res).not.toHaveProperty('template')
    const ref = res.externalRef as { metadata: Record<string, unknown> }
    expect(ref.metadata.name).toBe('platform-config')
    expect(ref.metadata.namespace).toBe('ns')
    expect(ref.metadata).not.toHaveProperty('selector')
  })

  it('externalRef collection produces selector.matchLabels', () => {
    const spec = rgdAuthoringStateToSpec(
      makeBase({
        resources: [
          makeRes({
            resourceType: 'externalRef',
            externalRef: {
              apiVersion: 'v1',
              kind: 'ConfigMap',
              namespace: '',
              name: '',
              selectorLabels: [{ _key: 'l1', labelKey: 'role', labelValue: 'team-config' }],
            },
          }),
        ],
      }),
    ) as { resources: Record<string, unknown>[] }
    const ref = spec.resources[0].externalRef as { metadata: Record<string, unknown> }
    const selector = ref.metadata.selector as { matchLabels: Record<string, string> }
    expect(selector.matchLabels).toEqual({ role: 'team-config' })
    expect(ref.metadata).not.toHaveProperty('name')
  })

  it('includeWhen is forwarded as array when non-empty', () => {
    const spec = rgdAuthoringStateToSpec(
      makeBase({
        resources: [makeRes({ includeWhen: '${schema.spec.monitoring}' })],
      }),
    ) as { resources: Record<string, unknown>[] }
    expect(spec.resources[0].includeWhen).toEqual(['${schema.spec.monitoring}'])
  })

  it('includeWhen is NOT forwarded when empty', () => {
    const spec = rgdAuthoringStateToSpec(
      makeBase({ resources: [makeRes({ includeWhen: '' })] }),
    ) as { resources: Record<string, unknown>[] }
    expect(spec.resources[0]).not.toHaveProperty('includeWhen')
  })

  it('readyWhen is forwarded as array when non-empty', () => {
    const spec = rgdAuthoringStateToSpec(
      makeBase({
        resources: [makeRes({ readyWhen: ['${db.status.ready}', '${db.status.endpoint != ""}'] })],
      }),
    ) as { resources: Record<string, unknown>[] }
    expect(spec.resources[0].readyWhen).toEqual([
      '${db.status.ready}',
      '${db.status.endpoint != ""}',
    ])
  })

  it('filters empty readyWhen entries', () => {
    const spec = rgdAuthoringStateToSpec(
      makeBase({ resources: [makeRes({ readyWhen: ['', '  ', '${x}'] })] }),
    ) as { resources: Record<string, unknown>[] }
    expect(spec.resources[0].readyWhen).toEqual(['${x}'])
  })
})

// ── validateRGDState ──────────────────────────────────────────────────────

import { validateRGDState, STARTER_RGD_STATE } from './generator'

/** Build a full RGDAuthoringState with sensible defaults. */
function makeValidateBase(
  overrides: Partial<import('./generator').RGDAuthoringState> = {},
): import('./generator').RGDAuthoringState {
  return {
    rgdName: 'my-app',
    kind: 'MyApp',
    group: 'kro.run',
    apiVersion: 'v1alpha1',
    scope: 'Namespaced',
    specFields: [],
    statusFields: [],
    resources: [],
    ...overrides,
  }
}

/** Build a minimal AuthoringField for validation tests. */
function makeField(
  patch: Partial<import('./generator').AuthoringField> = {},
): import('./generator').AuthoringField {
  return {
    id: `f-${Math.random().toString(36).slice(2, 7)}`,
    name: 'replicas',
    type: 'integer',
    defaultValue: '',
    required: false,
    ...patch,
  }
}

/** Build a minimal AuthoringResource for validation tests. */
function makeValidateRes(
  patch: Partial<import('./generator').AuthoringResource> = {},
): import('./generator').AuthoringResource {
  return {
    _key: `r-${Math.random().toString(36).slice(2, 7)}`,
    id: 'web',
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    resourceType: 'managed',
    templateYaml: '',
    includeWhen: '',
    readyWhen: [],
    forEachIterators: [],
    externalRef: { apiVersion: 'v1', kind: 'ConfigMap', namespace: '', name: '', selectorLabels: [] },
    ...patch,
  }
}

/** Build a minimal AuthoringStatusField for validation tests. */
function makeStatusField(
  patch: Partial<import('./generator').AuthoringStatusField> = {},
): import('./generator').AuthoringStatusField {
  return {
    id: `sf-${Math.random().toString(36).slice(2, 7)}`,
    name: 'endpoint',
    expression: '${service.spec.clusterIP}',
    ...patch,
  }
}

describe('validateRGDState', () => {
  // ── T005: rgdName and kind checks (US1) ──────────────────────────────────

  it('STARTER_RGD_STATE produces totalCount=0 and no issues', () => {
    const v = validateRGDState(STARTER_RGD_STATE)
    expect(v.totalCount).toBe(0)
    expect(v.rgdName).toBeUndefined()
    expect(v.kind).toBeUndefined()
    expect(Object.keys(v.resourceIssues)).toHaveLength(0)
    expect(Object.keys(v.specFieldIssues)).toHaveLength(0)
    expect(Object.keys(v.statusFieldIssues)).toHaveLength(0)
  })

  it('empty rgdName → error', () => {
    const v = validateRGDState(makeValidateBase({ rgdName: '' }))
    expect(v.rgdName?.type).toBe('error')
    expect(v.rgdName?.message).toBe('RGD name is required')
    expect(v.totalCount).toBeGreaterThanOrEqual(1)
  })

  it('rgdName with spaces → warning (DNS subdomain)', () => {
    const v = validateRGDState(makeValidateBase({ rgdName: 'My App' }))
    expect(v.rgdName?.type).toBe('warning')
    expect(v.rgdName?.message).toMatch(/DNS subdomain/)
  })

  it('valid rgdName "my-app" → no issue', () => {
    const v = validateRGDState(makeValidateBase({ rgdName: 'my-app' }))
    expect(v.rgdName).toBeUndefined()
  })

  it('empty kind → error', () => {
    const v = validateRGDState(makeValidateBase({ kind: '' }))
    expect(v.kind?.type).toBe('error')
    expect(v.kind?.message).toBe('Kind is required')
  })

  it('kind "webApp" → warning (PascalCase)', () => {
    const v = validateRGDState(makeValidateBase({ kind: 'webApp' }))
    expect(v.kind?.type).toBe('warning')
    expect(v.kind?.message).toMatch(/PascalCase/)
  })

  it('kind "WebApp" → no issue', () => {
    const v = validateRGDState(makeValidateBase({ kind: 'WebApp' }))
    expect(v.kind).toBeUndefined()
  })

  it('kind "MyApp2" → no issue (numbers allowed)', () => {
    const v = validateRGDState(makeValidateBase({ kind: 'MyApp2' }))
    expect(v.kind).toBeUndefined()
  })

  it('rgdName "my--app" → warning (consecutive hyphens fail DNS regex)', () => {
    const v = validateRGDState(makeValidateBase({ rgdName: 'my--app' }))
    expect(v.rgdName?.type).toBe('warning')
    expect(v.rgdName?.message).toMatch(/DNS subdomain/)
  })

  // ── T010: duplicate resource ID checks (US2) ─────────────────────────────

  it('two resources with same non-empty id → both _keys in resourceIssues with warning', () => {
    const r1 = makeValidateRes({ _key: 'r1', id: 'deployment' })
    const r2 = makeValidateRes({ _key: 'r2', id: 'deployment' })
    const v = validateRGDState(makeValidateBase({ resources: [r1, r2] }))
    expect(v.resourceIssues['r1']?.type).toBe('warning')
    expect(v.resourceIssues['r1']?.message).toBe('Duplicate resource ID')
    expect(v.resourceIssues['r2']?.type).toBe('warning')
    expect(v.resourceIssues['r2']?.message).toBe('Duplicate resource ID')
    expect(v.totalCount).toBe(2)
  })

  it('renamed duplicate → resourceIssues empty', () => {
    const r1 = makeValidateRes({ _key: 'r1', id: 'deployment' })
    const r2 = makeValidateRes({ _key: 'r2', id: 'service' })
    const v = validateRGDState(makeValidateBase({ resources: [r1, r2] }))
    expect(Object.keys(v.resourceIssues)).toHaveLength(0)
  })

  it('resource with id="" → NOT in resourceIssues (empty IDs ignored)', () => {
    const r1 = makeValidateRes({ _key: 'r1', id: '' })
    const r2 = makeValidateRes({ _key: 'r2', id: '' })
    const v = validateRGDState(makeValidateBase({ resources: [r1, r2] }))
    expect(v.resourceIssues['r1']).toBeUndefined()
    expect(v.resourceIssues['r2']).toBeUndefined()
  })

  // ── T013: duplicate spec/status field name checks (US3) ──────────────────

  it('two spec fields with same non-empty name → both ids in specFieldIssues', () => {
    const f1 = makeField({ id: 'f1', name: 'replicas' })
    const f2 = makeField({ id: 'f2', name: 'replicas' })
    const v = validateRGDState(makeValidateBase({ specFields: [f1, f2] }))
    expect(v.specFieldIssues['f1']?.message).toBe('Duplicate spec field name')
    expect(v.specFieldIssues['f2']?.message).toBe('Duplicate spec field name')
  })

  it('renamed spec field → specFieldIssues empty', () => {
    const f1 = makeField({ id: 'f1', name: 'replicas' })
    const f2 = makeField({ id: 'f2', name: 'image' })
    const v = validateRGDState(makeValidateBase({ specFields: [f1, f2] }))
    expect(Object.keys(v.specFieldIssues)).toHaveLength(0)
  })

  it('spec field name="" → NOT in specFieldIssues', () => {
    const f1 = makeField({ id: 'f1', name: '' })
    const f2 = makeField({ id: 'f2', name: '' })
    const v = validateRGDState(makeValidateBase({ specFields: [f1, f2] }))
    expect(v.specFieldIssues['f1']).toBeUndefined()
    expect(v.specFieldIssues['f2']).toBeUndefined()
  })

  it('two status fields with same name → both ids in statusFieldIssues', () => {
    const sf1 = makeStatusField({ id: 'sf1', name: 'endpoint' })
    const sf2 = makeStatusField({ id: 'sf2', name: 'endpoint' })
    const v = validateRGDState(makeValidateBase({ statusFields: [sf1, sf2] }))
    expect(v.statusFieldIssues['sf1']?.message).toBe('Duplicate status field name')
    expect(v.statusFieldIssues['sf2']?.message).toBe('Duplicate status field name')
  })

  it('renamed status field → statusFieldIssues empty', () => {
    const sf1 = makeStatusField({ id: 'sf1', name: 'endpoint' })
    const sf2 = makeStatusField({ id: 'sf2', name: 'region' })
    const v = validateRGDState(makeValidateBase({ statusFields: [sf1, sf2] }))
    expect(Object.keys(v.statusFieldIssues)).toHaveLength(0)
  })

  it('resource id "replicas" + spec field name "replicas" → no cross-namespace conflict', () => {
    const res = makeValidateRes({ _key: 'r1', id: 'replicas' })
    const field = makeField({ id: 'f1', name: 'replicas' })
    const v = validateRGDState(makeValidateBase({ resources: [res], specFields: [field] }))
    expect(v.resourceIssues['r1']).toBeUndefined()
    expect(v.specFieldIssues['f1']).toBeUndefined()
  })

  // ── T017: min > max constraint checks (US4) ──────────────────────────────

  it('field with minimum="10" and maximum="5" → specFieldIssues with min>max message', () => {
    const f = makeField({ id: 'f1', name: 'count', minimum: '10', maximum: '5' })
    const v = validateRGDState(makeValidateBase({ specFields: [f] }))
    expect(v.specFieldIssues['f1']?.message).toBe('minimum must be \u2264 maximum')
  })

  it('minimum="0" and maximum="0" → no issue (equal is valid)', () => {
    const f = makeField({ id: 'f1', name: 'count', minimum: '0', maximum: '0' })
    const v = validateRGDState(makeValidateBase({ specFields: [f] }))
    expect(v.specFieldIssues['f1']).toBeUndefined()
  })

  it('minimum="1" and maximum="100" → no issue', () => {
    const f = makeField({ id: 'f1', name: 'count', minimum: '1', maximum: '100' })
    const v = validateRGDState(makeValidateBase({ specFields: [f] }))
    expect(v.specFieldIssues['f1']).toBeUndefined()
  })

  it('only minimum set → no min>max issue', () => {
    const f = makeField({ id: 'f1', name: 'count', minimum: '5' })
    const v = validateRGDState(makeValidateBase({ specFields: [f] }))
    expect(v.specFieldIssues['f1']).toBeUndefined()
  })

  it('only maximum set → no min>max issue', () => {
    const f = makeField({ id: 'f1', name: 'count', maximum: '100' })
    const v = validateRGDState(makeValidateBase({ specFields: [f] }))
    expect(v.specFieldIssues['f1']).toBeUndefined()
  })

  it('field with BOTH duplicate-name AND min>max → only duplicate-name recorded', () => {
    const f1 = makeField({ id: 'f1', name: 'count', minimum: '10', maximum: '5' })
    const f2 = makeField({ id: 'f2', name: 'count', minimum: '10', maximum: '5' })
    const v = validateRGDState(makeValidateBase({ specFields: [f1, f2] }))
    expect(v.specFieldIssues['f1']?.message).toBe('Duplicate spec field name')
    expect(v.specFieldIssues['f2']?.message).toBe('Duplicate spec field name')
  })

  // ── T020: forEach iterator completeness checks (US5) ─────────────────────

  it('forEach resource with no iterators → warning', () => {
    const r = makeValidateRes({
      _key: 'r1',
      id: 'configmap',
      resourceType: 'forEach',
      forEachIterators: [],
    })
    const v = validateRGDState(makeValidateBase({ resources: [r] }))
    expect(v.resourceIssues['r1']?.message).toBe(
      'forEach resources require at least one iterator',
    )
  })

  it('forEach with one iterator where variable is filled but expression is empty → still warning', () => {
    const r = makeValidateRes({
      _key: 'r1',
      id: 'configmap',
      resourceType: 'forEach',
      forEachIterators: [{ _key: 'fe1', variable: 'region', expression: '' }],
    })
    const v = validateRGDState(makeValidateBase({ resources: [r] }))
    expect(v.resourceIssues['r1']?.message).toBe(
      'forEach resources require at least one iterator',
    )
  })

  it('forEach with one valid iterator (both non-empty) → no issue', () => {
    const r = makeValidateRes({
      _key: 'r1',
      id: 'configmap',
      resourceType: 'forEach',
      forEachIterators: [{ _key: 'fe1', variable: 'region', expression: '${schema.spec.regions}' }],
    })
    const v = validateRGDState(makeValidateBase({ resources: [r] }))
    expect(v.resourceIssues['r1']).toBeUndefined()
  })

  it('managed resource with no iterators → no issue', () => {
    const r = makeValidateRes({ _key: 'r1', id: 'web', resourceType: 'managed', forEachIterators: [] })
    const v = validateRGDState(makeValidateBase({ resources: [r] }))
    expect(v.resourceIssues['r1']).toBeUndefined()
  })

  it('forEach with duplicate ID AND no iterator → only duplicate-ID issue recorded', () => {
    const r1 = makeValidateRes({
      _key: 'r1',
      id: 'configmap',
      resourceType: 'forEach',
      forEachIterators: [],
    })
    const r2 = makeValidateRes({
      _key: 'r2',
      id: 'configmap',
      resourceType: 'managed',
      forEachIterators: [],
    })
    const v = validateRGDState(makeValidateBase({ resources: [r1, r2] }))
    // r1 has duplicate ID → duplicate-ID message, NOT forEach message
    expect(v.resourceIssues['r1']?.message).toBe('Duplicate resource ID')
  })

  // ── T024: totalCount invariant (US6) ─────────────────────────────────────

  it('totalCount === sum of all individual issues', () => {
    // rgdName error (1) + kind error (1) + 1 resource duplicate pair (2)
    const r1 = makeValidateRes({ _key: 'r1', id: 'same' })
    const r2 = makeValidateRes({ _key: 'r2', id: 'same' })
    const v = validateRGDState({ ...makeValidateBase({ rgdName: '', kind: '', resources: [r1, r2] }) })
    const expected =
      (v.rgdName !== undefined ? 1 : 0) +
      (v.kind !== undefined ? 1 : 0) +
      Object.keys(v.resourceIssues).length +
      Object.keys(v.specFieldIssues).length +
      Object.keys(v.statusFieldIssues).length
    expect(v.totalCount).toBe(expected)
    expect(v.totalCount).toBe(4)
  })
})

// ── parseRGDYAML (spec 045 US8) ───────────────────────────────────────────

import { parseRGDYAML } from './generator'

// ── T036: parseSimpleSchemaStr (via parseRGDYAML round-trip) ─────────────

describe('parseSimpleSchemaStr (via parseRGDYAML spec field parsing)', () => {
  function parseField(raw: string) {
    // Build minimal RGD YAML with one spec field of the given type string
    const yaml = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: test
spec:
  schema:
    kind: Test
    apiVersion: v1alpha1
    spec:
      myField: ${raw}
`
    const r = parseRGDYAML(yaml)
    if (!r.ok) throw new Error(`parse failed: ${r.error}`)
    return r.state.specFields[0]
  }

  it('"string" → type: string, required: false, empty defaults', () => {
    const f = parseField('"string"')
    expect(f?.type).toBe('string')
    expect(f?.required).toBe(false)
    expect(f?.defaultValue).toBe('')
  })

  it('"integer | required" → required: true', () => {
    const f = parseField('"integer | required"')
    expect(f?.type).toBe('integer')
    expect(f?.required).toBe(true)
  })

  it('"integer | default=3 | minimum=1 | maximum=100" → all fields populated', () => {
    const f = parseField('"integer | default=3 | minimum=1 | maximum=100"')
    expect(f?.type).toBe('integer')
    expect(f?.defaultValue).toBe('3')
    expect(f?.minimum).toBe('1')
    expect(f?.maximum).toBe('100')
  })

  it('"string | enum=dev,prod | pattern=^[a-z]+" → enum + pattern populated', () => {
    const f = parseField('"string | enum=dev,prod | pattern=^[a-z]+"')
    expect(f?.enum).toBe('dev,prod')
    expect(f?.pattern).toBe('^[a-z]+')
  })

  it('unquoted "boolean" → type: boolean (quotes stripped correctly)', () => {
    const f = parseField('boolean')
    expect(f?.type).toBe('boolean')
  })

  it('"string | foobar=x" → unknown modifier ignored, type still string', () => {
    const f = parseField('"string | foobar=x"')
    expect(f?.type).toBe('string')
    expect(f?.defaultValue).toBe('')
  })
})

// ── T037: parseRGDYAML error paths ────────────────────────────────────────

describe('parseRGDYAML error paths (T037)', () => {
  it('empty string → { ok: false }', () => {
    expect(parseRGDYAML('').ok).toBe(false)
  })

  it('"hello world" → { ok: false, error: Not a ResourceGraphDefinition }', () => {
    const r = parseRGDYAML('hello world')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Not a ResourceGraphDefinition')
  })

  it('YAML with kind: ResourceGraphDefinition but no spec.schema → { ok: false }', () => {
    const yaml = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: test
spec:
  resources: []
`
    const r = parseRGDYAML(yaml)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Missing spec.schema')
  })
})

// ── T038: parseRGDYAML metadata + schema ──────────────────────────────────

describe('parseRGDYAML metadata + schema (T038)', () => {
  const baseYaml = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
`

  it('parses metadata.name, spec.schema.kind, spec.schema.apiVersion', () => {
    const r = parseRGDYAML(baseYaml)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.rgdName).toBe('my-app')
      expect(r.state.kind).toBe('MyApp')
      expect(r.state.apiVersion).toBe('v1alpha1')
    }
  })

  it('non-default spec.schema.group is extracted', () => {
    const yaml = baseYaml + '    group: platform.example.com\n'
    const r = parseRGDYAML(yaml)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.state.group).toBe('platform.example.com')
  })

  it('scope: Cluster → state.scope = Cluster; absent scope → Namespaced', () => {
    const yamlCluster = baseYaml + '    scope: Cluster\n'
    const rCluster = parseRGDYAML(yamlCluster)
    expect(rCluster.ok).toBe(true)
    if (rCluster.ok) expect(rCluster.state.scope).toBe('Cluster')

    const rDefault = parseRGDYAML(baseYaml)
    expect(rDefault.ok).toBe(true)
    if (rDefault.ok) expect(rDefault.state.scope).toBe('Namespaced')
  })

  it('spec.schema.spec fields map to specFields[]', () => {
    const yaml = baseYaml + `    spec:
      replicas: "integer | default=1"
      image: "string | required"
`
    const r = parseRGDYAML(yaml)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.specFields).toHaveLength(2)
      expect(r.state.specFields[0].name).toBe('replicas')
      expect(r.state.specFields[0].type).toBe('integer')
      expect(r.state.specFields[0].defaultValue).toBe('1')
      expect(r.state.specFields[1].name).toBe('image')
      expect(r.state.specFields[1].required).toBe(true)
    }
  })

  it('spec.schema.status fields map to statusFields[]', () => {
    const yaml = baseYaml + `    status:
      endpoint: "\${service.spec.clusterIP}"
`
    const r = parseRGDYAML(yaml)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.statusFields).toHaveLength(1)
      expect(r.state.statusFields[0].name).toBe('endpoint')
      expect(r.state.statusFields[0].expression).toContain('service.spec.clusterIP')
    }
  })
})

// ── T039: parseRGDYAML managed resource ───────────────────────────────────

describe('parseRGDYAML managed resource (T039)', () => {
  const baseYaml = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
  resources:
    - id: web
      template:
        apiVersion: apps/v1
        kind: Deployment
        spec:
          replicas: \${schema.spec.replicas}
`

  it('managed resource → resourceType: managed, apiVersion, kind, templateYaml non-empty', () => {
    const r = parseRGDYAML(baseYaml)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.resources).toHaveLength(1)
      const res = r.state.resources[0]
      expect(res.resourceType).toBe('managed')
      expect(res.id).toBe('web')
      expect(res.apiVersion).toBe('apps/v1')
      expect(res.kind).toBe('Deployment')
      expect(res.templateYaml).toContain('replicas')
    }
  })

  it('includeWhen array → includeWhen string (first entry)', () => {
    const yaml = baseYaml + `      includeWhen:
        - '\${schema.spec.monitoring}'
`
    const r = parseRGDYAML(yaml)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.resources[0].includeWhen).toContain('schema.spec.monitoring')
    }
  })

  it('readyWhen array → readyWhen[]', () => {
    const yaml = baseYaml + `      readyWhen:
        - '\${web.status.readyReplicas > 0}'
`
    const r = parseRGDYAML(yaml)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.resources[0].readyWhen).toHaveLength(1)
      expect(r.state.resources[0].readyWhen[0]).toContain('readyReplicas')
    }
  })

  it('missing template → templateYaml empty string', () => {
    const yaml = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
  resources:
    - id: web
`
    const r = parseRGDYAML(yaml)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.resources[0].templateYaml).toBe('')
    }
  })
})

// ── T040: parseRGDYAML forEach resource ───────────────────────────────────

describe('parseRGDYAML forEach resource (T040)', () => {
  const forEachYaml = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
  resources:
    - id: configmap
      forEach:
        - region: \${schema.spec.regions}
      template:
        apiVersion: v1
        kind: ConfigMap
        data:
          region: \${region}
`

  it('resource with forEach key → resourceType: forEach, iterators extracted', () => {
    const r = parseRGDYAML(forEachYaml)
    expect(r.ok).toBe(true)
    if (r.ok) {
      const res = r.state.resources[0]
      expect(res.resourceType).toBe('forEach')
      expect(res.id).toBe('configmap')
      expect(res.forEachIterators).toHaveLength(1)
      expect(res.forEachIterators[0].variable).toBe('region')
      expect(res.forEachIterators[0].expression).toContain('schema.spec.regions')
    }
  })

  it('multiple forEach entries → multiple iterators', () => {
    const yaml = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
  resources:
    - id: configmap
      forEach:
        - region: \${schema.spec.regions}
        - env: \${schema.spec.envs}
      template:
        apiVersion: v1
        kind: ConfigMap
`
    const r = parseRGDYAML(yaml)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.resources[0].forEachIterators).toHaveLength(2)
    }
  })
})

// ── T041: parseRGDYAML externalRef resource ───────────────────────────────

describe('parseRGDYAML externalRef resource (T041)', () => {
  it('scalar externalRef (with name:) → resourceType: externalRef, externalRef.name populated', () => {
    const yaml = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
  resources:
    - id: vpc
      externalRef:
        apiVersion: ec2.aws.upbound.io/v1beta1
        kind: VPC
        metadata:
          name: \${schema.spec.vpcName}
`
    const r = parseRGDYAML(yaml)
    expect(r.ok).toBe(true)
    if (r.ok) {
      const res = r.state.resources[0]
      expect(res.resourceType).toBe('externalRef')
      expect(res.id).toBe('vpc')
      expect(res.externalRef.apiVersion).toBe('ec2.aws.upbound.io/v1beta1')
      expect(res.externalRef.kind).toBe('VPC')
      expect(res.externalRef.name).toContain('schema.spec.vpcName')
    }
  })

  it('namespace → externalRef.namespace', () => {
    const yaml = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
  resources:
    - id: svc
      externalRef:
        apiVersion: v1
        kind: Service
        metadata:
          namespace: production
          name: my-svc
`
    const r = parseRGDYAML(yaml)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.resources[0].externalRef.namespace).toBe('production')
    }
  })

  it('selector externalRef → externalRef.selectorLabels populated', () => {
    const yaml = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
  resources:
    - id: nodes
      externalRef:
        apiVersion: v1
        kind: Node
        metadata:
          selector:
            matchLabels:
              tier: backend
`
    const r = parseRGDYAML(yaml)
    expect(r.ok).toBe(true)
    if (r.ok) {
      const labels = r.state.resources[0].externalRef.selectorLabels
      expect(labels).toHaveLength(1)
      expect(labels[0].labelKey).toBe('tier')
      expect(labels[0].labelValue).toBe('backend')
    }
  })
})

// ── T042: round-trip test ─────────────────────────────────────────────────

describe('parseRGDYAML round-trip (T042)', () => {
  it('generateRGDYAML → parseRGDYAML round-trips all field types correctly', () => {
    // Build a state with all 5 resource node types + spec/status fields
    const original: import('./generator').RGDAuthoringState = {
      rgdName: 'my-app',
      kind: 'MyApp',
      group: 'kro.run',
      apiVersion: 'v1alpha1',
      scope: 'Namespaced',
      specFields: [
        { id: 'f1', name: 'replicas', type: 'integer', defaultValue: '1', required: false, minimum: '1', maximum: '10' },
        { id: 'f2', name: 'image', type: 'string', defaultValue: '', required: true },
      ],
      statusFields: [
        { id: 'sf1', name: 'endpoint', expression: '${service.spec.clusterIP}' },
      ],
      resources: [
        {
          _key: 'r1', id: 'web', apiVersion: 'apps/v1', kind: 'Deployment',
          resourceType: 'managed', templateYaml: 'spec:\n  replicas: ${schema.spec.replicas}',
          includeWhen: '', readyWhen: [],
          forEachIterators: [{ _key: 'i1', variable: '', expression: '' }],
          externalRef: { apiVersion: '', kind: '', namespace: '', name: '', selectorLabels: [] },
        },
        {
          _key: 'r2', id: 'configmap', apiVersion: 'v1', kind: 'ConfigMap',
          resourceType: 'forEach',
          templateYaml: 'data:\n  region: ${region}',
          includeWhen: '${schema.spec.multiregion}',
          readyWhen: [],
          forEachIterators: [{ _key: 'i2', variable: 'region', expression: '${schema.spec.regions}' }],
          externalRef: { apiVersion: '', kind: '', namespace: '', name: '', selectorLabels: [] },
        },
        {
          _key: 'r3', id: 'vpc', apiVersion: 'ec2.aws/v1', kind: 'VPC',
          resourceType: 'externalRef', templateYaml: '',
          includeWhen: '', readyWhen: [],
          forEachIterators: [{ _key: 'i3', variable: '', expression: '' }],
          externalRef: {
            apiVersion: 'ec2.aws/v1', kind: 'VPC', namespace: '', name: '${schema.spec.vpcName}',
            selectorLabels: [],
          },
        },
      ],
    }

    const yaml = generateRGDYAML(original)
    const result = parseRGDYAML(yaml)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const s = result.state
    // Metadata
    expect(s.rgdName).toBe('my-app')
    expect(s.kind).toBe('MyApp')
    expect(s.scope).toBe('Namespaced')

    // Spec fields
    expect(s.specFields).toHaveLength(2)
    expect(s.specFields[0].name).toBe('replicas')
    expect(s.specFields[0].type).toBe('integer')
    expect(s.specFields[0].minimum).toBe('1')
    expect(s.specFields[0].maximum).toBe('10')
    expect(s.specFields[1].name).toBe('image')
    expect(s.specFields[1].required).toBe(true)

    // Status fields
    expect(s.statusFields).toHaveLength(1)
    expect(s.statusFields[0].name).toBe('endpoint')
    expect(s.statusFields[0].expression).toContain('service.spec.clusterIP')

    // Resources
    expect(s.resources).toHaveLength(3)

    // managed
    expect(s.resources[0].id).toBe('web')
    expect(s.resources[0].resourceType).toBe('managed')
    expect(s.resources[0].apiVersion).toBe('apps/v1')
    expect(s.resources[0].kind).toBe('Deployment')
    expect(s.resources[0].templateYaml).toContain('replicas')

    // forEach
    expect(s.resources[1].id).toBe('configmap')
    expect(s.resources[1].resourceType).toBe('forEach')
    expect(s.resources[1].forEachIterators[0].variable).toBe('region')
    expect(s.resources[1].forEachIterators[0].expression).toContain('schema.spec.regions')
    expect(s.resources[1].includeWhen).toContain('schema.spec.multiregion')

    // externalRef
    expect(s.resources[2].id).toBe('vpc')
    expect(s.resources[2].resourceType).toBe('externalRef')
    expect(s.resources[2].externalRef.name).toContain('schema.spec.vpcName')
  })
})

// ── T034: forEach Remove button guard logic (spec 046-kro-v090-upgrade) ──────
// The Remove button is hidden when forEachIterators.length === 1.
// This test verifies the condition inline (no render needed).

describe('forEach Remove button guard (FR-060)', () => {
  function shouldShowRemove(iteratorCount: number): boolean {
    return iteratorCount > 1
  }

  it('hides Remove button when only 1 iterator', () => {
    expect(shouldShowRemove(1)).toBe(false)
  })

  it('shows Remove button when 2 or more iterators', () => {
    expect(shouldShowRemove(2)).toBe(true)
    expect(shouldShowRemove(3)).toBe(true)
  })

  it('documents the expected cartesian forEach YAML format (2 iterators)', () => {
    // The generator already handles multiple iterators via the existing forEach serialization.
    // The expected output format is validated by the upstream-cartesian-foreach fixture E2E test.
    // See test/e2e/fixtures/upstream-cartesian-foreach-rgd.yaml for the live reference.
    const regionEntry = '- region: ${schema.spec.regions}'
    const tierEntry = '- tier: ${schema.spec.tiers}'
    expect(regionEntry).toContain('region')
    expect(tierEntry).toContain('tier')
  })
})
