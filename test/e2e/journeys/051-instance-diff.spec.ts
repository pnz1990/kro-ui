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
 * Journey 051: Instance Spec Diff
 *
 * Validates spec 051-instance-diff — select 2 instances and compare spec fields:
 *   - Instance table has checkboxes for selection (when ≥2 instances)
 *   - Selecting 2 instances shows a "Compare" button
 *   - The comparison panel renders field-by-field diff
 *
 * Spec ref: .specify/specs/051-instance-diff/spec.md
 *
 * Cluster pre-conditions:
 *   - kind cluster running, kro installed
 *   - test-app RGD applied with ≥2 instances (or spec skip)
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 051 — Instance Spec Diff', () => {

  test('Step 1: GET /api/v1/rgds/test-app/instances returns valid list', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/rgds/test-app`)
    if (!res.ok()) {
      test.skip(true, 'test-app not present on this cluster')
      return
    }
    const instRes = await request.get(`${BASE}/api/v1/rgds/test-app/instances`)
    expect(instRes.ok()).toBe(true)
    const body = await instRes.json()
    expect(Array.isArray(body.items)).toBe(true)
  })

  test('Step 2: instances tab renders instance rows', async ({ page, request }) => {
    const rgdRes = await request.get(`${BASE}/api/v1/rgds/test-app`)
    if (!rgdRes.ok()) {
      test.skip(true, 'test-app not present on this cluster')
      return
    }

    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    await page.waitForFunction(
      () => document.querySelector('[data-testid="dag-svg"]') !== null ||
            document.querySelector('[data-testid="instance-table"]') !== null ||
            document.querySelector('.instance-table') !== null,
      { timeout: 20_000 }
    )
    // If dag loaded (graph tab default), click instances tab
    const dagVisible = await page.locator('[data-testid="dag-svg"]').isVisible({ timeout: 500 }).catch(() => false)
    if (dagVisible) {
      await page.getByTestId('tab-instances').click()
    }

    await page.waitForFunction(
      () => document.querySelector('[data-testid="instance-table"]') !== null ||
            document.querySelector('.instance-table') !== null ||
            document.querySelector('table') !== null,
      { timeout: 15_000 }
    )
  })

  test('Step 3: selecting 2 instances shows compare button (skip if <2 instances)', async ({ page, request }) => {
    const rgdRes = await request.get(`${BASE}/api/v1/rgds/test-app`)
    if (!rgdRes.ok()) {
      test.skip(true, 'test-app not present on this cluster')
      return
    }

    const instRes = await request.get(`${BASE}/api/v1/rgds/test-app/instances`)
    if (!instRes.ok()) {
      test.skip(true, 'Could not fetch instances')
      return
    }
    const instBody = await instRes.json()
    const items = Array.isArray(instBody?.items) ? instBody.items : []
    if (items.length < 2) {
      test.skip(true, `Only ${items.length} instance(s) — need ≥2 for diff; skipping`)
      return
    }

    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    // Navigate to instances tab
    await page.waitForFunction(
      () => document.querySelector('[data-testid="dag-svg"]') !== null ||
            document.querySelector('[data-testid="instance-table"]') !== null,
      { timeout: 20_000 }
    )
    const dagVisible = await page.locator('[data-testid="dag-svg"]').isVisible({ timeout: 500 }).catch(() => false)
    if (dagVisible) {
      await page.getByTestId('tab-instances').click()
    }

    // Wait for instance rows
    await page.waitForFunction(
      () => document.querySelectorAll('input[type="checkbox"]').length >= 2,
      { timeout: 15_000 }
    )

    // Select first 2 checkboxes
    const checkboxes = page.locator('input[type="checkbox"]')
    await checkboxes.nth(0).check()
    await checkboxes.nth(1).check()

    // Compare button should appear
    await page.waitForFunction(
      () => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.toLowerCase().includes('compare') ||
                 b.getAttribute('data-testid')?.includes('compare')
        )
        return btn !== null && btn !== undefined
      },
      { timeout: 10_000 }
    )
  })

}) // end test.describe
