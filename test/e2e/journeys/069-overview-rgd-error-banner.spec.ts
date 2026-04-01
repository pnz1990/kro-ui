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
 * Journey 069: Overview RGD compile-error banner with error-only filter
 *
 * Spec: .specify/specs/069-overview-rgd-error-banner/spec.md  (PR #356)
 *
 * NOTE (spec 062): The `rgd-error-banner` component and the clickable error
 * filter on the Overview were removed as part of the SRE dashboard rewrite.
 * RGD compile errors are now shown in the W-3 "RGD Compile Errors" widget
 * on the Overview dashboard.
 *
 * Tests updated to use W-3 widget (data-testid="widget-rgd-errors").
 * The filter-on-click behavior is not replicated in W-3 — it links directly
 * to individual RGD detail pages.
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 069: Overview RGD compile-error banner', () => {

  // ── A: API confirms error RGDs exist ─────────────────────────────────────────

  test('Step 1: at least one error-state RGD exists in the cluster via API', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/rgds`)
    expect(res.status()).toBe(200)
    const data = await res.json()

    const errorRGDs = data.items?.filter((rgd: { status?: { conditions?: Array<{ type: string; status: string }> } }) =>
      rgd.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'False')
    )
    if (!errorRGDs || errorRGDs.length === 0) {
      test.skip()
      return
    }
    expect(errorRGDs.length).toBeGreaterThan(0)
  })

  // ── B: W-3 widget shows error RGDs ───────────────────────────────────────────

  test('Step 2: error banner is visible on Overview after load', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/rgds`)
    const data = await res.json()
    const hasErrors = data.items?.some((rgd: { status?: { conditions?: Array<{ type: string; status: string }> } }) =>
      rgd.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'False')
    )
    if (!hasErrors) { test.skip(); return }

    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-rgd-errors"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    // W-3 must be visible and NOT show the clean state
    const w3 = page.locator('[data-testid="widget-rgd-errors"]')
    await expect(w3).toBeVisible()
    // The clean state text is "✓ All N RGDs compile cleanly" — with errors it should not show
    const w3Text = await w3.textContent()
    const hasErrorRows = w3Text && !w3Text.includes('compile cleanly')
    expect(hasErrorRows).toBeTruthy()
  })

  test('Step 3: banner text contains a number and "RGD"', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/rgds`)
    const data = await res.json()
    const hasErrors = data.items?.some((rgd: { status?: { conditions?: Array<{ type: string; status: string }> } }) =>
      rgd.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'False')
    )
    if (!hasErrors) { test.skip(); return }

    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-rgd-errors"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    // W-3 error list rows contain RGD names (they link to /rgds/{name})
    const errorRows = page.locator('[data-testid="widget-rgd-errors"] .home__rgd-error-row')
    const rowCount = await errorRows.count()
    expect(rowCount).toBeGreaterThan(0)
  })

  // ── C+D: Links navigate to RGD detail ────────────────────────────────────────

  test('Step 4: clicking error banner hides ready-state RGDs from the grid', async ({ page }) => {
    // NOTE: The filter behavior was removed. W-3 links to individual RGD detail pages.
    // Verify that clicking an error row navigates to the RGD detail page.
    const res = await page.request.get(`${BASE}/api/v1/rgds`)
    const data = await res.json()
    const hasErrors = data.items?.some((rgd: { status?: { conditions?: Array<{ type: string; status: string }> } }) =>
      rgd.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'False')
    )
    if (!hasErrors) { test.skip(); return }

    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-rgd-errors"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    const firstErrorRow = page.locator('[data-testid="widget-rgd-errors"] .home__rgd-error-row').first()
    if (await firstErrorRow.count() > 0) {
      const href = await firstErrorRow.getAttribute('href')
      expect(href).toMatch(/\/rgds\//)
    }
  })

  test('Step 5: clicking error banner again restores all RGDs to the grid', async ({ page }) => {
    // NOTE: Grid filter removed. Verify W-3 widget has no coercion artifacts.
    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-rgd-errors"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    const w3Text = await page.locator('[data-testid="widget-rgd-errors"]').textContent()
    expect(w3Text).not.toContain('undefined')
    expect(w3Text).not.toContain('[object')
  })
})
