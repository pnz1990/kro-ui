// Copyright 2026 The Kubernetes Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { describe, it, expect } from 'vitest'
import { translateApiError } from './errors'

describe('translateApiError', () => {
  // ── Pattern 1: resource not found ───────────────────────────────────────
  describe('pattern 1 — server could not find the requested resource', () => {
    it('translates exact phrase', () => {
      const result = translateApiError('the server could not find the requested resource')
      expect(result).toContain('CRD may not be provisioned')
      expect(result).not.toContain('the server could not find')
    })

    it('translates phrase embedded in a longer string', () => {
      const result = translateApiError(
        'Get "https://127.0.0.1:6443/apis/kro.run/v1alpha1/widgets": the server could not find the requested resource'
      )
      expect(result).toContain('CRD may not be provisioned')
    })

    it('strengthens message when rgdReady is false', () => {
      const result = translateApiError(
        'the server could not find the requested resource',
        { rgdReady: false }
      )
      expect(result).toContain("RGD's CRD has not been provisioned yet")
      expect(result).toContain("Validation tab")
    })

    it('uses generic wording when rgdReady is undefined', () => {
      const result = translateApiError('the server could not find the requested resource')
      expect(result).toContain("API server doesn't recognise")
    })

    it('uses generic wording when rgdReady is true', () => {
      const result = translateApiError(
        'the server could not find the requested resource',
        { rgdReady: true }
      )
      expect(result).toContain("API server doesn't recognise")
    })
  })

  // ── Pattern 2: no kind registered ───────────────────────────────────────
  describe('pattern 2 — no kind registered', () => {
    it('extracts kind name from error string', () => {
      const result = translateApiError('no kind "Widget" is registered')
      expect(result).toContain("'Widget'")
      expect(result).not.toContain('"Widget"')
    })

    it('is case-insensitive', () => {
      const result = translateApiError('No Kind "Widget" Is Registered')
      expect(result).toContain("'Widget'")
    })

    it('strengthens message when rgdReady is false', () => {
      const result = translateApiError('no kind "Widget" is registered', { rgdReady: false })
      expect(result).toContain("CRD hasn't been created yet")
      expect(result).toContain("Validation tab")
    })

    it('handles error string without extractable kind', () => {
      // If the regex fails to extract, message still translates (no crash)
      const result = translateApiError('no kind is registered')
      // pattern 2 regex won't match (no quotes) — falls through to no-match passthrough
      expect(result).toBe('no kind is registered')
    })
  })

  // ── Pattern 3: HTTP 403 / forbidden ─────────────────────────────────────
  describe('pattern 3 — 403 / forbidden', () => {
    it('matches "HTTP 403" prefix', () => {
      const result = translateApiError('HTTP 403')
      expect(result).toContain('Permission denied')
      expect(result).toContain('Access tab')
    })

    it('matches lowercase "forbidden"', () => {
      const result = translateApiError('forbidden: User "system:serviceaccount:kro/kro" cannot list')
      expect(result).toContain('Permission denied')
    })

    it('matches mixed-case "Forbidden"', () => {
      const result = translateApiError('403 Forbidden')
      expect(result).toContain('Permission denied')
    })
  })

  // ── Pattern 4: HTTP 401 / Unauthorized ──────────────────────────────────
  describe('pattern 4 — 401 / Unauthorized', () => {
    it('matches "HTTP 401"', () => {
      const result = translateApiError('HTTP 401')
      expect(result).toContain('Not authenticated')
      expect(result).toContain('credentials')
    })

    it('matches "Unauthorized"', () => {
      const result = translateApiError('Unauthorized')
      expect(result).toContain('Not authenticated')
    })

    it('matches lowercase "unauthorized"', () => {
      const result = translateApiError('unauthorized: token has expired')
      expect(result).toContain('Not authenticated')
    })
  })

  // ── Pattern 5: connection refused / dial tcp / 503 ───────────────────────
  describe('pattern 5 — API server unreachable', () => {
    it('matches "connection refused"', () => {
      const result = translateApiError('dial tcp 127.0.0.1:6443: connect: connection refused')
      expect(result).toContain('Cannot reach the Kubernetes API server')
    })

    it('matches "dial tcp" prefix', () => {
      const result = translateApiError('dial tcp: lookup kubernetes.default: no such host')
      expect(result).toContain('Cannot reach the Kubernetes API server')
    })

    it('matches HTTP 503', () => {
      const result = translateApiError('HTTP 503')
      expect(result).toContain('Cannot reach the Kubernetes API server')
    })
  })

  // ── Pattern 6: context deadline exceeded ─────────────────────────────────
  describe('pattern 6 — timeout', () => {
    it('matches "context deadline exceeded"', () => {
      const result = translateApiError('context deadline exceeded')
      expect(result).toContain('timed out')
    })

    it('matches phrase embedded in longer string', () => {
      const result = translateApiError(
        'Get "https://127.0.0.1:6443/api/v1/namespaces": context deadline exceeded (Client.Timeout exceeded)'
      )
      expect(result).toContain('timed out')
    })
  })

  // ── Pattern 7: TLS / x509 ────────────────────────────────────────────────
  describe('pattern 7 — TLS certificate error', () => {
    it('matches "x509: certificate"', () => {
      const result = translateApiError('x509: certificate signed by unknown authority')
      expect(result).toContain('TLS certificate error')
    })

    it('matches "x509" anywhere in string', () => {
      const result = translateApiError('tls: failed to verify certificate: x509: expired cert')
      expect(result).toContain('TLS certificate error')
    })
  })

  // ── No-match passthrough ──────────────────────────────────────────────────
  describe('no-match passthrough', () => {
    it('returns original message when no pattern matches', () => {
      const msg = 'resource quota exceeded'
      expect(translateApiError(msg)).toBe(msg)
    })

    it('returns original for an unknown HTTP status', () => {
      const msg = 'HTTP 409 Conflict'
      expect(translateApiError(msg)).toBe(msg)
    })
  })

  // ── Edge cases ────────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('returns empty string unchanged', () => {
      expect(translateApiError('')).toBe('')
    })

    it('returns whitespace-only string unchanged', () => {
      expect(translateApiError('   ')).toBe('   ')
    })

    it('handles context object with only tab hint (no rgdReady)', () => {
      const result = translateApiError(
        'the server could not find the requested resource',
        { tab: 'validation' }
      )
      // rgdReady is undefined → generic wording
      expect(result).toContain("API server doesn't recognise")
    })
  })
})
