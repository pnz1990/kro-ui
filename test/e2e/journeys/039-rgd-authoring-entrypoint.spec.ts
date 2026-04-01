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
 * Journey 039: RGD Designer Global Entrypoint
 *
 * Validates that the RGD Designer is discoverable from:
 * 1. The top bar "RGD Designer" nav link (visible on every page)
 * 2. Navigating to /author renders the authoring form and live DAG preview
 * 3. The Home empty state "Open RGD Designer" link only appears in the
 *    onboarding variant (not in the no-search-results variant)
 * 4. The /author page shows a live DAG preview panel
 *
 * Spec ref: .specify/specs/039-rgd-authoring-entrypoint/
 *           .specify/specs/042-rgd-designer-nav/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 039 — RGD Designer Global Entrypoint', () => {
  test('Step 1: top bar has a visible "RGD Designer" nav link on the home page', async ({ page }) => {
    await page.goto(BASE)
    // Wait for the page to load (top bar is always rendered, no data dependency)
    await expect(page.getByTestId('topbar-rgd-designer')).toBeVisible({ timeout: 10000 })
    const text = await page.getByTestId('topbar-rgd-designer').textContent()
    expect(text?.trim()).toContain('RGD Designer')
  })

  test('Step 2: clicking top bar "RGD Designer" navigates to /author and renders the form', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('topbar-rgd-designer')).toBeVisible({ timeout: 10000 })

    await page.getByTestId('topbar-rgd-designer').click()

    // URL must change to /author
    await expect(page).toHaveURL(`${BASE}/author`, { timeout: 5000 })

    // Page title
    await expect(page).toHaveTitle(/RGD Designer — kro-ui/)

    // RGDAuthoringForm must be visible
    await expect(page.getByTestId('rgd-authoring-form')).toBeVisible({ timeout: 5000 })
  })

  test('Step 3: Home no-match empty state does NOT show "Open RGD Designer" link', async ({ page }) => {
    // NOTE (spec 062): Search filter and RGD grid moved to /catalog.
    await page.goto(`${BASE}/catalog`)
    // Wait for at least one catalog card so the VirtualGrid is active
    const cardsLoaded = await page.locator('[data-testid^="catalog-card-"]').first()
      .waitFor({ timeout: 15000 }).then(() => true).catch(() => false)
    if (!cardsLoaded) { test.skip(true, 'Catalog not loaded — fixture not ready'); return }

    // Type a search that matches nothing
    const search = page.locator('input[type="search"]')
    await search.fill('__no_match_xyzzy_039__')
    await page.waitForTimeout(400)

    // Empty state must be visible
    await expect(page.locator('[data-testid="virtual-grid-container"] [role="status"]')).toBeVisible({ timeout: 5000 })
    // "Open RGD Designer" must NOT appear in no-match state
    await expect(page.getByTestId('home-new-rgd-link')).not.toBeVisible()
  })

  test('Step 4: /author page shows live DAG preview panel', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await expect(page.getByTestId('rgd-authoring-form')).toBeVisible({ timeout: 10000 })

    // The DAG preview pane must be visible on the RGD Designer page
    await expect(page.locator('.author-page__dag-pane')).toBeVisible({ timeout: 5000 })

    // The page title must be "RGD Designer — kro-ui"
    await expect(page).toHaveTitle(/RGD Designer — kro-ui/)
  })
})
