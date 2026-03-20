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

const PORT = parseInt(process.env.KRO_UI_PORT ?? '10174', 10)
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
    expect(body.spec?.schema?.kind).toBe('TestApp')
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

  test('Step 6: /api/v1/metrics returns 501 Not Implemented', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/metrics`)

    expect(res.status()).toBe(501)
    const body = await res.json() as { error: string }
    expect(body.error).toBeDefined()
  })

})
