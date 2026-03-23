// ExampleYAML.test.tsx — unit tests for the generateExampleYAML pure function.
//
// Covers the table of cases from issue #111, including the falsy-default
// regression guard (issue #106 / AGENTS.md anti-pattern #61).

import { describe, it, expect } from 'vitest'
import { generateExampleYAML } from './ExampleYAML'
import type { SchemaDoc } from '@/lib/schema'

function makeSchema(fields: SchemaDoc['specFields']): SchemaDoc {
  return {
    kind: 'WebApp',
    apiVersion: 'v1alpha1',
    group: 'kro.run',
    specFields: fields,
    statusFields: [],
  }
}

describe('generateExampleYAML', () => {
  // ── Header generation ────────────────────────────────────────────────

  it('generates correct apiVersion / kind / metadata header', () => {
    const yaml = generateExampleYAML(makeSchema([]))
    expect(yaml).toContain('apiVersion: kro.run/v1alpha1')
    expect(yaml).toContain('kind: WebApp')
    expect(yaml).toContain('metadata:')
    expect(yaml).toContain('  name: my-web-app')
  })

  it('does not emit spec: block when there are no spec fields', () => {
    const yaml = generateExampleYAML(makeSchema([]))
    expect(yaml).not.toContain('spec:')
  })

  // ── Required fields ──────────────────────────────────────────────────

  it('renders required string field as active line with placeholder', () => {
    const yaml = generateExampleYAML(makeSchema([
      { name: 'name', raw: '', parsedType: { type: 'string' } },
    ]))
    expect(yaml).toContain('  name: ""')
    expect(yaml).toContain('# required - string')
  })

  it('renders required integer field as active line with 0 placeholder', () => {
    const yaml = generateExampleYAML(makeSchema([
      { name: 'replicas', raw: '', parsedType: { type: 'integer' } },
    ]))
    expect(yaml).toContain('  replicas: 0')
    expect(yaml).toContain('# required - integer')
  })

  it('renders required boolean field as active line with false placeholder', () => {
    const yaml = generateExampleYAML(makeSchema([
      { name: 'enabled', raw: '', parsedType: { type: 'boolean' } },
    ]))
    expect(yaml).toContain('  enabled: false')
    expect(yaml).toContain('# required - boolean')
  })

  it('renders required array field with [] placeholder', () => {
    const yaml = generateExampleYAML(makeSchema([
      { name: 'items', raw: '', parsedType: { type: 'array', items: 'string' } },
    ]))
    expect(yaml).toContain('  items: []')
    expect(yaml).toContain('# required - []string')
  })

  // ── Optional fields (truthy defaults) ────────────────────────────────

  it('renders optional field with truthy default as commented line', () => {
    const yaml = generateExampleYAML(makeSchema([
      { name: 'replicas', raw: '', parsedType: { type: 'integer', default: '3' } },
    ]))
    expect(yaml).toContain('  # replicas: 3')
    expect(yaml).toContain('# optional - integer (default: 3)')
    // Must NOT appear as a required active line
    expect(yaml).not.toContain('  replicas: 0')
  })

  // ── Falsy defaults — regression guard for issue #106 / anti-pattern #61 ──

  it('renders field with default=0 as optional, not required', () => {
    const yaml = generateExampleYAML(makeSchema([
      { name: 'replicas', raw: '', parsedType: { type: 'integer', default: '0' } },
    ]))
    // Must be a comment line (optional), not an active line (required)
    expect(yaml).toContain('  # replicas: 0')
    expect(yaml).toContain('# optional - integer (default: 0)')
    expect(yaml).not.toContain('  replicas: 0     # required')
  })

  it('renders field with default=false as optional, not required', () => {
    const yaml = generateExampleYAML(makeSchema([
      { name: 'enabled', raw: '', parsedType: { type: 'boolean', default: 'false' } },
    ]))
    expect(yaml).toContain('  # enabled: false')
    expect(yaml).toContain('# optional - boolean (default: false)')
    expect(yaml).not.toContain('  enabled: false     # required')
  })

  it('renders field with default="" as optional with quoted empty string', () => {
    const yaml = generateExampleYAML(makeSchema([
      { name: 'label', raw: '', parsedType: { type: 'string', default: '' } },
    ]))
    expect(yaml).toContain('  # label: ""')
    expect(yaml).toContain('# optional - string (default: "")')
    expect(yaml).not.toContain('  label: ""     # required')
  })

  // ── Multiple fields mixed ────────────────────────────────────────────

  it('handles mix of required and optional fields', () => {
    const yaml = generateExampleYAML(makeSchema([
      { name: 'name', raw: '', parsedType: { type: 'string' } },
      { name: 'replicas', raw: '', parsedType: { type: 'integer', default: '1' } },
      { name: 'debug', raw: '', parsedType: { type: 'boolean', default: 'false' } },
    ]))
    // required
    expect(yaml).toContain('  name: ""')
    // optional with truthy default
    expect(yaml).toContain('  # replicas: 1')
    // optional with falsy default (regression for #106)
    expect(yaml).toContain('  # debug: false')
  })
})
