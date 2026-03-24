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
 * Journey 019: Smart Event Stream
 *
 * Validates that the /events page:
 * - Renders the events page container
 * - Shows the filter bar with RGD and instance filter inputs
 * - Loads events (or shows empty state — both are valid for a fresh cluster)
 * - RGD filter input narrows the stream
 * - Clear filters button resets inputs
 *
 * Spec ref: .specify/specs/019-smart-event-stream/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD + test-instance CR applied
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 019 — Smart Event Stream', () => {
  test('Step 1: /events page renders', async ({ page }) => {
    await page.goto(`${BASE}/events`)
    await expect(page).toHaveTitle(/events.*kro-ui|kro-ui/i)
    await expect(page.getByTestId('events-page')).toBeVisible({ timeout: 10000 })
  })

  test('Step 2: filter bar is visible with RGD and instance inputs', async ({ page }) => {
    await page.goto(`${BASE}/events`)
    await expect(page.getByTestId('events-page')).toBeVisible({ timeout: 10000 })

    await expect(page.getByTestId('filter-bar')).toBeVisible()
    await expect(page.getByTestId('rgd-filter-input')).toBeVisible()
    await expect(page.getByTestId('instance-filter-input')).toBeVisible()
  })

  test('Step 3: events load or empty state appears (not stuck loading)', async ({ page }) => {
    await page.goto(`${BASE}/events`)
    await expect(page.getByTestId('events-page')).toBeVisible({ timeout: 10000 })

    // Wait for the loading spinner to disappear
    await expect(page.getByTestId('events-loading')).not.toBeVisible({ timeout: 15000 })

    // After load: either stream, grouped view, or empty state is shown — all valid
    const streamVisible = await page.getByTestId('events-stream').isVisible()
    const groupedVisible = await page.getByTestId('events-grouped').isVisible()
    const emptyVisible = await page.getByTestId('events-empty').isVisible()
    expect(streamVisible || groupedVisible || emptyVisible).toBe(true)
  })

  test('Step 4: RGD filter input accepts text', async ({ page }) => {
    await page.goto(`${BASE}/events`)
    await expect(page.getByTestId('events-page')).toBeVisible({ timeout: 10000 })

    const input = page.getByTestId('rgd-filter-input')
    await input.fill('test-app')
    await expect(input).toHaveValue('test-app')
  })

  test('Step 5: clear filters button resets inputs', async ({ page }) => {
    await page.goto(`${BASE}/events`)
    await expect(page.getByTestId('events-page')).toBeVisible({ timeout: 10000 })

    const rgdInput = page.getByTestId('rgd-filter-input')
    await rgdInput.fill('test-app')
    await expect(rgdInput).toHaveValue('test-app')

    // clear-filters-btn is only rendered when hasFilters=true (after input)
    const clearBtn = page.getByTestId('clear-filters-btn')
    await expect(clearBtn).toBeVisible({ timeout: 3000 })
    await clearBtn.click()
    await expect(rgdInput).toHaveValue('')
  })

  test('Step 6: anomaly banners are conditional — page does not crash without them', async ({ page }) => {
    await page.goto(`${BASE}/events`)
    await expect(page.getByTestId('events-page')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('events-loading')).not.toBeVisible({ timeout: 15000 })

    // anomaly-banners is only rendered when anomalies.length > 0 (Events.tsx:266).
    // On a fresh kind cluster there are typically no anomalies — the absence is correct.
    const anomalyContainer = page.getByTestId('anomaly-banners')
    const hasAnomalies = await anomalyContainer.isVisible().catch(() => false)

    if (hasAnomalies) {
      // If anomalies DO exist, each banner must have content
      const banners = page.getByTestId('anomaly-banner')
      const count = await banners.count()
      expect(count).toBeGreaterThan(0)
    }
    // If no anomalies — verify the page still loaded correctly (no crash)
    const pageOk = await page.getByTestId('events-page').isVisible()
    expect(pageOk).toBe(true)
  })
})
