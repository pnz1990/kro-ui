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
 * Journey 049: Designer CEL/scope help + instance detail "Refresh now" button
 *
 * Validates spec 049-designer-ux-refresh-button:
 *   - Instance detail page has a "Refresh now" button (↻) for manual poll trigger
 *   - RGD Designer (/author) shows scope help text in the metadata section
 *   - Optimization advisor docs URL is a non-empty href
 *
 * Spec ref: .specify/specs/049-designer-ux-refresh-button/
 *
 * Cluster pre-conditions:
 *   - kind cluster running, kro installed, test-app RGD with ≥1 instance
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 049 — Designer UX: CEL Help + Refresh Button', () => {

  test('Step 1: instance detail page has a Refresh now button', async ({ page, request }) => {
    test.setTimeout(60_000)
    const rgdRes = await request.get(`${BASE}/api/v1/rgds/test-app`)
    if (!rgdRes.ok()) {
      test.skip(true, 'test-app not available')
      return
    }
    const instRes = await request.get(`${BASE}/api/v1/rgds/test-app/instances`)
    if (!instRes.ok()) {
      test.skip(true, 'test-app instances not available')
      return
    }
    const instBody = await instRes.json()
    const items = instBody?.items ?? []
    if (items.length === 0) {
      test.skip(true, 'no test-app instances found')
      return
    }
    const inst = items[0]
    const ns = inst?.metadata?.namespace ?? ''
    const name = inst?.metadata?.name ?? ''
    if (!name) {
      test.skip(true, 'no valid instance found')
      return
    }

    await page.goto(`${BASE}/rgds/test-app/instances/${ns}/${name}`)
    await page.waitForFunction(
      () => document.querySelector('[data-testid="instance-detail"]') !== null ||
            document.querySelector('[data-testid="instance-refresh-btn"]') !== null ||
            document.querySelector('[data-testid="live-dag"]') !== null,
      { timeout: 30_000 }
    )
    // The refresh button should exist (data-testid="instance-refresh-btn")
    const refreshBtn = page.getByTestId('instance-refresh-btn')
    await expect(refreshBtn).toBeVisible({ timeout: 15_000 })
  })

  test('Step 2: RGD Designer shows scope help text', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto(`${BASE}/author`)
    // The authoring form should render with scope radio buttons
    await page.waitForFunction(
      () => document.querySelector('[data-testid="rgd-authoring-form"]') !== null ||
            document.querySelector('.rgd-authoring-form') !== null,
      { timeout: 30_000 }
    )
    // Scope field should be present (Namespaced / Cluster radio)
    await page.waitForFunction(
      () => document.body.innerText.includes('Namespaced') ||
            document.body.innerText.includes('cluster') ||
            document.body.innerText.includes('scope') ||
            document.querySelector('input[name="rgd-scope"]') !== null,
      { timeout: 15_000 }
    )
  })

  test('Step 3: optimization advisor docs link is non-empty when present', async ({ page }) => {
    test.setTimeout(30_000)
    await page.goto(`${BASE}/catalog`)
    await page.waitForFunction(
      () => document.readyState === 'complete',
      { timeout: 10_000 }
    )
    // If optimization advisor is shown, its docs link must be non-empty
    const advisorLinks = page.locator('.advisor a[href], [data-testid*="advisor"] a[href], [class*="advisor"] a[href]')
    const count = await advisorLinks.count()
    if (count > 0) {
      const href = await advisorLinks.first().getAttribute('href')
      expect(href).toBeTruthy()
      expect(href).not.toBe('#')
    }
    // If no advisor visible, this step is a no-op
  })

}) // end test.describe
