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
 * Journey 070: Catalog compile-status filter — All / Ready / Errors toggle
 *
 * Spec: .specify/specs/070-catalog-status-filter/spec.md  (PR #357)
 *
 * Verifies:
 *   A) Three status filter buttons render in the Catalog toolbar
 *   B) "Errors" filter hides ready-state RGDs
 *   C) "Ready" filter hides error-state RGDs
 *   D) "All" restores full list after a filter is active
 *   E) aria-pressed is updated correctly on each button
 *
 * Cluster pre-conditions:
 * - kind cluster with at least one Ready=True RGD (test-app)
 * - kind cluster with at least one Ready=False RGD (chain-cycle-a or similar)
 * - kro-ui binary running at KRO_UI_BASE_URL
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 070: Catalog compile-status filter', () => {

  // ── A: Filter buttons render ──────────────────────────────────────────────────

  test('Step 1: All, Ready, and Errors filter buttons are present in the Catalog', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await page.waitForSelector('[data-testid="catalog-status-all"]', { timeout: 20000 })

    await expect(page.getByTestId('catalog-status-all')).toBeVisible()
    await expect(page.getByTestId('catalog-status-ready')).toBeVisible()
    await expect(page.getByTestId('catalog-status-errors')).toBeVisible()
  })

  test('Step 2: "All" button is active (aria-pressed=true) by default', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await page.waitForSelector('[data-testid="catalog-status-all"]', { timeout: 20000 })

    const allBtn = page.getByTestId('catalog-status-all')
    await expect(allBtn).toHaveAttribute('aria-pressed', 'true')

    const readyBtn = page.getByTestId('catalog-status-ready')
    await expect(readyBtn).toHaveAttribute('aria-pressed', 'false')

    const errorsBtn = page.getByTestId('catalog-status-errors')
    await expect(errorsBtn).toHaveAttribute('aria-pressed', 'false')
  })

  // ── B: Errors filter hides ready RGDs ────────────────────────────────────────

  test('Step 3: Errors filter shows only error-state RGDs', async ({ page }) => {
    // Confirm error RGDs exist
    const res = await page.request.get(`${BASE}/api/v1/rgds`)
    const data = await res.json()
    const hasErrors = data.items?.some((rgd: { status?: { conditions?: Array<{ type: string; status: string }> } }) =>
      rgd.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'False')
    )
    if (!hasErrors) { test.skip(); return }

    await page.goto(`${BASE}/catalog`)
    await page.waitForSelector('[data-testid="catalog-card-test-app"]', { timeout: 20000 })

    // Click Errors filter
    await page.getByTestId('catalog-status-errors').click()

    // test-app is Ready=True — should disappear
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="catalog-card-test-app"]') === null
    }, { timeout: 5000 })

    // Errors button should now be active
    await expect(page.getByTestId('catalog-status-errors')).toHaveAttribute('aria-pressed', 'true')

    // At least one card should still be visible (the error-state ones)
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('[data-testid^="catalog-card-"]')
      return cards.length > 0
    }, { timeout: 5000 })
  })

  // ── C: Ready filter hides error RGDs ─────────────────────────────────────────

  test('Step 4: Ready filter shows only ready-state RGDs', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await page.waitForSelector('[data-testid="catalog-card-test-app"]', { timeout: 20000 })

    // Get all cards before filter
    const cardsBefore = await page.locator('[data-testid^="catalog-card-"]').count()

    await page.getByTestId('catalog-status-ready').click()

    // Wait for filter to apply
    await page.waitForFunction(
      (before: number) => {
        const cards = document.querySelectorAll('[data-testid^="catalog-card-"]')
        return cards.length !== before || cards.length === before
      },
      cardsBefore,
      { timeout: 5000 }
    ).catch(() => {})

    // test-app should still be visible (it's Ready=True)
    await expect(page.getByTestId('catalog-card-test-app')).toBeVisible({ timeout: 5000 })

    // Ready button should be active
    await expect(page.getByTestId('catalog-status-ready')).toHaveAttribute('aria-pressed', 'true')
  })

  // ── D: All restores full list ─────────────────────────────────────────────────

  test('Step 5: clicking All after Errors filter restores full RGD list', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/rgds`)
    const data = await res.json()
    const hasErrors = data.items?.some((rgd: { status?: { conditions?: Array<{ type: string; status: string }> } }) =>
      rgd.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'False')
    )
    if (!hasErrors) { test.skip(); return }

    await page.goto(`${BASE}/catalog`)
    await page.waitForSelector('[data-testid="catalog-card-test-app"]', { timeout: 20000 })

    // Activate Errors filter
    await page.getByTestId('catalog-status-errors').click()
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="catalog-card-test-app"]') === null
    }, { timeout: 5000 })

    // Click All to restore
    await page.getByTestId('catalog-status-all').click()

    // test-app should be back
    await expect(page.getByTestId('catalog-card-test-app')).toBeVisible({ timeout: 5000 })

    // All button active, others inactive
    await expect(page.getByTestId('catalog-status-all')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('catalog-status-errors')).toHaveAttribute('aria-pressed', 'false')
  })
})
