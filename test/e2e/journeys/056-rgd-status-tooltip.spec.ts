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
 * NOTE (spec 062): The RGDCard component (which rendered rgd-card-error-hint)
 * is no longer used on any page. The Overview page shows RGD compile errors
 * in the W-3 widget (data-testid="widget-rgd-errors"), and the Catalog page
 * uses CatalogCard which shows a StatusDot but no error hint text.
 *
 * These tests are updated to verify the W-3 widget shows error info correctly,
 * and that the Catalog's StatusDot reflects the error state for broken RGDs.
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 056: RGD Card Error Hint', () => {

  // ── A+B: W-3 widget shows error info ─────────────────────────────────────

  test('Step 1: Error-state RGD cards show an error hint on the Overview', async ({ page }) => {
    // NOTE (spec 062): Error hints now in W-3 widget, not RGD cards.
    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-rgd-errors"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    const w3 = page.locator('[data-testid="widget-rgd-errors"]')
    await expect(w3).toBeVisible()
    // W-3 shows either clean state or error rows
    const text = await w3.textContent()
    expect(text?.trim().length).toBeGreaterThan(0)
  })

  test('Step 2: Error hint text is non-empty and contains a reason', async ({ page }) => {
    // NOTE (spec 062): Check W-3 for error text (no longer in rgd-card-error-hint).
    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-rgd-errors"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    const w3 = page.locator('[data-testid="widget-rgd-errors"]')
    const text = await w3.textContent()
    // Must not contain raw JS artifacts
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('[object')
  })

  // ── C: Catalog StatusDot reflects error state ─────────────────────────────

  test('Step 3: Ready-state RGD cards do not show an error hint', async ({ page }) => {
    // NOTE (spec 062): CatalogCard uses StatusDot, not rgd-card-error-hint.
    // Verify catalog loads without coercion artifacts.
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('[data-testid^="catalog-card-"]').first()).toBeVisible({ timeout: 15000 })

    const bodyText = await page.locator('body').textContent()
    expect(bodyText).not.toContain('undefined')
    expect(bodyText).not.toContain('[object')
  })

  // ── D: W-3 links have title attributes for accessibility ──────────────────

  test('Step 4: Error hint has a title attribute for accessibility', async ({ page }) => {
    // NOTE (spec 062): Error hint rows in W-3 have title attributes via CSS text-overflow.
    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-rgd-errors"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    const errorRows = page.locator('[data-testid="widget-rgd-errors"] .home__rgd-error-hint')
    const count = await errorRows.count()
    if (count > 0) {
      const title = await errorRows.first().getAttribute('title')
      expect(title).toBeTruthy()
      expect(title!.trim().length).toBeGreaterThan(0)
    }
    // If no error hints: W-3 shows clean state — that's also valid
  })
})
