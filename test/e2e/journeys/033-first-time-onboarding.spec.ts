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
 * Journey 033: First-Time Onboarding
 *
 * Validates the onboarding empty state when no RGDs exist.
 * Because our CI cluster always has RGDs, this journey:
 * 1. Verifies the home page renders with cards (not empty state) on a loaded cluster
 * 2. Verifies the onboarding empty state renders correctly by navigating to a
 *    non-existent RGD kind (which triggers the 404 path, not onboarding, so we
 *    instead validate the home page fallback text and structure)
 * 3. Validates the tagline / subtitle text shown above the card grid
 *
 * Spec ref: .specify/specs/033-first-time-onboarding/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 033 — First-Time Onboarding', () => {
  test('Step 1: home page renders RGD grid when RGDs exist', async ({ page }) => {
    // NOTE (spec 062): RGD card grid moved to /catalog. Overview is now the SRE dashboard.
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('[data-testid^="catalog-card-"]').first()).toBeVisible({ timeout: 10000 })
    // Grid container is present
    await expect(page.getByTestId('virtual-grid-container')).toBeVisible()
  })

  test('Step 2: page title is correctly set', async ({ page }) => {
    await page.goto(BASE)
    await expect(page).toHaveTitle(/kro-ui/)
  })

  test('Step 3: footer is present with kro.run link (spec 035 onboarding integration)', async ({ page }) => {
    await page.goto(BASE)
    const footer = page.locator('footer[role="contentinfo"], .footer')
    await expect(footer).toBeVisible()
    const kroLink = footer.locator('a[href="https://kro.run"]')
    await expect(kroLink).toBeVisible()
  })

  test('Step 4: "No ResourceGraphDefinitions found" empty state renders when items are empty', async ({ page }) => {
    // We can't empty the real cluster, so we validate the empty state structure via
    // the search filter path on /catalog — when search matches nothing, empty state appears.
    // NOTE (spec 062): search filter lives on /catalog, not the Overview dashboard.
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('[data-testid^="catalog-card-"]').first()).toBeVisible({ timeout: 15000 })

    const search = page.locator('input[type="search"]')
    await search.fill('__no_match_xyzzy__')
    await page.waitForTimeout(400)

    // The empty state container is rendered
    await expect(page.locator('[data-testid="virtual-grid-container"] [role="status"]')).toBeVisible()
  })

  test('Step 5: 404 page renders for unknown routes', async ({ page }) => {
    await page.goto(`${BASE}/this-route-does-not-exist-9999`)
    // NotFound.tsx renders: <div className="not-found" data-testid="not-found-page">
    //                         <h1 className="not-found__heading">Page not found</h1>
    await expect(page.getByTestId('not-found-page')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.not-found__heading')).toHaveText('Page not found')
  })
})
