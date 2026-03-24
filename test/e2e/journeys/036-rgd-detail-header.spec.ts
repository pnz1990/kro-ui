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
 * Journey 036: RGD Detail Header
 *
 * Validates that the RGD detail page header shows:
 * - The RGD name as the page heading
 * - A kind badge with the schema kind (e.g. "WebApp")
 * - A status dot indicating health
 * - The same header is present across all tabs (Graph, Instances, YAML, etc.)
 *
 * Spec ref: .specify/specs/036-rgd-detail-header/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied (kind: WebApp)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 036 — RGD Detail Header', () => {
  test('Step 1: RGD detail page shows kind badge with "WebApp"', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    // The kind badge must be visible on the detail page header
    const kindBadge = page.locator('[data-testid="rgd-kind-badge"], .rgd-kind-badge, [class*="kind-badge"]')
    await expect(kindBadge).toBeVisible({ timeout: 10000 })
    await expect(kindBadge).toContainText('WebApp')
  })

  test('Step 2: status dot is visible on graph tab', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    // Status dot must be present
    const statusDot = page.getByTestId('status-dot')
    await expect(statusDot).toBeVisible({ timeout: 10000 })
    await expect(statusDot).not.toHaveClass(/status-dot--error/)
  })

  test('Step 3: kind badge persists on Instances tab', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    await expect(page.getByTestId('tab-instances')).toHaveAttribute('aria-selected', 'true')

    const kindBadge = page.locator('[data-testid="rgd-kind-badge"], .rgd-kind-badge, [class*="kind-badge"]')
    await expect(kindBadge).toBeVisible({ timeout: 10000 })
    await expect(kindBadge).toContainText('WebApp')
  })

  test('Step 4: kind badge persists on YAML tab', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=yaml`)
    await expect(page.getByTestId('tab-yaml')).toHaveAttribute('aria-selected', 'true')

    const kindBadge = page.locator('[data-testid="rgd-kind-badge"], .rgd-kind-badge, [class*="kind-badge"]')
    await expect(kindBadge).toBeVisible({ timeout: 10000 })
    await expect(kindBadge).toContainText('WebApp')
  })

  test('Step 5: kind badge does not show "?" for a valid RGD', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    const kindBadge = page.locator('[data-testid="rgd-kind-badge"], .rgd-kind-badge, [class*="kind-badge"]')
    await expect(kindBadge).toBeVisible({ timeout: 10000 })
    const text = await kindBadge.textContent()
    expect(text?.trim()).not.toBe('?')
    expect(text?.trim()).not.toBe('')
  })
})
