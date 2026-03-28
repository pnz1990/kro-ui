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

/**
 * Journey 057: Cache Flush on Context Switch
 *
 * Spec: .specify/specs/057-cache-context-invalidation/spec.md
 *
 * Verifies:
 *   A) GET /api/v1/kro/capabilities returns X-Cache: MISS on first request
 *   B) GET /api/v1/kro/capabilities returns X-Cache: HIT on second request (cached)
 *   C) After context switch (POST /api/v1/contexts/switch), next capabilities
 *      request returns X-Cache: MISS (cache was flushed by context switch)
 *
 * Note: Step C runs a context switch to the SAME context (same cluster).
 * The cache should still flush — the flush logic doesn't inspect whether the
 * target context is different from the current one. This is the correct
 * behavior: any switch event flushes.
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.8.0
 * - kro-ui binary running at KRO_UI_BASE_URL
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 057: Cache flush on context switch', () => {

  // ── A: First request is a cache MISS ────────────────────────────────────────

  test('Step 1: First GET /kro/capabilities returns X-Cache: MISS', async ({ page }) => {
    // Force a miss by using ?refresh=true (bypasses cache and populates it)
    const res = await page.request.get(`${BASE}/api/v1/kro/capabilities?refresh=true`)
    expect(res.status()).toBe(200)
    // ?refresh=true always bypasses cache — X-Cache should be MISS
    expect(res.headers()['x-cache']).toBe('MISS')
  })

  // ── B: Second request hits the cache ────────────────────────────────────────

  test('Step 2: Second GET /kro/capabilities returns X-Cache: HIT (cached)', async ({ page }) => {
    // First, ensure the cache is populated
    await page.request.get(`${BASE}/api/v1/kro/capabilities`)
    // Second request should be a cache hit
    const res = await page.request.get(`${BASE}/api/v1/kro/capabilities`)
    expect(res.status()).toBe(200)
    expect(res.headers()['x-cache']).toBe('HIT')
  })

  // ── C: Context switch flushes the cache ─────────────────────────────────────

  test('Step 3: After context switch, GET /kro/capabilities returns X-Cache: MISS', async ({ page }) => {
    // First populate the cache
    await page.request.get(`${BASE}/api/v1/kro/capabilities`)
    const hitRes = await page.request.get(`${BASE}/api/v1/kro/capabilities`)
    expect(hitRes.headers()['x-cache']).toBe('HIT')

    // Get current context name to switch to the same context
    const ctxRes = await page.request.get(`${BASE}/api/v1/contexts`)
    expect(ctxRes.status()).toBe(200)
    const ctxData = await ctxRes.json()
    const activeCtx = ctxData.active as string
    expect(typeof activeCtx).toBe('string')
    expect(activeCtx.length).toBeGreaterThan(0)

    // Perform context switch (to the same context — still flushes the cache)
    const switchRes = await page.request.post(`${BASE}/api/v1/contexts/switch`, {
      data: { context: activeCtx },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(switchRes.status()).toBe(200)

    // Cache should now be flushed — next request is a MISS
    const missRes = await page.request.get(`${BASE}/api/v1/kro/capabilities`)
    expect(missRes.status()).toBe(200)
    expect(missRes.headers()['x-cache']).toBe('MISS')
  })
})
