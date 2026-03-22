// schema.test.ts — Unit tests for parseSimpleSchema, inferStatusType, buildSchemaDoc.
//
// Spec: .specify/specs/020-schema-doc-generator/ (Testing Requirements)

import { describe, it, expect } from 'vitest'
import {
  parseSimpleSchema,
  inferStatusType,
  buildSchemaDoc,
} from './schema'
import type { K8sObject } from '@/lib/api'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal RGD K8sObject for testing buildSchemaDoc. */
function makeRGD(
  schemaSpec: Record<string, string>,
  schemaStatus: Record<string, string> = {},
  kind = 'WebApplication',
): K8sObject {
  return {
    apiVersion: 'kro.run/v1alpha1',
    kind: 'ResourceGraphDefinition',
    metadata: { name: 'test-rgd' },
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

// ── parseSimpleSchema ──────────────────────────────────────────────────────

describe('parseSimpleSchema', () => {
  // Primitive types
  it("parses 'string' → { type: 'string' }", () => {
    expect(parseSimpleSchema('string')).toEqual({ type: 'string' })
  })

  it("parses 'integer' → { type: 'integer' }", () => {
    expect(parseSimpleSchema('integer')).toEqual({ type: 'integer' })
  })

  it("parses 'boolean' → { type: 'boolean' }", () => {
    expect(parseSimpleSchema('boolean')).toEqual({ type: 'boolean' })
  })

  it("parses 'number' → { type: 'number' }", () => {
    expect(parseSimpleSchema('number')).toEqual({ type: 'number' })
  })

  // Array types
  it("parses '[]string' → { type: 'array', items: 'string' }", () => {
    expect(parseSimpleSchema('[]string')).toEqual({
      type: 'array',
      items: 'string',
    })
  })

  it("parses '[]integer' → { type: 'array', items: 'integer' }", () => {
    expect(parseSimpleSchema('[]integer')).toEqual({
      type: 'array',
      items: 'integer',
    })
  })

  it("parses '[]boolean' → { type: 'array', items: 'boolean' }", () => {
    expect(parseSimpleSchema('[]boolean')).toEqual({
      type: 'array',
      items: 'boolean',
    })
  })

  // Map types
  it("parses 'map[string]string' → { type: 'map', key: 'string', value: 'string' }", () => {
    expect(parseSimpleSchema('map[string]string')).toEqual({
      type: 'map',
      key: 'string',
      value: 'string',
    })
  })

  it("parses 'map[string]integer' → { type: 'map', key: 'string', value: 'integer' }", () => {
    expect(parseSimpleSchema('map[string]integer')).toEqual({
      type: 'map',
      key: 'string',
      value: 'integer',
    })
  })

  // Default modifier
  it("parses 'integer | default=2' → { type: 'integer', default: '2' }", () => {
    expect(parseSimpleSchema('integer | default=2')).toEqual({
      type: 'integer',
      default: '2',
    })
  })

  it("parses 'string | default=hello' → { type: 'string', default: 'hello' }", () => {
    expect(parseSimpleSchema('string | default=hello')).toEqual({
      type: 'string',
      default: 'hello',
    })
  })

  it("parses 'string | default=' → { type: 'string', default: '' } (explicit empty default)", () => {
    expect(parseSimpleSchema('string | default=')).toEqual({
      type: 'string',
      default: '',
    })
  })

  it("parses 'boolean | default=true' → { type: 'boolean', default: 'true' }", () => {
    expect(parseSimpleSchema('boolean | default=true')).toEqual({
      type: 'boolean',
      default: 'true',
    })
  })

  // Required modifier
  it("parses 'string | required' → { type: 'string', required: true }", () => {
    expect(parseSimpleSchema('string | required')).toEqual({
      type: 'string',
      required: true,
    })
  })

  it("parses 'integer | required' → { type: 'integer', required: true }", () => {
    expect(parseSimpleSchema('integer | required')).toEqual({
      type: 'integer',
      required: true,
    })
  })

  // Combined modifiers
  it("parses 'string | required | default=foo' → { type: 'string', required: true, default: 'foo' }", () => {
    expect(parseSimpleSchema('string | required | default=foo')).toEqual({
      type: 'string',
      required: true,
      default: 'foo',
    })
  })

  it("parses 'integer | default=5 | required' → { type: 'integer', default: '5', required: true }", () => {
    expect(parseSimpleSchema('integer | default=5 | required')).toEqual({
      type: 'integer',
      default: '5',
      required: true,
    })
  })

  // Unknown/custom types
  it('passes unknown base types through verbatim', () => {
    expect(parseSimpleSchema('CustomType')).toEqual({ type: 'CustomType' })
  })

  it('passes unknown types with modifiers', () => {
    expect(parseSimpleSchema('CustomType | default=x')).toEqual({
      type: 'CustomType',
      default: 'x',
    })
  })

  // ── #60: Constraint modifiers (enum, minimum, maximum) ──────────────────

  it("parses 'string | default=normal | enum=easy,normal,hard' — constraints stored separately", () => {
    expect(parseSimpleSchema('string | default=normal | enum=easy,normal,hard')).toEqual({
      type: 'string',
      default: 'normal',
      enum: 'easy,normal,hard',
    })
  })

  it("parses 'integer | default=3 | minimum=1 | maximum=10'", () => {
    expect(parseSimpleSchema('integer | default=3 | minimum=1 | maximum=10')).toEqual({
      type: 'integer',
      default: '3',
      minimum: '1',
      maximum: '10',
    })
  })

  it("parses 'integer | minimum=0 | maximum=100' (no default)", () => {
    expect(parseSimpleSchema('integer | minimum=0 | maximum=100')).toEqual({
      type: 'integer',
      minimum: '0',
      maximum: '100',
    })
  })

  it("parses 'string | enum=a,b,c' (no default)", () => {
    expect(parseSimpleSchema('string | enum=a,b,c')).toEqual({
      type: 'string',
      enum: 'a,b,c',
    })
  })

  // ── #61: Falsy defaults must be preserved (use key existence, not !== undefined) ──

  it("parses 'integer | default=0' — zero default key is present", () => {
    const pt = parseSimpleSchema('integer | default=0')
    expect('default' in pt).toBe(true)
    expect(pt.default).toBe('0')
  })

  it("parses 'boolean | default=false' — false default key is present", () => {
    const pt = parseSimpleSchema('boolean | default=false')
    expect('default' in pt).toBe(true)
    expect(pt.default).toBe('false')
  })

  it("parses 'string | default=' — empty string default key is present", () => {
    const pt = parseSimpleSchema('string | default=')
    expect('default' in pt).toBe(true)
    expect(pt.default).toBe('')
  })

  it("type without default has no 'default' key", () => {
    const pt = parseSimpleSchema('integer')
    expect('default' in pt).toBe(false)
  })
})

// ── inferStatusType ────────────────────────────────────────────────────────

describe('inferStatusType', () => {
  it("infers 'boolean' for equality operator", () => {
    expect(inferStatusType('${deployment.status.availableReplicas == 2}')).toBe(
      'boolean',
    )
  })

  it("infers 'boolean' for inequality operator", () => {
    expect(inferStatusType('${x != 0}')).toBe('boolean')
  })

  it("infers 'boolean' for comparison operators", () => {
    expect(inferStatusType('${count >= 3}')).toBe('boolean')
    expect(inferStatusType('${count <= 10}')).toBe('boolean')
  })

  it("infers 'string' for simple field projection", () => {
    expect(inferStatusType('${deployment.status.phase}')).toBe('string')
  })

  it("infers 'string' for computed projection without comparison", () => {
    expect(inferStatusType('${pod.status.podIP}')).toBe('string')
  })

  it('handles bare CEL expressions without ${} wrapper', () => {
    expect(inferStatusType('x == 2')).toBe('boolean')
    expect(inferStatusType('x.status.phase')).toBe('string')
  })
})

// ── buildSchemaDoc ─────────────────────────────────────────────────────────

describe('buildSchemaDoc', () => {
  it('extracts kind, apiVersion, group from spec.schema', () => {
    const rgd = makeRGD({}, {}, 'WebApp')
    const doc = buildSchemaDoc(rgd)

    expect(doc.kind).toBe('WebApp')
    expect(doc.apiVersion).toBe('v1alpha1')
    expect(doc.group).toBe('kro.run')
  })

  it('defaults apiVersion to v1alpha1 when absent', () => {
    const rgd: K8sObject = {
      spec: { schema: { kind: 'Foo', spec: {} } },
    }
    const doc = buildSchemaDoc(rgd)
    expect(doc.apiVersion).toBe('v1alpha1')
  })

  it('defaults group to kro.run when absent', () => {
    const rgd: K8sObject = {
      spec: { schema: { kind: 'Foo', spec: {} } },
    }
    const doc = buildSchemaDoc(rgd)
    expect(doc.group).toBe('kro.run')
  })

  it('builds specFields from spec.schema.spec', () => {
    const rgd = makeRGD({
      name: 'string',
      replicas: 'integer | default=2',
    })
    const doc = buildSchemaDoc(rgd)

    expect(doc.specFields).toHaveLength(2)

    const nameField = doc.specFields.find((f) => f.name === 'name')
    expect(nameField).toBeDefined()
    expect(nameField?.raw).toBe('string')
    expect(nameField?.parsedType).toEqual({ type: 'string' })
    expect(nameField?.isStatus).toBeUndefined()

    const replicasField = doc.specFields.find((f) => f.name === 'replicas')
    expect(replicasField).toBeDefined()
    expect(replicasField?.parsedType).toEqual({ type: 'integer', default: '2' })
  })

  it('builds statusFields from spec.schema.status', () => {
    const rgd = makeRGD(
      { name: 'string' },
      { ready: '${deployment.status.availableReplicas == 2}' },
    )
    const doc = buildSchemaDoc(rgd)

    expect(doc.statusFields).toHaveLength(1)

    const readyField = doc.statusFields[0]
    expect(readyField.name).toBe('ready')
    expect(readyField.raw).toBe('${deployment.status.availableReplicas == 2}')
    expect(readyField.isStatus).toBe(true)
    expect(readyField.inferredType).toBe('boolean')
    expect(readyField.parsedType).toBeUndefined()
  })

  it('returns empty arrays when spec/status are absent', () => {
    const rgd: K8sObject = {
      spec: { schema: { kind: 'Empty' } },
    }
    const doc = buildSchemaDoc(rgd)

    expect(doc.specFields).toHaveLength(0)
    expect(doc.statusFields).toHaveLength(0)
  })

  it('handles completely missing spec.schema gracefully', () => {
    const rgd: K8sObject = { spec: {} }
    const doc = buildSchemaDoc(rgd)

    expect(doc.kind).toBe('')
    expect(doc.specFields).toHaveLength(0)
    expect(doc.statusFields).toHaveLength(0)
  })

  it('handles missing spec entirely', () => {
    const rgd: K8sObject = {}
    const doc = buildSchemaDoc(rgd)

    expect(doc.kind).toBe('')
    expect(doc.specFields).toHaveLength(0)
  })
})
