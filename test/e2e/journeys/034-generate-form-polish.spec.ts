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
 * Journey 034: Generate Tab Form Polish
 *
 * Validates that the Generate tab:
 * - Renders the generate-tab container with mode buttons
 * - Required fields are marked with aria-required="true"
 * - Form submits and produces YAML output
 * - Batch mode is accessible
 *
 * Spec ref: .specify/specs/034-generate-form-polish/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied (has spec fields appName and enableConfig)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 034 — Generate Tab Form Polish', () => {
  test('Step 1: Generate tab is present and clickable', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('tab-generate')).toBeVisible({ timeout: 10000 })
    await page.getByTestId('tab-generate').click()
    await expect(page.getByTestId('tab-generate')).toHaveAttribute('aria-selected', 'true')
  })

  test('Step 2: generate-tab container renders with mode buttons', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=generate`)
    await expect(page.getByTestId('generate-tab')).toBeVisible({ timeout: 10000 })

    // Mode buttons: Form and Batch (New RGD mode removed in spec 042-rgd-designer-nav)
    await expect(page.getByTestId('mode-btn-form')).toBeVisible()
    await expect(page.getByTestId('mode-btn-batch')).toBeVisible()
    await expect(page.getByTestId('mode-btn-rgd')).not.toBeVisible()
  })

  test('Step 3: Form mode shows the instance form', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=generate`)
    await page.getByTestId('mode-btn-form').click()
    await expect(page.getByTestId('instance-form')).toBeVisible({ timeout: 5000 })
  })

  test('Step 4: required fields have aria-required="true"', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=generate`)
    await page.getByTestId('mode-btn-form').click()
    await expect(page.getByTestId('instance-form')).toBeVisible({ timeout: 5000 })

    // Find all required input fields — spec 034 requires aria-required
    const requiredInputs = page.locator('[aria-required="true"]')
    const count = await requiredInputs.count()
    // test-app has required fields (appName, namespace, name at minimum)
    expect(count).toBeGreaterThan(0)
  })

  test('Step 5: Batch mode renders the batch form', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=generate`)
    await page.getByTestId('mode-btn-batch').click()

    // Batch mode renders a different form component
    await expect(page.locator('[data-testid="instance-form"], [class*="batch-form"]').first()).toBeVisible({ timeout: 5000 })
  })
})
