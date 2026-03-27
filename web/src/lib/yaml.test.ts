import { describe, it, expect } from 'vitest'
import { toYaml, cleanK8sObject } from './yaml'

describe('toYaml', () => {
  it('renders null', () => {
    expect(toYaml(null)).toBe('null')
    expect(toYaml(undefined)).toBe('null')
  })

  it('renders booleans', () => {
    expect(toYaml(true)).toBe('true')
    expect(toYaml(false)).toBe('false')
  })

  it('renders numbers', () => {
    expect(toYaml(42)).toBe('42')
    expect(toYaml(3.14)).toBe('3.14')
  })

  it('renders plain strings unquoted', () => {
    expect(toYaml('hello')).toBe('hello')
    expect(toYaml('foo-bar')).toBe('foo-bar')
  })

  it('quotes strings that look like other types', () => {
    expect(toYaml('true')).toBe('"true"')
    expect(toYaml('false')).toBe('"false"')
    expect(toYaml('null')).toBe('"null"')
    expect(toYaml('42')).toBe('"42"')
  })

  it('quotes strings containing special YAML chars', () => {
    expect(toYaml('key: value')).toBe('"key: value"')
    expect(toYaml('# comment')).toBe('"# comment"')
  })

  it('renders empty string as ""', () => {
    expect(toYaml('')).toBe('""')
  })

  it('renders flat object', () => {
    const result = toYaml({ apiVersion: 'v1', kind: 'ConfigMap' })
    expect(result).toContain('apiVersion: v1')
    expect(result).toContain('kind: ConfigMap')
  })

  it('renders empty object as {}', () => {
    expect(toYaml({})).toBe('{}')
  })

  it('renders empty array as []', () => {
    expect(toYaml([])).toBe('[]')
  })

  it('renders array of scalars', () => {
    const result = toYaml(['a', 'b', 'c'])
    expect(result).toContain('- a')
    expect(result).toContain('- b')
    expect(result).toContain('- c')
  })

  it('renders nested object with indentation', () => {
    const result = toYaml({ metadata: { name: 'my-cm', namespace: 'default' } })
    expect(result).toContain('metadata:')
    expect(result).toContain('  name: my-cm')
    expect(result).toContain('  namespace: default')
  })

  it('renders array of objects (k8s containers-style)', () => {
    const result = toYaml([{ name: 'web', image: 'nginx' }])
    expect(result).toContain('- name: web')
    expect(result).toContain('  image: nginx')
  })

  it('round-trips a realistic k8s-like object', () => {
    const obj = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name: 'my-config', namespace: 'default' },
      data: { key: 'value' },
    }
    const yaml = toYaml(obj)
    expect(yaml).toContain('apiVersion: v1')
    expect(yaml).toContain('kind: ConfigMap')
    expect(yaml).toContain('metadata:')
    expect(yaml).toContain('  name: my-config')
    expect(yaml).toContain('data:')
    expect(yaml).toContain('  key: value')
  })
})

// ── cleanK8sObject ────────────────────────────────────────────────────────

describe('cleanK8sObject', () => {
  const noisy = {
    apiVersion: 'kro.run/v1alpha1',
    kind: 'ResourceGraphDefinition',
    metadata: {
      name: 'test-app',
      namespace: 'default',
      uid: 'abc-123-def',
      resourceVersion: '12345',
      generation: 3,
      creationTimestamp: '2026-03-24T00:00:00Z',
      finalizers: ['kro.run/finalizer'],
      labels: { 'app': 'test' },
      annotations: {
        'kubectl.kubernetes.io/last-applied-configuration': '{"apiVersion":"kro.run/v1alpha1","huge":"blob"}',
        'custom.io/annotation': 'keep-me',
      },
      managedFields: [{ manager: 'kro', operation: 'Update', time: '2026-03-24T00:00:00Z' }],
    },
    spec: { schema: { kind: 'TestApp' } },
    status: { state: 'Active' },
  }

  it('removes managedFields', () => {
    const clean = cleanK8sObject(noisy) as Record<string, unknown>
    const meta = clean.metadata as Record<string, unknown>
    expect(meta.managedFields).toBeUndefined()
  })

  it('removes resourceVersion, uid, generation, creationTimestamp', () => {
    const clean = cleanK8sObject(noisy) as Record<string, unknown>
    const meta = clean.metadata as Record<string, unknown>
    expect(meta.resourceVersion).toBeUndefined()
    expect(meta.uid).toBeUndefined()
    expect(meta.generation).toBeUndefined()
    expect(meta.creationTimestamp).toBeUndefined()
  })

  it('removes last-applied-configuration annotation', () => {
    const clean = cleanK8sObject(noisy) as Record<string, unknown>
    const meta = clean.metadata as Record<string, unknown>
    const annotations = meta.annotations as Record<string, unknown>
    expect(annotations['kubectl.kubernetes.io/last-applied-configuration']).toBeUndefined()
  })

  it('preserves other annotations', () => {
    const clean = cleanK8sObject(noisy) as Record<string, unknown>
    const meta = clean.metadata as Record<string, unknown>
    const annotations = meta.annotations as Record<string, unknown>
    expect(annotations['custom.io/annotation']).toBe('keep-me')
  })

  it('preserves name, namespace, labels, finalizers', () => {
    const clean = cleanK8sObject(noisy) as Record<string, unknown>
    const meta = clean.metadata as Record<string, unknown>
    expect(meta.name).toBe('test-app')
    expect(meta.namespace).toBe('default')
    expect(meta.labels).toEqual({ 'app': 'test' })
    expect(meta.finalizers).toEqual(['kro.run/finalizer'])
  })

  it('preserves spec and status unchanged', () => {
    const clean = cleanK8sObject(noisy) as Record<string, unknown>
    expect(clean.spec).toEqual({ schema: { kind: 'TestApp' } })
    expect(clean.status).toEqual({ state: 'Active' })
  })

  it('does not mutate the input object', () => {
    const original = JSON.parse(JSON.stringify(noisy))
    cleanK8sObject(noisy)
    expect(noisy).toEqual(original)
  })

  it('handles objects with no annotations (annotations key absent)', () => {
    const obj = { metadata: { name: 'foo', managedFields: [] }, spec: {} }
    const clean = cleanK8sObject(obj) as Record<string, unknown>
    const meta = clean.metadata as Record<string, unknown>
    expect(meta.managedFields).toBeUndefined()
    expect(meta.name).toBe('foo')
    expect(meta.annotations).toBeUndefined()
  })

  it('handles non-object input gracefully', () => {
    expect(cleanK8sObject(null)).toBeNull()
    expect(cleanK8sObject('string')).toBe('string')
    expect(cleanK8sObject(42)).toBe(42)
  })

  it('drops annotations key entirely when only last-applied remains', () => {
    const obj = {
      metadata: {
        name: 'x',
        annotations: { 'kubectl.kubernetes.io/last-applied-configuration': '{}' },
      },
    }
    const clean = cleanK8sObject(obj) as Record<string, unknown>
    const meta = clean.metadata as Record<string, unknown>
    // annotations should be absent (not empty {})
    expect(meta.annotations).toBeUndefined()
  })
})
