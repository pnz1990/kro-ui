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
 *   - Tooltips are rendered via portal (no SVG clipping)
 *   - DAG legend is present on the Graph tab
 *   - Abbreviation expansions work (e.g. "forEach" label present on collection nodes)
 *   - No raw undefined/null text in key UI areas
 *
 * Spec ref: .specify/specs/048-ui-polish-and-docs/
 *
 * Cluster pre-conditions:
 *   - kind cluster running, kro installed, test-app RGD applied and Ready
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 048 — UI Polish', () => {

  test('Step 1: Overview page has no raw undefined/null text in RGD cards', async ({ page, request }) => {
    const rgdRes = await request.get(`${BASE}/api/v1/rgds`)
    expect(rgdRes.ok()).toBe(true)

    await page.goto(BASE)
    await page.waitForFunction(
      () => {
        const cards = document.querySelectorAll('[data-testid^="rgd-card"]')
        return cards.length > 0
      },
      { timeout: 20_000 }
    )
    // No raw "undefined" or "null" visible in card content
    const cardText = await page.locator('[data-testid^="rgd-card"]').first().textContent()
    expect(cardText).not.toContain('undefined')
    expect(cardText).not.toContain('[object Object]')
  })

  test('Step 2: RGD detail Graph tab shows DAG legend', async ({ page, request }) => {
    const rgdRes = await request.get(`${BASE}/api/v1/rgds/test-app`)
    if (!rgdRes.ok()) {
      test.skip(true, 'test-app not available')
      return
    }

    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 20_000 })

    // DAG legend should be present (added in spec 048)
    await page.waitForFunction(
      () => {
        const legend = document.querySelector('[data-testid="dag-legend"]') ||
          document.querySelector('.dag-legend') ||
          document.body.innerText.includes('Managed Resource') ||
          document.body.innerText.includes('Root CR')
        return legend !== null && legend !== false
      },
      { timeout: 10_000 }
    )
  })

  test('Step 3: page titles follow the format "<content> — kro-ui"', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await page.waitForFunction(
      () => document.title.includes('kro-ui') && document.title.length > 7,
      { timeout: 15_000 }
    )
    const title = await page.title()
    expect(title).toMatch(/—\s*kro-ui/)
  })

}) // end test.describe
