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
 * Journey 082: Designer Cluster Import Panel
 *
 * Validates spec issue-619:
 *   - ClusterImportPanel toggle opens and fetches RGD list from live cluster
 *   - Dropdown populates with at least one RGD (test-app fixture)
 *   - Selecting and loading an RGD replaces the authoring form state
 *   - Panel collapses after successful import
 *
 * Spec ref: .specify/specs/issue-619/spec.md
 *
 * Cluster pre-conditions:
 *   - kind cluster running, kro installed, test-app RGD applied
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 082 — Designer Cluster Import Panel', () => {

  test('Step 1: /author page loads with ClusterImportPanel toggle', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto(`${BASE}/author`)

    // Wait for the authoring form to be present
    await page.waitForFunction(
      () => document.querySelector('[data-testid="rgd-authoring-form"]') !== null ||
            document.querySelector('.rgd-authoring-form') !== null,
      { timeout: 30_000 }
    )

    // The cluster import toggle must be visible
    const toggle = page.locator('[data-testid="cluster-import-toggle"]')
    await expect(toggle).toBeVisible({ timeout: 10_000 })

    // Page title should include Designer or Author
    const title = await page.title()
    expect(title.toLowerCase()).toMatch(/designer|author|kro/)
  })

  test('Step 2: clicking toggle opens panel and fetches RGD list', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto(`${BASE}/author`)

    // Wait for the authoring form
    await page.waitForFunction(
      () => document.querySelector('[data-testid="rgd-authoring-form"]') !== null ||
            document.querySelector('.rgd-authoring-form') !== null,
      { timeout: 30_000 }
    )

    // Click the toggle to open the import panel
    const toggle = page.locator('[data-testid="cluster-import-toggle"]')
    await toggle.click()

    // Wait for either the RGD dropdown or an error state to appear.
    // Use waitForFunction (O3 — no waitForTimeout).
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="cluster-import-select"]') !== null ||
        document.querySelector('[data-testid="cluster-import-list-error"]') !== null ||
        document.querySelector('[data-testid="cluster-import-empty"]') !== null,
      { timeout: 20_000 }
    )

    // The kind cluster always has test-app — assert dropdown is present
    const select = page.locator('[data-testid="cluster-import-select"]')
    await expect(select).toBeVisible({ timeout: 5_000 })
  })

  test('Step 3: dropdown contains at least one RGD option', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto(`${BASE}/author`)

    await page.waitForFunction(
      () => document.querySelector('[data-testid="rgd-authoring-form"]') !== null ||
            document.querySelector('.rgd-authoring-form') !== null,
      { timeout: 30_000 }
    )

    // Open import panel
    const toggle = page.locator('[data-testid="cluster-import-toggle"]')
    await toggle.click()

    // Wait for dropdown
    await page.waitForFunction(
      () => document.querySelector('[data-testid="cluster-import-select"]') !== null,
      { timeout: 20_000 }
    )

    // The select element must have at least one option
    const optionCount = await page.evaluate(() => {
      const sel = document.querySelector('[data-testid="cluster-import-select"]') as HTMLSelectElement | null
      return sel ? sel.options.length : 0
    })
    expect(optionCount).toBeGreaterThan(0)
  })

  test('Step 4: selecting an RGD and clicking Load updates the form', async ({ page }) => {
    test.setTimeout(90_000)
    await page.goto(`${BASE}/author`)

    await page.waitForFunction(
      () => document.querySelector('[data-testid="rgd-authoring-form"]') !== null ||
            document.querySelector('.rgd-authoring-form') !== null,
      { timeout: 30_000 }
    )

    // Capture the initial RGD name field value before import
    const initialName = await page.evaluate(() => {
      const input = document.querySelector('#rgd-name') as HTMLInputElement | null
      return input?.value ?? ''
    })

    // Open import panel and wait for dropdown
    const toggle = page.locator('[data-testid="cluster-import-toggle"]')
    await toggle.click()

    await page.waitForFunction(
      () => document.querySelector('[data-testid="cluster-import-select"]') !== null,
      { timeout: 20_000 }
    )

    // Read the first available RGD name from the dropdown
    const firstRgdName = await page.evaluate(() => {
      const sel = document.querySelector('[data-testid="cluster-import-select"]') as HTMLSelectElement | null
      return sel?.options[0]?.value ?? ''
    })

    // Select the first RGD (it may already be selected — set explicitly)
    const select = page.locator('[data-testid="cluster-import-select"]')
    if (firstRgdName) {
      await select.selectOption(firstRgdName)
    }

    // Click Load
    const loadBtn = page.locator('[data-testid="cluster-import-load"]')
    await expect(loadBtn).toBeEnabled({ timeout: 5_000 })
    await loadBtn.click()

    // Wait for the panel to close (successful import collapses the panel)
    // OR for an error to appear. Use polling — no fixed-ms wait (O3).
    await page.waitForFunction(
      () => {
        const toggle = document.querySelector('[data-testid="cluster-import-toggle"]') as HTMLButtonElement | null
        const panelClosed = toggle ? toggle.getAttribute('aria-expanded') === 'false' : true
        const loadError = document.querySelector('[data-testid="cluster-import-load-error"]') !== null
        return panelClosed || loadError
      },
      { timeout: 30_000 }
    )

    // No load error should have appeared
    const loadError = page.locator('[data-testid="cluster-import-load-error"]')
    const hasLoadError = await loadError.count()
    expect(hasLoadError).toBe(0)

    // The RGD name field must be non-empty after import (O5)
    const nameAfterImport = await page.evaluate(() => {
      const input = document.querySelector('#rgd-name') as HTMLInputElement | null
      return input?.value ?? ''
    })
    expect(nameAfterImport.length).toBeGreaterThan(0)

    // The imported RGD name should differ from or extend the default (it reflects the cluster RGD)
    // When initialName was empty string or default, post-import value is the cluster RGD name
    if (firstRgdName) {
      expect(nameAfterImport).toBe(firstRgdName)
    }
  })

}) // end test.describe
