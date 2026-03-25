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
 * Journey 037: IA rename — Home page is now "Overview"
 *
 * Validates spec 037-ia-home-catalog-merge acceptance criteria:
 *   - AC-001: nav label reads "Overview"
 *   - AC-002: <h1> reads "Overview"
 *   - AC-003: document.title is "Overview — kro-ui"
 *   - AC-004: Catalog subtitle is present
 *
 * Spec ref: .specify/specs/037-ia-home-catalog-merge/spec.md
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 037 — Overview/Catalog IA rename', () => {

  test('Step 1: top nav link reads "Overview" not "Home"', async ({ page }) => {
    await page.goto(BASE)
    const navLink = page.locator('nav a[href="/"]')
    await expect(navLink).toHaveText('Overview')
  })

  test('Step 2: Overview page <h1> reads "Overview"', async ({ page }) => {
    await page.goto(BASE)
    const h1 = page.locator('h1').first()
    await expect(h1).toHaveText('Overview')
  })

  test('Step 3: document.title is "Overview — kro-ui"', async ({ page }) => {
    await page.goto(BASE)
    await expect(page).toHaveTitle('Overview — kro-ui')
  })

  test('Step 4: Catalog page has a subtitle paragraph', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    // The subtitle must be visible — it is the paragraph directly under the h1.
    const subtitle = page.locator('.catalog__subtitle, p.catalog__subtitle')
    await expect(subtitle).toBeVisible()
    const text = await subtitle.textContent()
    expect(text?.length).toBeGreaterThan(10)
  })

  test('Step 5: breadcrumb on instance detail reads "Overview"', async ({ page }) => {
    // Navigate to the test-app instance detail page.
    // If no instance exists, the breadcrumb check is skipped gracefully.
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    const rows = page.locator('[data-testid="instance-table-row"]')
    const count = await rows.count()
    if (count === 0) {
      test.skip()
      return
    }
    await rows.first().click()
    const breadcrumb = page.locator('.breadcrumb-link').first()
    await expect(breadcrumb).toHaveText('Overview')
  })
})
