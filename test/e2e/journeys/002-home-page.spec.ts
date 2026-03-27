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
 * Journey 002: Overview Page — RGD Card Grid and Navigation
 *
 * Validates that the overview page renders RGD cards correctly, displays
 * the active context name, and navigates to graph/instances views.
 *
 * Spec ref: .specify/specs/002-rgd-list-home/spec.md § E2E User Journey
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied and Ready=True
 * - test-instance CR applied
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 002 — Overview page RGD cards and navigation', () => {

  test('Step 1: Open the dashboard', async ({ page }) => {
    await page.goto(BASE)

    // Page title contains kro-ui
    await expect(page).toHaveTitle(/kro-ui/)

    // Top bar is visible and contains the kind cluster context name
    const contextName = page.getByTestId('context-name')
    await expect(contextName).toBeVisible()
    // The context name should be a non-empty string (kind cluster context)
    await expect(contextName).not.toHaveText('')
  })

  test('Step 2: RGD card renders', async ({ page }) => {
    await page.goto(BASE)

    // test-app card is visible
    const card = page.getByTestId('rgd-card-test-app')
    await expect(card).toBeVisible()

    // Card shows correct name
    const name = card.getByTestId('rgd-name')
    await expect(name).toHaveText('test-app')

    // Card shows correct kind (from test fixture: WebApp)
    const kind = card.getByTestId('rgd-kind')
    await expect(kind).toHaveText('WebApp')

    // Status dot is visible and NOT in error state
    // (Ready condition may not be True yet — either alive or unknown is acceptable)
    const dot = card.getByTestId('status-dot')
    await expect(dot).toBeVisible()
    // Verify the dot does NOT have error class (healthy test RGD should not be red)
    await expect(dot).not.toHaveClass(/status-dot--error/)
  })

  test('Step 3: Navigate to RGD graph via Graph button', async ({ page }) => {
    await page.goto(BASE)

    // Wait for card to be visible
    const card = page.getByTestId('rgd-card-test-app')
    await expect(card).toBeVisible()

    // Click Graph button
    const graphBtn = card.getByTestId('btn-graph')
    await graphBtn.click()

    // URL should be /rgds/test-app (React Router, no full reload)
    await expect(page).toHaveURL(`${BASE}/rgds/test-app`)

    // RGDDetail page should render (content assertion deferred to spec 003)
    // For now, just verify the route resolved and the page didn't error
    await expect(page.locator('.layout__content')).toBeVisible()
  })

  test('Step 4: Navigate back and use Instances button', async ({ page }) => {
    await page.goto(BASE)

    // Wait for card
    const card = page.getByTestId('rgd-card-test-app')
    await expect(card).toBeVisible()

    // Navigate to Graph first
    await card.getByTestId('btn-graph').click()
    await expect(page).toHaveURL(`${BASE}/rgds/test-app`)

    // Press browser back
    await page.goBack()
    await expect(page).toHaveURL(`${BASE}/`)

    // Card should still be visible
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible()

    // Click Instances button
    await page.getByTestId('rgd-card-test-app').getByTestId('btn-instances').click()
    await expect(page).toHaveURL(`${BASE}/rgds/test-app?tab=instances`)
  })

  test('Step 5: Overview page shows cards for all fixture RGDs', async ({ page }) => {
    await page.goto(BASE)

    for (const name of ['test-app', 'test-collection', 'multi-resource', 'external-ref', 'cel-functions']) {
      await expect(page.getByTestId(`rgd-card-${name}`)).toBeVisible()
    }
  })

  test('Step 6: All visible card kind labels are non-empty and not "?"', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible()

    const kindLabels = page.locator('[data-testid="rgd-kind"]')
    const count = await kindLabels.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const text = await kindLabels.nth(i).textContent()
      expect(text).not.toBe('')
      expect(text).not.toBe('?')
    }
  })

  test('Step 7: Search filter narrows cards to matching RGD', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible()

    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeVisible()

    await searchInput.fill('multi-resource')
    await page.waitForTimeout(400) // debounce

    // Only multi-resource card visible
    await expect(page.getByTestId('rgd-card-multi-resource')).toBeVisible()
    await expect(page.getByTestId('rgd-card-test-app')).not.toBeVisible()

    // Clear restores all cards
    await searchInput.fill('')
    await page.waitForTimeout(400)
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible()
  })

  test('Step 8: Searching a non-matching string shows empty state', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('virtual-grid-container')).toBeVisible()

    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('xyzzy-no-match-99999')
    await page.waitForTimeout(400)

    const emptyStatus = page.getByTestId('virtual-grid-container').locator('[role="status"]')
    await expect(emptyStatus).toBeVisible()
  })

  test('Step 9: Clicking the full card body of multi-resource navigates to its detail page', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('rgd-card-multi-resource')).toBeVisible()

    // Click the card's link wrapper (not a specific button) — validates fully-clickable card
    await page.getByTestId('rgd-card-multi-resource').click()
    await expect(page).toHaveURL(`${BASE}/rgds/multi-resource`)
  })

  test('Step 10: All visible RGD cards eventually show a health chip (not blank) — PR #296 regression guard', async ({ page }) => {
    // Prior to PR #296, GET /rgds/{inactive}/instances returned 500 → health chip was blank.
    // Now it returns 200 {items:[]} → chip shows "no instances".
    // This test verifies no card has a permanently blank chip area after full load.
    await page.goto(BASE)
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible()

    // Wait for async chip fetches to settle (some RGDs have many instances, slower fetch)
    await page.waitForSelector('[data-testid="health-chip"]', { timeout: 20000 })
    await page.waitForTimeout(5000) // allow remaining chips to settle

    // Every chip that IS visible must have non-blank text (not blank due to 500 error)
    const chips = page.locator('[data-testid="health-chip"]')
    const count = await chips.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const text = await chips.nth(i).textContent()
      // Must not be blank — blank means the API returned an error (PR #296 regression)
      expect(text?.trim().length).toBeGreaterThan(0)
      // Must not contain raw JS coercion artifacts (constitution §XII)
      expect(text).not.toContain('[object')
    }

    // Additionally verify the API itself returns 200 for all RGDs visible in the UI.
    // Fetch the RGD list and check instances for all of them.
    const rgdListResp = await page.request.get(`${BASE}/api/v1/rgds`)
    const rgdList = await rgdListResp.json()
    const rgdNames: string[] = (rgdList.items ?? []).map(
      (r: Record<string, Record<string, string>>) => r.metadata?.name,
    ).filter(Boolean)

    // Spot-check: pick up to 3 RGDs and verify /instances returns 200 (not 500)
    for (const name of rgdNames.slice(0, 3)) {
      const resp = await page.request.get(`${BASE}/api/v1/rgds/${name}/instances`)
      expect(resp.status(), `GET /rgds/${name}/instances should not return 500`).not.toBe(500)
    }
  })

  test('Step 11: Overview subtitle text is present (PR #279 section description)', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible()

    // PR #279 added a subtitle "Controller and RGD health at a glance"
    const subtitle = page.locator('text=Controller and RGD health at a glance')
    await expect(subtitle).toBeVisible({ timeout: 5000 })
  })
})
