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
 * Journey 056: RGD Card Error Hint
 *
 * Spec: .specify/specs/056-rgd-status-tooltip/spec.md
 *
 * NOTE (spec 062): RGD cards were moved from the Overview page to /catalog.
 * These tests now navigate to /catalog to find RGD cards with error hints.
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 056: RGD Card Error Hint', () => {

  // ── A+B: Error-state card shows hint ────────────────────────────────────────

  test('Step 1: Error-state RGD cards show an error hint on the Overview', async ({ page }) => {
    // NOTE (spec 062): RGD cards are now on /catalog.
    await page.goto(`${BASE}/catalog`)
    await page.waitForSelector('[data-testid^="rgd-card-"]', { timeout: 15000 })

    // Check for any error hint elements — there should be at least one
    // (invalid-cel-rgd, cel-functions, chain-cycle-a/b all have error states)
    const hints = page.locator('[data-testid="rgd-card-error-hint"]')
    const count = await hints.count()
    expect(count).toBeGreaterThan(0)
  })

  // ── B: Hint text is non-empty and contains reason ──────────────────────────

  test('Step 2: Error hint text is non-empty and contains a reason', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await page.waitForSelector('[data-testid="rgd-card-error-hint"]', { timeout: 15000 })

    const hints = page.locator('[data-testid="rgd-card-error-hint"]')
    const count = await hints.count()
    for (let i = 0; i < Math.min(count, 3); i++) {
      const text = await hints.nth(i).textContent()
      expect(text?.trim().length).toBeGreaterThan(0)
      // Should not contain raw JS artifacts
      expect(text).not.toContain('undefined')
      expect(text).not.toContain('[object')
    }
  })

  // ── C: Ready-state cards have no error hint ────────────────────────────────

  test('Step 3: Ready-state RGD cards do not show an error hint', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await page.waitForSelector('[data-testid^="rgd-card-"]', { timeout: 15000 })

    // Find the test-app card (known to be Ready) and verify no error hint
    const testAppCard = page.locator('[data-testid="rgd-card-test-app"]')
    if (await testAppCard.count() > 0) {
      const hint = testAppCard.locator('[data-testid="rgd-card-error-hint"]')
      await expect(hint).not.toBeVisible()
    }
  })

  // ── D: Error hint has title attribute ─────────────────────────────────────

  test('Step 4: Error hint has a title attribute for accessibility', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await page.waitForSelector('[data-testid="rgd-card-error-hint"]', { timeout: 15000 })

    const firstHint = page.locator('[data-testid="rgd-card-error-hint"]').first()
    const title = await firstHint.getAttribute('title')
    expect(title).toBeTruthy()
    expect(title!.trim().length).toBeGreaterThan(0)
  })
})
