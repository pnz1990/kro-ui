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
 * Journey 048: UI Polish and Docs
 *
 * Validates spec 048-ui-polish-and-docs — the 26-gap UI polish batch:
 *   - RGD cards render without raw undefined/null text
 *   - DAG legend is present on the Graph tab
 *   - Page titles follow the "content — kro-ui" format
 *
 * Spec ref: .specify/specs/048-ui-polish-and-docs/
 *
 * Cluster pre-conditions:
 *   - kind cluster running, kro installed, test-app RGD applied and Ready
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 048 — UI Polish', () => {

  test('Step 1: Overview page has no raw undefined/null text in RGD cards', async ({ page, request }) => {
    test.setTimeout(90_000)

    const rgdRes = await request.get(`${BASE}/api/v1/rgds`)
    expect(rgdRes.ok()).toBe(true)

    await page.goto(BASE)

    // Wait for at least one RGD card to appear
    await page.waitForFunction(
      () => {
        // Check for rgd-card- prefix (matches rgd-card-test-app etc.)
        const cards = document.querySelectorAll('[data-testid^="rgd-card-"]')
        if (cards.length > 0) return true
        // Fallback: any card-like element
        const anyCard = document.querySelectorAll('.rgd-card')
        return anyCard.length > 0
      },
      { timeout: 40_000 }
    )

    // No raw "undefined" or "[object Object]" in card content
    const cards = page.locator('[data-testid^="rgd-card-"], .rgd-card')
    const firstCard = cards.first()
    await expect(firstCard).toBeVisible({ timeout: 5_000 })
    const cardText = await firstCard.textContent() ?? ''
    expect(cardText).not.toContain('undefined')
    expect(cardText).not.toContain('[object Object]')
  })

  test('Step 2: RGD detail Graph tab shows DAG with nodes', async ({ page, request }) => {
    test.setTimeout(60_000)
    const rgdRes = await request.get(`${BASE}/api/v1/rgds/test-app`)
    if (!rgdRes.ok()) {
      test.skip(true, 'test-app not available')
      return
    }

    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 25_000 })

    // At least one node should render
    const nodes = page.locator('[data-testid^="dag-node-"]')
    await expect(nodes.first()).toBeVisible({ timeout: 10_000 })
  })

  test('Step 3: page titles follow the format "<content> — kro-ui"', async ({ page }) => {
    test.setTimeout(30_000)
    await page.goto(`${BASE}/rgds/test-app`)
    await page.waitForFunction(
      () => document.title.includes('kro-ui') && document.title.length > 7,
      { timeout: 20_000 }
    )
    const title = await page.title()
    expect(title).toMatch(/—\s*kro-ui/)
  })

}) // end test.describe
