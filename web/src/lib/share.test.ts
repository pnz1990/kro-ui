// share.test.ts — Unit tests for Designer collaboration URL encoding/decoding.
//
// Design ref: docs/design/31-rgd-designer.md §Future → ✅

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  encodeDesignerShare,
  decodeDesignerShare,
  buildShareUrl,
  extractShareFromUrl,
  SHARE_PARAM,
} from './share'
import type { RGDAuthoringState } from '@/lib/generator'

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeState(overrides: Partial<RGDAuthoringState> = {}): RGDAuthoringState {
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

// ── encodeDesignerShare ────────────────────────────────────────────────────

describe('encodeDesignerShare', () => {
  it('returns a non-empty string for a valid state', () => {
    const token = encodeDesignerShare(makeState())
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
  })

  it('produces a different token for different states', () => {
    const t1 = encodeDesignerShare(makeState({ rgdName: 'app-a' }))
    const t2 = encodeDesignerShare(makeState({ rgdName: 'app-b' }))
    expect(t1).not.toBe(t2)
  })

  it('does not contain + / or = (base64url safe)', () => {
    const token = encodeDesignerShare(makeState())!
    expect(token).not.toMatch(/[+/=]/)
  })
})

// ── decodeDesignerShare ────────────────────────────────────────────────────

describe('decodeDesignerShare', () => {
  it('round-trips a simple state', () => {
    const state = makeState({ rgdName: 'roundtrip' })
    const token = encodeDesignerShare(state)!
    const decoded = decodeDesignerShare(token)
    expect(decoded).toEqual(state)
  })

  it('round-trips state with resources and specFields', () => {
    const state = makeState({
      rgdName: 'complex-app',
      kind: 'ComplexApp',
      specFields: [
        {
          id: 'f1',
          name: 'replicas',
          type: 'integer',
          defaultValue: '1',
          required: false,
        },
      ],
      resources: [
        {
          _key: 'res-1',
          id: 'deployment',
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          resourceType: 'managed',
          templateYaml: 'spec: {}',
          includeWhen: '',
          readyWhen: [],
          forEachIterators: [{ _key: 'fe-1', variable: '', expression: '' }],
          externalRef: {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            namespace: '',
            name: '',
            selectorLabels: [],
          },
        },
      ],
    })
    const token = encodeDesignerShare(state)!
    const decoded = decodeDesignerShare(token)
    expect(decoded).toEqual(state)
  })

  it('returns null for an empty string', () => {
    expect(decodeDesignerShare('')).toBeNull()
  })

  it('returns null for a garbage token', () => {
    expect(decodeDesignerShare('not-valid-base64!!!')).toBeNull()
  })

  it('returns null for a token that decodes to non-RGDAuthoringState JSON', () => {
    // Encode {"foo":"bar"} as base64url — missing required fields
    const invalidJson = JSON.stringify({ foo: 'bar' })
    const bytes = new TextEncoder().encode(invalidJson)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const b64url = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    expect(decodeDesignerShare(b64url)).toBeNull()
  })

  it('handles unicode content in templateYaml', () => {
    const state = makeState({
      resources: [
        {
          _key: 'r1',
          id: 'svc',
          apiVersion: 'v1',
          kind: 'Service',
          resourceType: 'managed',
          templateYaml: 'metadata:\n  annotations:\n    note: "こんにちは"',
          includeWhen: '',
          readyWhen: [],
          forEachIterators: [{ _key: 'fe-1', variable: '', expression: '' }],
          externalRef: {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            namespace: '',
            name: '',
            selectorLabels: [],
          },
        },
      ],
    })
    const token = encodeDesignerShare(state)!
    const decoded = decodeDesignerShare(token)
    expect(decoded?.resources[0]?.templateYaml).toContain('こんにちは')
  })
})

// ── buildShareUrl ──────────────────────────────────────────────────────────

describe('buildShareUrl', () => {
  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:40107/author',
        search: '',
        hash: '',
        origin: 'http://localhost:40107',
        pathname: '/author',
        protocol: 'http:',
        host: 'localhost:40107',
      },
      writable: true,
    })
  })

  it('returns a URL string', () => {
    const url = buildShareUrl(makeState())
    expect(typeof url).toBe('string')
    expect(url).toContain(SHARE_PARAM + '=')
  })

  it('embeds the share token as a query param', () => {
    const state = makeState({ rgdName: 'shared-app' })
    const url = buildShareUrl(state)!
    const params = new URL(url).searchParams
    expect(params.get(SHARE_PARAM)).toBeTruthy()
  })

  it('the embedded token round-trips back to the original state', () => {
    const state = makeState({ rgdName: 'round-trip-url' })
    const url = buildShareUrl(state)!
    const token = new URL(url).searchParams.get(SHARE_PARAM)!
    const decoded = decodeDesignerShare(token)
    expect(decoded).toEqual(state)
  })
})

// ── extractShareFromUrl ────────────────────────────────────────────────────

describe('extractShareFromUrl', () => {
  afterEach(() => {
    // Reset location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:40107/author',
        search: '',
      },
      writable: true,
    })
  })

  it('returns null when no share param is present', () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost:40107/author', search: '' },
      writable: true,
    })
    expect(extractShareFromUrl()).toBeNull()
  })

  it('returns decoded state when share param is present', () => {
    const state = makeState({ rgdName: 'extracted-app' })
    const token = encodeDesignerShare(state)!
    Object.defineProperty(window, 'location', {
      value: {
        href: `http://localhost:40107/author?${SHARE_PARAM}=${token}`,
        search: `?${SHARE_PARAM}=${token}`,
      },
      writable: true,
    })
    const extracted = extractShareFromUrl()
    expect(extracted).toEqual(state)
  })

  it('returns null for a malformed share param', () => {
    Object.defineProperty(window, 'location', {
      value: {
        href: `http://localhost:40107/author?${SHARE_PARAM}=GARBAGE!!!`,
        search: `?${SHARE_PARAM}=GARBAGE!!!`,
      },
      writable: true,
    })
    expect(extractShareFromUrl()).toBeNull()
  })
})
