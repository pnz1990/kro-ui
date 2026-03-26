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
