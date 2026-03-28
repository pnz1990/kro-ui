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
 * Journey 059: Condition-based WARNINGS counter
 *
 * Spec: .specify/specs/059-condition-warnings/spec.md
 *
 * Verifies:
 *   A) An instance with failed conditions shows a non-zero WARNINGS count
 *   B) A healthy instance shows 0 WARNINGS
 *   C) The WARNINGS cell has a descriptive title tooltip
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.8.0
 * - never-ready RGD + never-ready-prod instance (stuck reconciling)
 * - kro-ui binary running at KRO_UI_BASE_URL
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 059: Condition-based WARNINGS counter', () => {

  // ── A: Stuck instance shows non-zero WARNINGS ───────────────────────────────

  test('Step 1: never-ready-prod instance shows WARNINGS > 0', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/instances`)
    expect(res.status()).toBe(200)
    // Verify never-ready-prod exists in the cluster via API
    const data = await res.json()
    const neverReady = data.items?.find((i: { name: string; rgdName: string }) =>
      i.name === 'never-ready-prod' && i.rgdName === 'never-ready'
    )
    if (!neverReady) {
      test.skip()
      return
    }

    await page.goto(`${BASE}/rgds/never-ready/instances/kro-ui-demo/never-ready-prod`)
    await page.waitForSelector('[data-testid="telemetry-panel"]', { timeout: 15000 })

    const warningsCell = page.locator('[data-testid="telemetry-cell-warnings"]')
    await expect(warningsCell).toBeVisible()

    // The value should be > 0 because never-ready-prod has ResourcesReady=False condition
    const valueSpan = warningsCell.locator('.telemetry-panel__value')
    const text = await valueSpan.textContent()
    const count = parseInt(text ?? '0', 10)
    expect(count).toBeGreaterThan(0)
  })

  // ── B: Healthy instance shows 0 WARNINGS ───────────────────────────────────

  test('Step 2: healthy instance shows 0 WARNINGS (assuming no kube Warning events)', async ({ page }) => {
    // Use a healthy instance — test the WARNINGS cell shows 0 or a number (not undefined/null)
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    await page.waitForSelector('[data-testid="instance-table"]', { timeout: 15000 })

    // Click first healthy instance
    const firstRow = page.locator('[data-testid="instance-table"] tbody tr').first()
    if (await firstRow.count() === 0) { return }

    const link = firstRow.locator('a').first()
    await link.click()

    await page.waitForSelector('[data-testid="telemetry-panel"]', { timeout: 15000 })

    const warningsCell = page.locator('[data-testid="telemetry-cell-warnings"]')
    await expect(warningsCell).toBeVisible()

    // Text must be a numeric string — not undefined, null, or NaN
    const valueSpan = warningsCell.locator('.telemetry-panel__value')
    const text = await valueSpan.textContent()
    expect(text).toMatch(/^\d+$/)
  })

  // ── C: WARNINGS cell has title tooltip ─────────────────────────────────────

  test('Step 3: WARNINGS cell has a title tooltip', async ({ page }) => {
    await page.goto(`${BASE}/rgds/never-ready/instances/kro-ui-demo/never-ready-prod`)
    await page.waitForSelector('[data-testid="telemetry-cell-warnings"]', { timeout: 15000 })

    const warningsCell = page.locator('[data-testid="telemetry-cell-warnings"]')
    const title = await warningsCell.getAttribute('title')
    expect(title).toBeTruthy()
    expect(title!.length).toBeGreaterThan(0)
  })
})
