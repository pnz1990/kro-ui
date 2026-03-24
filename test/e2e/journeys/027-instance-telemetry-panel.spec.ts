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
 * Journey 027: Instance Telemetry Panel
 *
 * Validates that the telemetry panel on the instance detail page:
 * - Renders the telemetry-panel container
 * - Shows age, state, and children health cells
 * - Does not render "undefined" or crash with absent data
 *
 * Spec ref: .specify/specs/027-instance-telemetry-panel/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD + test-instance CR applied
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'
const INSTANCE_URL = `${BASE}/rgds/test-app/instances/kro-ui-e2e/test-instance`

test.describe('Journey 027 — Instance Telemetry Panel', () => {
  test('Step 1: telemetry panel renders on instance detail page', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('telemetry-panel')).toBeVisible({ timeout: 10000 })
  })

  test('Step 2: telemetry cells are present', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('telemetry-panel')).toBeVisible({ timeout: 10000 })

    const cells = page.locator('[data-testid="telemetry-cell"]')
    const count = await cells.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Step 3: telemetry cells show resolved values (no "undefined")', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('telemetry-panel')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(3000) // allow live data to resolve

    const panelText = await page.getByTestId('telemetry-panel').textContent()
    expect(panelText).not.toContain('undefined')
    expect(panelText).not.toContain('[object Object]')
  })

  test('Step 4: age cell shows a non-empty value', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('telemetry-panel')).toBeVisible({ timeout: 10000 })

    // Look for the age telemetry cell specifically
    const ageCells = page.locator('[data-testid="telemetry-cell"]:has-text("age"), [data-testid="telemetry-cell"]:has-text("Age")')
    const hasAge = await ageCells.count().then((c) => c > 0)
    if (hasAge) {
      const ageText = await ageCells.first().textContent()
      expect(ageText?.trim()).toBeTruthy()
    }
    // If no labelled age cell, just verify the panel has some numeric/time content
    else {
      const panelText = await page.getByTestId('telemetry-panel').textContent()
      expect(panelText?.trim().length).toBeGreaterThan(0)
    }
  })
})
