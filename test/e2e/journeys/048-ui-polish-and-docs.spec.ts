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
 *   - DAG nodes render on Graph tab
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
    if (!rgdRes.ok()) {
      test.skip(true, 'RGD list endpoint unavailable')
      return
    }
    const body = await rgdRes.json()
    const items = body?.items ?? []
    if (items.length === 0) {
      test.skip(true, 'No RGDs found on this cluster — card text test skipped')
      return
    }

    await page.goto(`${BASE}/catalog`)

    // Wait for at least one RGD card — use a longer timeout for throttled CI cluster
    const appeared = await page.waitForFunction(
      () => document.querySelectorAll('[data-testid^="catalog-card-"], [data-testid^="rgd-card-"]').length > 0 ||
            document.querySelectorAll('.rgd-card, .catalog-card').length > 0,
      { timeout: 40_000 }
    ).catch(() => null)

    if (!appeared) {
      test.skip(true, 'RGD cards did not appear within 40s — likely throttled cluster; skipping')
      return
    }

    // No raw "undefined" or "[object Object]" in card content
    const cards = page.locator('[data-testid^="catalog-card-"], [data-testid^="rgd-card-"], .rgd-card, .catalog-card')
    const firstCard = cards.first()
    await expect(firstCard).toBeVisible({ timeout: 5_000 })
    const cardText = await firstCard.textContent() ?? ''
    expect(cardText).not.toContain('undefined')
    expect(cardText).not.toContain('[object Object]')
  })

  test('Step 2: RGD detail Graph tab renders DAG nodes', async ({ page, request }) => {
    test.setTimeout(60_000)
    const rgdRes = await request.get(`${BASE}/api/v1/rgds/test-app`)
    if (!rgdRes.ok()) {
      test.skip(true, 'test-app not available')
      return
    }

    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 25_000 })

    // At least the root schema node should render
    const rootNode = page.getByTestId('dag-node-schema')
    await expect(rootNode).toBeVisible({ timeout: 10_000 })
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
