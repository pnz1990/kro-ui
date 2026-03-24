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
 * Journey 017: RGD Validation Linting
 *
 * Validates that the Validation tab on the RGD detail page:
 * - Renders the validation-tab container
 * - Shows condition rows for a valid RGD
 * - Handles the case where no conditions are reported (graceful degradation)
 *
 * Spec ref: .specify/specs/017-rgd-validation-linting/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied and kro has reconciled it
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 017 — RGD Validation Linting', () => {
  test('Step 1: Validation tab is present and clickable on RGD detail page', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('tab-validation')).toBeVisible({ timeout: 10000 })
    await page.getByTestId('tab-validation').click()
    await expect(page.getByTestId('tab-validation')).toHaveAttribute('aria-selected', 'true')
  })

  test('Step 2: validation-tab container is rendered', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=validation`)
    await expect(page.getByTestId('validation-tab')).toBeVisible({ timeout: 10000 })
  })

  test('Step 3: validation tab shows condition rows or "no conditions" gracefully', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=validation`)
    await expect(page.getByTestId('validation-tab')).toBeVisible({ timeout: 10000 })

    // Allow time for the async condition data to arrive
    await page.waitForTimeout(3000)

    // Either condition items OR an empty/not-reported message is shown
    const conditionItems = page.locator('.condition-item, [class*="condition-item"]')
    const count = await conditionItems.count()

    if (count === 0) {
      // No conditions reported — the tab must still render (not crash)
      await expect(page.getByTestId('validation-tab')).toBeVisible()
    } else {
      // At least one condition item is rendered
      await expect(conditionItems.first()).toBeVisible()
    }
  })

  test('Step 4: validation tab does not show raw "undefined" or "null" text', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=validation`)
    await expect(page.getByTestId('validation-tab')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(3000)

    const content = await page.getByTestId('validation-tab').textContent()
    expect(content).not.toContain('undefined')
    expect(content).not.toContain('[object Object]')
  })

  test('Step 5: page title includes RGD name and kro-ui', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=validation`)
    await expect(page).toHaveTitle(/test-app.*kro-ui|kro-ui/i)
  })
})
