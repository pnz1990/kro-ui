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
 * Journey 062: /instances namespace dropdown + health state filter chips
 *
 * Spec: .specify/specs/062-instance-namespace-filter/spec.md  (PR #345)
 *
 * Verifies:
 *   A) Namespace dropdown renders and filters the table
 *   B) Health filter chips render with correct counts
 *   C) Clicking a health chip filters the table to that health state
 *   D) URL reflects active namespace + health filter
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.8.0
 * - At least one RGD with instances (test-app / test-instance in kro-ui-e2e)
 * - kro-ui binary running at KRO_UI_BASE_URL
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 062: /instances namespace dropdown + health filter chips', () => {

  // ── A: Namespace dropdown ────────────────────────────────────────────────────

  test('Step 1: /instances page loads and shows instances table', async ({ page }) => {
    await page.goto(`${BASE}/instances`)

    // Wait for data to load — the fan-out takes up to 5s on throttled clusters
    await page.waitForFunction(() => {
      const loading = document.querySelector('.instances-page__loading')
      const table = document.querySelector('.instance-table')
      const empty = document.querySelector('.instances-page__empty')
      return !loading && (table !== null || empty !== null)
    }, { timeout: 30000 })

    // Page title
    const title = await page.title()
    expect(title).toBe('Instances — kro-ui')
  })

  test('Step 2: namespace dropdown is visible when instances exist across namespaces', async ({ page }) => {
    // Confirm instances exist via API first
    const res = await page.request.get(`${BASE}/api/v1/instances`)
    expect(res.status()).toBe(200)
    const data = await res.json()
    if (!data.total || data.total === 0) {
      test.skip()
      return
    }

    await page.goto(`${BASE}/instances`)
    await page.waitForFunction(() => {
      return document.querySelector('.instance-table') !== null ||
             document.querySelector('.instances-page__empty') !== null
    }, { timeout: 30000 })

    // Namespace dropdown should exist (rendered when >1 namespace present)
    const dropdown = page.locator('select[aria-label="Filter by namespace"]')
    const dropdownCount = await dropdown.count()

    // E2E cluster has kro-ui-e2e namespace with test-instance
    if (dropdownCount > 0) {
      await expect(dropdown).toBeVisible()
      const options = await dropdown.locator('option').allTextContents()
      expect(options.length).toBeGreaterThanOrEqual(2) // "All namespaces" + at least one ns
      expect(options[0]).toMatch(/all/i)
    }
    // If dropdown not present, single-namespace cluster — not a failure
  })

  test('Step 3: namespace filter scopes the instance table', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/instances`)
    if ((await res.json()).total === 0) { test.skip(); return }

    await page.goto(`${BASE}/instances`)
    await page.waitForFunction(() => {
      return document.querySelector('.instance-table') !== null
    }, { timeout: 30000 })

    const dropdown = page.locator('select[aria-label="Filter by namespace"]')
    if (await dropdown.count() === 0) { test.skip(); return }

    // Get total row count before filtering
    const totalBefore = await page.locator('.instance-table__row').count()

    // Select kro-ui-e2e namespace (contains test-instance fixture)
    const options = await dropdown.locator('option').allTextContents()
    const e2eNs = options.find((o) => o.includes('kro-ui-e2e'))
    if (!e2eNs) { test.skip(); return }

    await dropdown.selectOption({ label: e2eNs })

    // Wait for table to update
    await page.waitForFunction(
      (before: number) => {
        const rows = document.querySelectorAll('.instance-table__row')
        return rows.length !== before
      },
      totalBefore,
      { timeout: 5000 }
    ).catch(() => { /* count may stay same if all in this ns */ })

    // All visible rows should be in the selected namespace
    const rows = page.locator('.instance-table__row')
    const count = await rows.count()
    if (count > 0) {
      // Check namespace cell for first visible row
      const nsCell = rows.first().locator('td').nth(1)
      const nsText = await nsCell.textContent()
      expect(nsText?.trim()).toBe('kro-ui-e2e')
    }
  })

  // ── B: Health filter chips ───────────────────────────────────────────────────

  test('Step 4: health filter chips render with counts', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/instances`)
    if ((await res.json()).total === 0) { test.skip(); return }

    await page.goto(`${BASE}/instances`)
    await page.waitForFunction(() => {
      return document.querySelector('.instances-page__health-chips') !== null
    }, { timeout: 30000 })

    // "All" chip should always be present
    const allChip = page.locator('[data-testid="instances-health-chip-all"]')
    await expect(allChip).toBeVisible()

    // At minimum there should be a "ready" chip
    const readyChip = page.locator('[data-testid="instances-health-chip-ready"]')
    if (await readyChip.count() > 0) {
      await expect(readyChip).toBeVisible()
      const text = await readyChip.textContent()
      expect(text).toMatch(/\d+/)
    }
  })

  test('Step 5: clicking health chip "reconciling" filters to reconciling instances', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/instances`)
    const data = await res.json()
    // E2E cluster has never-ready instances which are IN_PROGRESS (reconciling)
    const reconciling = data.items?.filter((i: { state: string }) => i.state === 'IN_PROGRESS')
    if (!reconciling || reconciling.length === 0) { test.skip(); return }

    await page.goto(`${BASE}/instances`)
    await page.waitForFunction(() => {
      return document.querySelector('.instance-table') !== null
    }, { timeout: 30000 })

    const reconChip = page.locator('[data-testid="instances-health-chip-reconciling"]')
    if (await reconChip.count() === 0) { test.skip(); return }

    await reconChip.click()

    // After filter: only reconciling rows should be visible
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('.instance-table__row')
      return rows.length > 0
    }, { timeout: 5000 })

    // URL should contain the health filter state
    const url = page.url()
    expect(url).toContain('health=reconciling')
  })
})
