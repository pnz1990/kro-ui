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
 * NOTE (spec 062): The Overview page (/) was rewritten as a 7-widget SRE
 * dashboard. The RGD card grid, search bar, health chips, and error banner
 * were moved to the Catalog page (/catalog).
 *
 * Steps that previously tested the card grid on / now navigate to /catalog.
 * Step 1 (title + context name) and Steps 3-4 (RGD detail navigation) still
 * work from / since the TopBar and routing are unchanged.
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
    // NOTE (spec 062): RGD cards moved to /catalog.
    await page.goto(`${BASE}/catalog`)

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
    const dot = card.getByTestId('status-dot')
    await expect(dot).toBeVisible()
    await expect(dot).not.toHaveClass(/status-dot--error/)
  })

  test('Step 3: Navigate to RGD graph via Graph button', async ({ page }) => {
    // NOTE (spec 062): Navigate from /catalog where cards live.
    await page.goto(`${BASE}/catalog`)

    // Wait for card to be visible
    const card = page.getByTestId('rgd-card-test-app')
    await expect(card).toBeVisible()

    // Click Graph button
    const graphBtn = card.getByTestId('btn-graph')
    await graphBtn.click()

    // URL should be /rgds/test-app
    await expect(page).toHaveURL(`${BASE}/rgds/test-app`)
    await expect(page.locator('.layout__content')).toBeVisible()
  })

  test('Step 4: Navigate back and use Instances button', async ({ page }) => {
    // NOTE (spec 062): Navigate from /catalog.
    await page.goto(`${BASE}/catalog`)

    // Wait for card
    const card = page.getByTestId('rgd-card-test-app')
    await expect(card).toBeVisible()

    // Navigate to Graph first
    await card.getByTestId('btn-graph').click()
    await expect(page).toHaveURL(`${BASE}/rgds/test-app`)

    // Press browser back — returns to catalog
    await page.goBack()
    await expect(page).toHaveURL(`${BASE}/catalog`)

    // Card should still be visible
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible()

    // Click Instances button
    await page.getByTestId('rgd-card-test-app').getByTestId('btn-instances').click()
    await expect(page).toHaveURL(`${BASE}/rgds/test-app?tab=instances`)
  })

  test('Step 5: Overview page shows cards for all fixture RGDs', async ({ page }) => {
    // NOTE (spec 062): Cards are on /catalog.
    await page.goto(`${BASE}/catalog`)

    for (const name of ['test-app', 'test-collection', 'multi-resource', 'external-ref', 'cel-functions']) {
      await expect(page.getByTestId(`rgd-card-${name}`)).toBeVisible()
    }
  })

  test('Step 6: All visible card kind labels are non-empty and not "?"', async ({ page }) => {
    // NOTE (spec 062): Cards are on /catalog.
    await page.goto(`${BASE}/catalog`)
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
    // NOTE (spec 062): Search is on /catalog.
    await page.goto(`${BASE}/catalog`)
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
    // NOTE (spec 062): VirtualGrid and search are on /catalog.
    await page.goto(`${BASE}/catalog`)
    await expect(page.getByTestId('virtual-grid-container')).toBeVisible()

    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('xyzzy-no-match-99999')
    await page.waitForTimeout(400)

    const emptyStatus = page.getByTestId('virtual-grid-container').locator('[role="status"]')
    await expect(emptyStatus).toBeVisible()
  })

  test('Step 9: Clicking the full card body of multi-resource navigates to its detail page', async ({ page }) => {
    // NOTE (spec 062): Cards are on /catalog.
    await page.goto(`${BASE}/catalog`)
    await expect(page.getByTestId('rgd-card-multi-resource')).toBeVisible()

    await page.getByTestId('rgd-card-multi-resource').click()
    await expect(page).toHaveURL(`${BASE}/rgds/multi-resource`)
  })

  test('Step 10: All visible RGD cards eventually show a health chip (not blank) — PR #296 regression guard', async ({ page }) => {
    // NOTE (spec 062): Cards and health chips are on /catalog.
    await page.goto(`${BASE}/catalog`)
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible()

    await page.waitForSelector('[data-testid="health-chip"]', { timeout: 20000 })
    await page.waitForTimeout(5000)

    const chips = page.locator('[data-testid="health-chip"]')
    const count = await chips.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const text = await chips.nth(i).textContent()
      expect(text?.trim().length).toBeGreaterThan(0)
      expect(text).not.toContain('[object')
    }

    const rgdListResp = await page.request.get(`${BASE}/api/v1/rgds`)
    const rgdList = await rgdListResp.json()
    const rgdNames: string[] = (rgdList.items ?? []).map(
      (r: Record<string, Record<string, string>>) => r.metadata?.name,
    ).filter(Boolean)

    for (const name of rgdNames.slice(0, 3)) {
      const resp = await page.request.get(`${BASE}/api/v1/rgds/${name}/instances`)
      expect(resp.status(), `GET /rgds/${name}/instances should not return 500`).not.toBe(500)
    }
  })

  test('Step 11: Overview subtitle text is present (PR #279 section description)', async ({ page }) => {
    // NOTE (spec 062): The new Overview page has a tagline "Single-cluster health dashboard".
    await page.goto(BASE)
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="widget-instances"]') !== null,
      { timeout: 20000 }
    )

    // New dashboard tagline
    const tagline = page.locator('text=Single-cluster health dashboard')
    await expect(tagline).toBeVisible({ timeout: 5000 })
  })

  test('Step 12: RGD compile-error banner appears when invalid RGDs are present (spec 069)', async ({ page }) => {
    // NOTE (spec 062): Error banner replaced by W-3 widget on the Overview dashboard.
    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-rgd-errors"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    // W-3 should either show the clean state or error rows
    const w3 = page.locator('[data-testid="widget-rgd-errors"]')
    await expect(w3).toBeVisible()
    // Content must not be blank or contain coercion artifacts
    const text = await w3.textContent()
    expect(text?.trim().length).toBeGreaterThan(0)
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('[object')
  })
})
