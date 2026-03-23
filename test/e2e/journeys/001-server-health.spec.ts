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
 * Journey 001: Server Health and API Connectivity
 *
 * Validates that the kro-ui server starts correctly, connects to the kind
 * cluster, and exposes all API endpoints the frontend depends on.
 *
 * Spec ref: .specify/specs/001-go-api-server/spec.md § E2E User Journey
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 001 — Server health and API connectivity', () => {

  test('Step 1: /healthz responds 200 within 200ms', async ({ request }) => {
    const start = Date.now()
    const res = await request.get(`${BASE}/api/v1/healthz`)
    const elapsed = Date.now() - start

    expect(res.status()).toBe(200)
    expect(await res.text()).toBe('ok')
    expect(elapsed).toBeLessThan(200)
  })

  test('Step 2: /api/v1/rgds returns the test-app fixture', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/rgds`)

    expect(res.status()).toBe(200)
    const body = await res.json() as { items: Array<{ metadata: { name: string } }> }
    expect(body.items).toBeDefined()
    expect(Array.isArray(body.items)).toBe(true)

    const testApp = body.items.find(i => i.metadata.name === 'test-app')
    expect(testApp).toBeDefined()
  })

  test('Step 3: /api/v1/rgds/test-app returns correct schema kind', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/rgds/test-app`)

    expect(res.status()).toBe(200)
    const body = await res.json() as { spec: { schema: { kind: string } } }
    expect(body.spec?.schema?.kind).toBe('WebApp')
  })

  test('Step 4: /api/v1/rgds/test-app/instances returns test-instance', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/rgds/test-app/instances`)

    expect(res.status()).toBe(200)
    const body = await res.json() as { items: Array<{ metadata: { name: string } }> }
    expect(Array.isArray(body.items)).toBe(true)

    const inst = body.items.find(i => i.metadata.name === 'test-instance')
    expect(inst).toBeDefined()
  })

  test('Step 5: /api/v1/rgds/does-not-exist returns 404 with error key', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/rgds/does-not-exist`)

    expect(res.status()).toBe(404)
    const body = await res.json() as { error: string }
    expect(typeof body.error).toBe('string')
    expect(body.error.length).toBeGreaterThan(0)
  })

  test('Step 6: /api/v1/kro/metrics returns a valid JSON metrics snapshot', async ({ request }) => {
    // The metrics endpoint scrapes kro's Prometheus endpoint. In the E2E
    // environment the kro metrics port is not port-forwarded, so the scrape
    // fails and kro-ui responds 503 with a structured JSON error — never HTML.
    const res = await request.get(`${BASE}/api/v1/kro/metrics`)

    // Either 200 (metrics reachable) or a structured error (503/502/504).
    expect([200, 502, 503, 504]).toContain(res.status())
    const body = await res.json() as Record<string, unknown>
    // On 200 the response must have scrapedAt; on error it must have error.
    if (res.status() === 200) {
      expect(body.scrapedAt).toBeDefined()
    } else {
      expect(typeof body.error).toBe('string')
      expect((body.error as string).length).toBeGreaterThan(0)
    }
  })

  test('Step 7: /api/v1/rgds response includes all fixture RGDs', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/rgds`)
    expect(res.status()).toBe(200)
    const body = await res.json() as { items: Array<{ metadata: { name: string } }> }
    const names = body.items.map(i => i.metadata.name)

    for (const expected of ['test-app', 'test-collection', 'multi-resource', 'external-ref', 'cel-functions']) {
      expect(names).toContain(expected)
    }
  })

  test('Step 8: /api/v1/rgds/multi-resource/instances returns multi-resource-instance', async ({ request }) => {
    test.skip(!fixtureState.multiReady, 'multi-resource RGD did not become Ready in setup')
    const res = await request.get(`${BASE}/api/v1/rgds/multi-resource/instances`)
    expect(res.status()).toBe(200)
    const body = await res.json() as { items: Array<{ metadata: { name: string } }> }
    const inst = body.items.find(i => i.metadata.name === 'multi-resource-instance')
    expect(inst).toBeDefined()
  })

  test('Step 9: instance detail endpoint returns spec and metadata fields', async ({ request }) => {
    // Route: /api/v1/instances/{namespace}/{name}  (RGD name is not in path)
    const res = await request.get(`${BASE}/api/v1/instances/kro-ui-e2e/test-instance`)
    expect(res.status()).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.spec).toBeDefined()
    expect(body.metadata).toBeDefined()
  })

  test('Step 10: instance events endpoint returns valid JSON with items key', async ({ request }) => {
    // Route: /api/v1/instances/{namespace}/{name}/events
    const res = await request.get(`${BASE}/api/v1/instances/kro-ui-e2e/test-instance/events`)
    expect(res.status()).toBe(200)
    const body = await res.json() as { items: unknown[] }
    expect(Array.isArray(body.items)).toBe(true)
  })

  test('Step 11: external-ref instance detail endpoint responds without error', async ({ request }) => {
    test.skip(!fixtureState.externalRefReady, 'external-ref RGD did not become Ready in setup')
    // Route: /api/v1/instances/{namespace}/{name}
    const res = await request.get(`${BASE}/api/v1/instances/kro-ui-e2e/external-ref-instance`)
    expect(res.status()).toBe(200)
    const body = await res.json() as { metadata: { name: string } }
    expect(body.metadata.name).toBe('external-ref-instance')
  })

})
