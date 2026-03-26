// api.test.ts — unit tests for the typed API client.
//
// Issue #250: guard against non-string body.error values that would produce
// "[object Object]" when passed to new Error().

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We test the internal `get` function indirectly via exported helpers.
// We can exercise the error path by calling any exported function with a
// mock fetch that returns a non-OK response.
import { listRGDs, listContexts } from './api'

function makeFetchMock(status: number, body: unknown): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

function makeFetchMockJsonFail(status: number): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.reject(new Error('invalid json')),
  } as unknown as Response)
}

const originalFetch = globalThis.fetch

beforeEach(() => {
  // no-op: individual tests set globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('api.ts get() error handling (issue #250)', () => {
  it('uses body.error string as the error message', async () => {
    globalThis.fetch = makeFetchMock(400, { error: 'RGD not found' })
    await expect(listRGDs()).rejects.toThrow('RGD not found')
  })

  it('falls back to HTTP <status> when body.error is an object', async () => {
    globalThis.fetch = makeFetchMock(500, { error: { code: 500, message: 'internal' } })
    await expect(listRGDs()).rejects.toThrow('HTTP 500')
  })

  it('falls back to HTTP <status> when body.error is a number', async () => {
    globalThis.fetch = makeFetchMock(422, { error: 422 })
    await expect(listRGDs()).rejects.toThrow('HTTP 422')
  })

  it('falls back to HTTP <status> when body.error is false', async () => {
    globalThis.fetch = makeFetchMock(503, { error: false })
    await expect(listRGDs()).rejects.toThrow('HTTP 503')
  })

  it('falls back to HTTP <status> when body.error is null', async () => {
    globalThis.fetch = makeFetchMock(404, { error: null })
    await expect(listRGDs()).rejects.toThrow('HTTP 404')
  })

  it('falls back to HTTP <status> when body has no error field', async () => {
    globalThis.fetch = makeFetchMock(503, {})
    await expect(listRGDs()).rejects.toThrow('HTTP 503')
  })

  it('falls back to HTTP <status> when response body is not JSON', async () => {
    globalThis.fetch = makeFetchMockJsonFail(502)
    await expect(listContexts()).rejects.toThrow('HTTP 502')
  })

  it('does not throw when response is ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], metadata: {} }),
    } as unknown as Response)
    await expect(listRGDs()).resolves.toEqual({ items: [], metadata: {} })
  })
})
