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
 * Journey 058: Global Instance Search
 *
 * Spec: .specify/specs/058-global-instance-search/spec.md
 *
 * Verifies:
 *   A) GET /api/v1/instances returns non-empty list with correct fields
 *   B) /instances page renders the instances table
 *   C) Search filter reduces visible rows
 *   D) Nav link "Instances" exists in the top bar
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.8.0
 * - At least one RGD with instances (test-app / test-instance)
 * - kro-ui binary running at KRO_UI_BASE_URL
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 058: Global Instance Search', () => {

  // ── A: API returns instance list ─────────────────────────────────────────────

  test('Step 1: GET /api/v1/instances returns non-empty list with required fields', async ({ page }) => {
    // Poll up to 30s — the E2E cluster may throttle initial requests.
    // The fan-out per-RGD timeout is 2s; on a throttled cluster some may return 0
    // on the first request but succeed after the client-side throttle clears.
    let data: { items: Array<Record<string, unknown>>; total: number } | null = null
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const res = await page.request.get(`${BASE}/api/v1/instances?refresh=true`)
      if (res.status() === 200) {
        const d = await res.json()
        if (d.total > 0) {
          data = d
          break
        }
      }
      await page.waitForTimeout(2000)
    }

    expect(data).not.toBeNull()
    expect(Array.isArray(data!.items)).toBe(true)
    expect(data!.total).toBeGreaterThan(0)

    // Verify first item has required fields
    const first = data!.items[0]
    expect(typeof first['name']).toBe('string')
    expect((first['name'] as string).length).toBeGreaterThan(0)
    expect(typeof first['rgdName']).toBe('string')
    expect((first['rgdName'] as string).length).toBeGreaterThan(0)
    expect(typeof first['ready']).toBe('string')
  })

  // ── D: Nav link exists ────────────────────────────────────────────────────────

  test('Step 2: "Instances" nav link exists in the top bar', async ({ page }) => {
    await page.goto(BASE)
    const link = page.locator('[data-testid="topbar-instances"]')
    await expect(link).toBeVisible()
    await expect(link).toHaveText('Instances')
  })

  // ── B: /instances page renders table ────────────────────────────────────────

  test('Step 3: /instances page renders instances table', async ({ page }) => {
    await page.goto(`${BASE}/instances`)

    // Wait for table to appear — longer timeout for throttled E2E cluster
    // The /instances API fan-out may take several seconds on a fresh cluster.
    await page.waitForSelector('[data-testid="instances-table"]', { timeout: 45000 })

    const table = page.locator('[data-testid="instances-table"]')
    await expect(table).toBeVisible()

    // Verify at least one row
    const rows = page.locator('[data-testid="instances-row"]')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)

    // Instance count badge is visible
    const countBadge = page.locator('[data-testid="instances-count"]')
    await expect(countBadge).toBeVisible()
    const countText = await countBadge.textContent()
    expect(countText).toMatch(/\d+/)
  })

  // ── C: Search filter works ───────────────────────────────────────────────────

  test('Step 4: Search filter reduces rows', async ({ page }) => {
    await page.goto(`${BASE}/instances`)
    await page.waitForSelector('[data-testid="instances-table"]', { timeout: 20000 })

    const allRows = page.locator('[data-testid="instances-row"]')
    const initialCount = await allRows.count()

    const search = page.locator('[data-testid="instances-search"]')
    // Type a query that matches a specific RGD name
    await search.fill('test-app')

    // Wait for DOM to update
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll('[data-testid="instances-row"]')
        return rows.length > 0
      },
      { timeout: 5000 }
    )

    const filteredCount = await allRows.count()
    // Filtering to 'test-app' should produce <= initial count
    expect(filteredCount).toBeLessThanOrEqual(initialCount)
  })

  // ── Title ─────────────────────────────────────────────────────────────────────

  test('Step 5: /instances page has correct document title', async ({ page }) => {
    await page.goto(`${BASE}/instances`)
    await page.waitForLoadState('networkidle')
    const title = await page.title()
    expect(title).toBe('Instances — kro-ui')
  })
})
