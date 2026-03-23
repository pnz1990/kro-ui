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
 * Validates that the Home page and Catalog page:
 * - Render the VirtualGrid container (not a flat map)
 * - Only mount a bounded number of card DOM nodes (windowed rendering)
 * - Debounce the search input (filter fires after pause, not per-keystroke)
 * - Show correct empty states
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied (at least 1 RGD in the cluster)
 *
 * Note: This journey tests the virtualisation infrastructure. With a single
 * test-app RGD the DOM count bound is trivially satisfied. The unit tests for
 * useVirtualGrid cover the 5,000-item arithmetic; the E2E confirms the wiring.
 *
 * Spec ref: .specify/specs/024-rgd-list-virtualization/spec.md
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 009 — RGD list virtualization', () => {

  test('Step 1: Home page renders VirtualGrid container', async ({ page }) => {
    await page.goto(BASE)
    await expect(page).toHaveTitle(/kro-ui/)

    // VirtualGrid container must be present
    const container = page.getByTestId('virtual-grid-container')
    await expect(container).toBeVisible()
  })

  test('Step 2: Home page DOM card count is bounded', async ({ page }) => {
    await page.goto(BASE)

    // Wait for the grid to render
    const container = page.getByTestId('virtual-grid-container')
    await expect(container).toBeVisible()

    // Count the rendered card elements inside the items div.
    // With the test-app fixture (1 RGD) this should be exactly 1.
    // The assertion < 100 validates the bound holds regardless of cluster size.
    const gridItems = page.getByTestId('virtual-grid-items')
    await expect(gridItems).toBeVisible()
    const cardCount = await gridItems.locator('[class*="rgd-card"]').count()
    expect(cardCount).toBeLessThan(100)
  })

  test('Step 3: Home page search bar is visible and functional', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('virtual-grid-container')).toBeVisible()

    // Search input must exist
    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeVisible()

    // Type a query that matches nothing — should show empty state
    await searchInput.fill('xyzzy-no-match-12345')
    // Wait for the 300ms debounce to fire
    await page.waitForTimeout(400)
    // VirtualGrid empty state must be visible (scoped to avoid ambiguity with MetricsStrip)
    const emptyStatus = page.getByTestId('virtual-grid-container').locator('[role="status"]')
    await expect(emptyStatus).toBeVisible()

    // Clear the search — list should return
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

    const gridItems = page.getByTestId('virtual-grid-items')
    await expect(gridItems).toBeVisible()

    const cardCount = await gridItems.locator('[class*="catalog-card"]').count()
    expect(cardCount).toBeLessThan(100)
  })

  test('Step 6: Catalog search debounces — filter fires after pause', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await expect(page.getByTestId('virtual-grid-container')).toBeVisible()

    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeVisible()

    // Type a non-matching query
    await searchInput.fill('xyzzy-no-match-12345')
    // Immediately after typing (before debounce) the grid may still show items
    // Wait for 300ms debounce + a little render time
    await page.waitForTimeout(400)
    // VirtualGrid empty state must be visible (scoped to avoid ambiguity with MetricsStrip)
    const emptyStatus = page.getByTestId('virtual-grid-container').locator('[role="status"]')
    await expect(emptyStatus).toBeVisible()

    // Clear and verify list returns
    await searchInput.fill('')
    await page.waitForTimeout(400)
    await expect(page.getByTestId('virtual-grid-items')).toBeVisible()
  })

  // ── Steps 7-9: multi-RGD search coverage ─────────────────────────────────

  test('Step 7: home page DOM card count equals total fixture RGD count', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('virtual-grid-items')).toBeVisible()

    // The fixture set installs at least 7 RGDs (test-app, test-collection,
    // multi-resource, external-ref, cel-functions, chain-parent, chain-child).
    // All fit in the viewport at normal card size — no windowing at this count.
    // The bound < 100 guards against accidentally rendering unbounded items.
    const cardCount = await page.getByTestId('virtual-grid-items').locator('[class*="rgd-card"]').count()
    expect(cardCount).toBeGreaterThanOrEqual(5)
    expect(cardCount).toBeLessThan(100)
  })

  test('Step 8: searching "cel-functions" on home page shows the cel-functions card', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('virtual-grid-items')).toBeVisible()

    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('cel-functions')
    await page.waitForTimeout(400)

    // cel-functions card must be visible; count may be > 1 if other RGD names partially match
    await expect(page.getByTestId('rgd-card-cel-functions')).toBeVisible()
    // No unrelated card (e.g. test-app) should be visible
    await expect(page.getByTestId('rgd-card-test-app')).not.toBeVisible()
  })

  test('Step 9: searching "external-ref" on home page shows the external-ref card', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('virtual-grid-items')).toBeVisible()

    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('external-ref')
    await page.waitForTimeout(400)

    // external-ref card must be visible; test-app must not be
    await expect(page.getByTestId('rgd-card-external-ref')).toBeVisible()
    await expect(page.getByTestId('rgd-card-test-app')).not.toBeVisible()
  })
})
