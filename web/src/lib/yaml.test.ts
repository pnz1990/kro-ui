import { describe, it, expect } from 'vitest'
import { toYaml } from './yaml'

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
