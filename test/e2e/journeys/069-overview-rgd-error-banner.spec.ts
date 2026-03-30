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
 * Verifies:
 *   A) Error banner appears when broken RGDs exist in the cluster
 *   B) Banner text shows the count of RGDs with compile errors
 *   C) Clicking the banner activates error-only filter (hides ready-state RGDs)
 *   D) Clicking the banner again restores all RGDs
 *
 * Cluster pre-conditions:
 * - kind cluster with at least one RGD that has Ready=False (invalid-cel-rgd,
 *   chain-cycle-a, chain-cycle-b etc. from stress-test-rgds.yaml)
 * - test-app RGD is Ready=True (used as the "healthy" card that disappears)
 * - kro-ui binary running at KRO_UI_BASE_URL
 *
 * Note: the E2E cluster has chain-cycle-a and chain-cycle-b fixtures which
 * reference each other and always fail to compile — they are always Ready=False.
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 069: Overview RGD compile-error banner', () => {

  // ── A: Banner appears when broken RGDs exist ─────────────────────────────────

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

  test('Step 2: error banner is visible on Overview after load', async ({ page }) => {
    // Verify error RGDs exist before navigating
    const res = await page.request.get(`${BASE}/api/v1/rgds`)
    const data = await res.json()
    const hasErrors = data.items?.some((rgd: { status?: { conditions?: Array<{ type: string; status: string }> } }) =>
      rgd.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'False')
    )
    if (!hasErrors) { test.skip(); return }

    await page.goto(BASE)
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible({ timeout: 20000 })

    // Banner should appear
    const banner = page.getByTestId('rgd-error-banner')
    await expect(banner).toBeVisible({ timeout: 10000 })
  })

  test('Step 3: banner text contains a number and "RGD"', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/rgds`)
    const data = await res.json()
    const hasErrors = data.items?.some((rgd: { status?: { conditions?: Array<{ type: string; status: string }> } }) =>
      rgd.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'False')
    )
    if (!hasErrors) { test.skip(); return }

    await page.goto(BASE)
    await page.getByTestId('rgd-card-test-app').waitFor({ timeout: 20000 })

    const banner = page.getByTestId('rgd-error-banner')
    await expect(banner).toBeVisible({ timeout: 10000 })

    const bannerText = await banner.textContent()
    expect(bannerText).toMatch(/\d+\s+RGD/)
  })

  // ── C: Clicking banner activates error-only filter ───────────────────────────

  test('Step 4: clicking error banner hides ready-state RGDs from the grid', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/rgds`)
    const data = await res.json()
    const hasErrors = data.items?.some((rgd: { status?: { conditions?: Array<{ type: string; status: string }> } }) =>
      rgd.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'False')
    )
    if (!hasErrors) { test.skip(); return }

    await page.goto(BASE)
    await page.getByTestId('rgd-card-test-app').waitFor({ timeout: 20000 })

    const banner = page.getByTestId('rgd-error-banner')
    await expect(banner).toBeVisible({ timeout: 10000 })

    // Click the banner button to activate error-only filter
    await banner.locator('button').click()

    // test-app is Ready=True — it should be removed from the grid
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="rgd-card-test-app"]') === null
    }, { timeout: 5000 })

    // At least one error card should still be visible
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('[data-testid^="rgd-card-"]')
      return cards.length > 0
    }, { timeout: 5000 })
  })

  // ── D: Second click restores all RGDs ────────────────────────────────────────

  test('Step 5: clicking error banner again restores all RGDs to the grid', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/rgds`)
    const data = await res.json()
    const hasErrors = data.items?.some((rgd: { status?: { conditions?: Array<{ type: string; status: string }> } }) =>
      rgd.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'False')
    )
    if (!hasErrors) { test.skip(); return }

    await page.goto(BASE)
    await page.getByTestId('rgd-card-test-app').waitFor({ timeout: 20000 })

    const banner = page.getByTestId('rgd-error-banner')
    await expect(banner).toBeVisible({ timeout: 10000 })

    const btn = banner.locator('button')
    // First click — activate filter
    await btn.click()
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="rgd-card-test-app"]') === null
    }, { timeout: 5000 })

    // Second click — restore all
    await btn.click()
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible({ timeout: 5000 })
  })
})
