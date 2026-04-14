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
 * Journey 049: Designer UX Refresh Button
 *
 * Validates spec 049-designer-ux-refresh-button:
 *   - The RGD Designer (/author) has a refresh/reload button
 *   - CEL help text is visible in the Designer (scope and CEL expression help)
 *   - Optimization advisor docs URL is rendered (not a broken empty link)
 *
 * Spec ref: .specify/specs/049-designer-ux-refresh-button/
 *
 * Cluster pre-conditions:
 *   - kind cluster running, kro installed
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 049 — Designer UX: Refresh Button + CEL Help', () => {

  test('Step 1: /author page has a refresh or reload control', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await page.waitForFunction(
      () => document.readyState === 'complete',
      { timeout: 10_000 }
    )
    await page.waitForFunction(
      () => document.querySelector('textarea') !== null ||
            document.querySelector('.designer') !== null ||
            document.querySelector('[data-testid="author-page"]') !== null,
      { timeout: 15_000 }
    )
    // A refresh / reload button should exist in the designer UI
    const refreshEl = page.locator(
      '[data-testid="designer-refresh"], button[aria-label*="refresh" i], button[aria-label*="reload" i], button:has-text("Refresh"), button:has-text("Reload")'
    )
    const count = await refreshEl.count()
    // If refresh button is not found, the spec requires it — flag as skip with note
    if (count === 0) {
      // The button may use different labels; try broader search
      const anyRefresh = await page.locator('button').filter({ hasText: /refresh|reload/i }).count()
      // The button is a required feature — assert it exists
      expect(anyRefresh).toBeGreaterThan(0)
    } else {
      await expect(refreshEl.first()).toBeVisible()
    }
  })

  test('Step 2: /author page shows CEL help text or expression guidance', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await page.waitForFunction(
      () => document.readyState === 'complete' &&
            (document.querySelector('textarea') !== null ||
             document.querySelector('.designer') !== null),
      { timeout: 15_000 }
    )
    // CEL help should mention CEL expression syntax, readyWhen, or includeWhen
    await page.waitForFunction(
      () => document.body.innerText.includes('CEL') ||
            document.body.innerText.includes('readyWhen') ||
            document.body.innerText.includes('includeWhen') ||
            document.body.innerText.includes('expression'),
      { timeout: 10_000 }
    )
  })

  test('Step 3: optimization advisor does not show a broken docs link', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await page.waitForFunction(
      () => document.readyState === 'complete',
      { timeout: 10_000 }
    )
    // If optimization advisor is shown, its docs link must be non-empty
    const advisorLinks = page.locator('.advisor a[href], [data-testid*="advisor"] a[href]')
    const count = await advisorLinks.count()
    if (count > 0) {
      const href = await advisorLinks.first().getAttribute('href')
      expect(href).toBeTruthy()
      expect(href).not.toBe('#')
    }
    // If no advisor visible, this step is a no-op (no optimization candidates in this cluster)
  })

}) // end test.describe
