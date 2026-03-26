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
 * Journey 041: Error States UX Audit
 *
 * Validates that error and empty states across the UI are enriched and
 * human-readable — no raw JSON errors, no blank pages, no "[object Object]".
 *
 * Spec ref: .specify/specs/041-error-states-ux-audit/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied
 *
 * Note: these tests exercise states that are always reachable on a working
 * cluster (empty states, not-found pages). Error states that require a
 * broken cluster are validated structurally (correct element presence), not
 * by inducing real cluster failures.
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 041 — Error States UX Audit', () => {
  test('Step 1: Overview page with no RGDs shows enriched empty state (not blank)', async ({ page }) => {
    // This test only asserts empty state structure — it may show real RGDs on a
    // populated cluster. We assert the page body is not blank.
    await page.goto(`${BASE}/`)
    // Page loads without error
    await expect(page.locator('body')).not.toContainText('[object Object]', { timeout: 10000 })
    await expect(page.locator('body')).not.toContainText('undefined')
    // The Overview page heading should be present
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('Step 2: Catalog page empty state does not show raw error or null', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('body')).not.toContainText('[object Object]', { timeout: 10000 })
    await expect(page.locator('body')).not.toContainText('null')
    // Page does not show a blank white screen — at minimum the layout chrome renders
    const layout = page.locator('[class*="layout"], [class*="page"], header, main, nav').first()
    await expect(layout).toBeVisible({ timeout: 10000 })
  })

  test('Step 3: Non-existent RGD detail shows human-readable error, not blank screen', async ({ page }) => {
    await page.goto(`${BASE}/rgds/does-not-exist-e2e-test`)
    // Should show an error state container, not a blank page
    await expect(page.getByTestId('rgd-detail-error')).toBeVisible({ timeout: 10000 })
    // Error message must be human-readable (not [object Object] or undefined)
    const errEl = page.getByTestId('rgd-detail-error')
    await expect(errEl).not.toContainText('[object Object]')
    await expect(errEl).not.toContainText('undefined')
    // A Retry button and back link should be present (spec 041 FR)
    await expect(errEl.locator('button, a').first()).toBeVisible()
  })

  test('Step 4: Fleet page does not show raw API errors for unreachable clusters', async ({ page }) => {
    await page.goto(`${BASE}/fleet`)
    await expect(page.locator('body')).not.toContainText('[object Object]', { timeout: 10000 })
    // Fleet page renders its layout
    const layout = page.locator('[class*="fleet"], [class*="layout"], main').first()
    await expect(layout).toBeVisible({ timeout: 10000 })
  })

  test('Step 5: Navigating to an unknown route shows the NotFound page', async ({ page }) => {
    await page.goto(`${BASE}/this-route-does-not-exist-at-all`)
    // NotFound page should render — not a blank screen
    await expect(page.locator('body')).not.toContainText('[object Object]', { timeout: 10000 })
    // At minimum the page title or heading indicates "not found"
    await expect(page.locator('body')).toContainText(/not found|404|doesn.*t exist/i, { timeout: 5000 })
  })
})
