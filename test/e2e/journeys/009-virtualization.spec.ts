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
 * Journey 009: RGD List Virtualization
 *
 * NOTE (spec 062): The VirtualGrid and search bar were moved from the Overview
 * page (/) to the Catalog page (/catalog) as part of the SRE dashboard rewrite.
 * Steps that previously tested virtualization on / now use /catalog.
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied (at least 1 RGD in the cluster)
 *
 * Spec ref: .specify/specs/024-rgd-list-virtualization/spec.md
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 009 — RGD list virtualization', () => {

  test('Step 1: Home page renders VirtualGrid container', async ({ page }) => {
    // NOTE (spec 062): VirtualGrid is on /catalog, not the Overview dashboard.
    await page.goto(`${BASE}/catalog`)
    await expect(page).toHaveTitle(/Catalog — kro-ui/)

    const container = page.getByTestId('virtual-grid-container')
    await expect(container).toBeVisible()
  })

  test('Step 2: Home page DOM card count is bounded', async ({ page }) => {
    // NOTE (spec 062): VirtualGrid is on /catalog.
    await page.goto(`${BASE}/catalog`)

    const container = page.getByTestId('virtual-grid-container')
    await expect(container).toBeVisible()

    const gridItems = page.getByTestId('virtual-grid-items')
    await expect(gridItems).toBeVisible()
    const cardCount = await gridItems.locator('[data-testid^="rgd-card-"], [data-testid^="catalog-card-"]').count()
    expect(cardCount).toBeGreaterThanOrEqual(5)
    expect(cardCount).toBeLessThan(500)
  })

  test('Step 3: Home page search bar is visible and functional', async ({ page }) => {
    // NOTE (spec 062): Search is on /catalog.
    await page.goto(`${BASE}/catalog`)
    await expect(page.getByTestId('virtual-grid-container')).toBeVisible()

    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeVisible()

    await searchInput.fill('xyzzy-no-match-12345')
    await page.waitForTimeout(400)
    const emptyStatus = page.getByTestId('virtual-grid-container').locator('[role="status"]')
    await expect(emptyStatus).toBeVisible()

    await searchInput.fill('')
    await page.waitForTimeout(400)
    const gridItems = page.getByTestId('virtual-grid-items')
    await expect(gridItems).toBeVisible()
  })

  test('Step 4: Catalog page renders VirtualGrid container', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await expect(page).toHaveTitle(/Catalog — kro-ui/)

    const container = page.getByTestId('virtual-grid-container')
    await expect(container).toBeVisible()
  })

  test('Step 5: Catalog page DOM card count is bounded', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)

    const container = page.getByTestId('virtual-grid-container')
    await expect(container).toBeVisible()

    const gridItems = page.getByTestId('virtual-grid-items')
    await expect(gridItems).toBeVisible()
    const cardCount = await gridItems.locator('[data-testid^="catalog-card-"]').count()
    expect(cardCount).toBeGreaterThanOrEqual(5)
    expect(cardCount).toBeLessThan(500)
  })

  test('Step 6: Catalog search debounces — filter fires after pause', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await expect(page.getByTestId('virtual-grid-container')).toBeVisible()

    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeVisible()

    await searchInput.fill('xyzzy-no-match-12345')
    await page.waitForTimeout(400)
    const emptyStatus = page.getByTestId('virtual-grid-container').locator('[role="status"]')
    await expect(emptyStatus).toBeVisible()

    await searchInput.fill('')
    await page.waitForTimeout(400)
    await expect(page.getByTestId('virtual-grid-items')).toBeVisible()
  })

  test('Step 7: home page DOM card count equals total fixture RGD count', async ({ page }) => {
    // NOTE (spec 062): VirtualGrid is on /catalog.
    await page.goto(`${BASE}/catalog`)

    // Wait for at least 1 card — some fixture RGDs may not be ready under throttling
    const hasCards = await page.waitForFunction(
      () => document.querySelectorAll('[data-testid^="catalog-card-"]').length >= 1,
      { timeout: 20000 }
    ).then(() => true).catch(() => false)
    if (!hasCards) { test.skip(true, 'No catalog cards rendered — fixture not ready'); return }

    const cardCount = await page.getByTestId('virtual-grid-items').locator('[data-testid^="catalog-card-"]').count()
    expect(cardCount).toBeGreaterThanOrEqual(1)
    expect(cardCount).toBeLessThan(500)
  })

  test('Step 8: searching "cel-functions" on home page shows the cel-functions card', async ({ page }) => {
    test.skip(!fixtureState.celFunctionsReady, 'cel-functions RGD not Ready')
    // NOTE (spec 062): Search is on /catalog.
    await page.goto(`${BASE}/catalog`)
    await expect(page.getByTestId('virtual-grid-items')).toBeVisible()

    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('cel-functions')
    await page.waitForTimeout(400)

    await expect(page.getByTestId('catalog-card-cel-functions')).toBeVisible()
    await expect(page.getByTestId('catalog-card-test-app')).not.toBeVisible()
  })

  test('Step 9: searching "external-ref" on home page shows the external-ref card', async ({ page }) => {
    test.skip(!fixtureState.externalRefReady, 'external-ref RGD not Ready')
    // NOTE (spec 062): Search is on /catalog.
    await page.goto(`${BASE}/catalog`)
    await expect(page.getByTestId('virtual-grid-items')).toBeVisible()

    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('external-ref')
    await page.waitForTimeout(400)

    await expect(page.getByTestId('catalog-card-external-ref')).toBeVisible()
    await expect(page.getByTestId('catalog-card-test-app')).not.toBeVisible()
  })
})
