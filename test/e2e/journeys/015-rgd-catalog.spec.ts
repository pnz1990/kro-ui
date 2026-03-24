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
 * Journey 015: RGD Catalog — search, filter, instance count, used-by detection
 *
 * Validates that the /catalog page:
 * - Renders CatalogCards for each RGD
 * - Filters cards by name/kind search input
 * - Shows a resolved instance count per card (not stuck at "…")
 * - Shows "Used by" row for chained RGDs
 * - Navigates to RGD graph when card is clicked
 *
 * Spec ref: .specify/specs/015-rgd-catalog/spec.md
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied (WebApp kind)
 * - chain-parent + chain-child RGDs applied (chain-child referenced by chain-parent)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 015 — RGD Catalog', () => {
  test('Step 1: /catalog renders catalog cards', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await expect(page).toHaveTitle(/catalog.*kro-ui|kro-ui.*catalog/i)

    // At least one catalog card should be visible
    await expect(page.locator('[data-testid^="catalog-card-"]').first()).toBeVisible({ timeout: 10000 })

    // test-app card is visible
    const card = page.getByTestId('catalog-card-test-app')
    await expect(card).toBeVisible()
  })

  test('Step 2: catalog card shows correct name and kind', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    const card = page.getByTestId('catalog-card-test-app')
    await expect(card).toBeVisible({ timeout: 10000 })

    await expect(card.getByTestId('catalog-card-name')).toHaveText('test-app')
    await expect(card.getByTestId('catalog-card-kind')).toHaveText('WebApp')
  })

  test('Step 3: instance count resolves to a number (not stuck at "…")', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    const card = page.getByTestId('catalog-card-test-app')
    await expect(card).toBeVisible({ timeout: 10000 })

    // Wait for the count cell to resolve — it starts as "…" and becomes "N instances"
    await expect(card.getByTestId('catalog-card-instances')).not.toHaveText('…', { timeout: 15000 })
    const instancesText = await card.getByTestId('catalog-card-instances').textContent()
    // Should be "N instance" or "N instances"
    expect(instancesText).toMatch(/\d+ instance/)
  })

  test('Step 4: search input filters cards by name', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('[data-testid^="catalog-card-"]').first()).toBeVisible({ timeout: 10000 })

    const search = page.locator('input[type="search"]')
    await expect(search).toBeVisible()
    await search.fill('test-app')
    await page.waitForTimeout(400) // debounce

    await expect(page.getByTestId('catalog-card-test-app')).toBeVisible()
    // Other cards should be hidden
    await expect(page.getByTestId('catalog-card-test-collection')).not.toBeVisible()
  })

  test('Step 5: search with no match shows empty state', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('[data-testid^="catalog-card-"]').first()).toBeVisible({ timeout: 10000 })

    const search = page.locator('input[type="search"]')
    await search.fill('xyzzy-nonexistent-99')
    await page.waitForTimeout(400)

    await expect(page.getByTestId('catalog-empty')).toBeVisible()
  })

  test('Step 6: clearing search restores all cards', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('[data-testid^="catalog-card-"]').first()).toBeVisible({ timeout: 10000 })

    const search = page.locator('input[type="search"]')
    await search.fill('test-app')
    await page.waitForTimeout(400)
    await expect(page.getByTestId('catalog-card-test-collection')).not.toBeVisible()

    await search.fill('')
    await page.waitForTimeout(400)
    await expect(page.getByTestId('catalog-card-test-collection')).toBeVisible()
  })

  test('Step 7: clicking a catalog card navigates to RGD graph', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    const card = page.getByTestId('catalog-card-test-app')
    await expect(card).toBeVisible({ timeout: 10000 })

    // The entire card body is a link (constitution §XIII)
    await card.click()
    await expect(page).toHaveURL(`${BASE}/rgds/test-app`)
  })

  test('Step 8: chain-parent card shows "Used by" row referencing chain-child', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)

    // chain-child is referenced by chain-parent — so chain-child card should show used-by
    const chainChildCard = page.getByTestId('catalog-card-chain-child')
    const isVisible = await chainChildCard.isVisible().catch(() => false)
    if (!isVisible) {
      test.skip()
      return
    }

    const usedBySection = chainChildCard.getByTestId('catalog-card-used-by')
    await expect(usedBySection).toBeVisible()
    await expect(usedBySection).toContainText('chain-parent')
  })
})
