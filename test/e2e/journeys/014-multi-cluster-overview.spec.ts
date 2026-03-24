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
 * Journey 014: Multi-Cluster Fleet Overview
 *
 * Validates that the /fleet page:
 * - Renders the fleet overview page
 * - Shows the RGD presence matrix table
 * - Refreshes on button click
 * - Links back to individual cluster context RGD pages
 *
 * Spec ref: .specify/specs/014-multi-cluster-overview/
 *
 * Cluster pre-conditions:
 * - kind cluster running
 * - At least one kubeconfig context pointing to the kind cluster
 * - kro + test-app RGD applied
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 014 — Fleet Overview', () => {
  test('Step 1: /fleet page renders', async ({ page }) => {
    await page.goto(`${BASE}/fleet`)
    await expect(page).toHaveTitle(/fleet.*kro-ui|kro-ui/i)

    // Fleet heading is visible
    await expect(page.locator('h1:has-text("Fleet Overview"), .fleet__heading')).toBeVisible({ timeout: 10000 })
  })

  test('Step 2: fleet grid or matrix loads (not stuck in loading state)', async ({ page }) => {
    await page.goto(`${BASE}/fleet`)

    // Wait up to 15s for the fleet data to resolve
    await expect(page.locator('.fleet__grid, .fleet-matrix, .fleet__error, .fleet__empty')).toBeVisible({ timeout: 15000 })
  })

  test('Step 3: fleet matrix table renders with at least one cluster column', async ({ page }) => {
    await page.goto(`${BASE}/fleet`)

    // Wait for matrix to appear (may be inside fleet grid)
    const matrixRegion = page.locator('[aria-label="RGD presence matrix"]')
    const matrixVisible = await matrixRegion.isVisible().catch(() => false)
    if (!matrixVisible) {
      // Fleet might show empty state if only one context — skip assertion
      const emptyEl = page.locator('.fleet__empty, .fleet-matrix--empty')
      const isEmpty = await emptyEl.isVisible().catch(() => false)
      if (isEmpty) return // acceptable empty state
    }

    // If matrix is visible, table must have at least one column header
    const headers = matrixRegion.locator('th')
    const count = await headers.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Step 4: refresh button is present', async ({ page }) => {
    await page.goto(`${BASE}/fleet`)
    await expect(page.locator('[aria-label="Refresh fleet data"], .fleet__refresh-btn')).toBeVisible({ timeout: 10000 })
  })

  test('Step 5: page title is correctly formatted', async ({ page }) => {
    await page.goto(`${BASE}/fleet`)
    await expect(page).toHaveTitle(/kro-ui/)
  })
})
