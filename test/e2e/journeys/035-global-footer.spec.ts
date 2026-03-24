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
 * Journey 035: Global Footer
 *
 * Validates that the global footer is present on all main pages and
 * contains the required external links: kro.run, GitHub, and License.
 *
 * Spec ref: .specify/specs/035-global-footer/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 035 — Global Footer', () => {
  test('Step 1: footer is present on the home page', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.locator('footer[role="contentinfo"], .footer')).toBeVisible()
  })

  test('Step 2: footer contains kro.run link', async ({ page }) => {
    await page.goto(BASE)
    const footer = page.locator('footer[role="contentinfo"], .footer')
    const kroLink = footer.locator('a[href="https://kro.run"]')
    await expect(kroLink).toBeVisible()
    await expect(kroLink).toHaveAttribute('target', '_blank')
  })

  test('Step 3: footer contains GitHub link', async ({ page }) => {
    await page.goto(BASE)
    const footer = page.locator('footer[role="contentinfo"], .footer')
    const ghLink = footer.locator('a[href*="github.com/kubernetes-sigs/kro"]')
    await expect(ghLink).toBeVisible()
    await expect(ghLink).toHaveAttribute('target', '_blank')
  })

  test('Step 4: footer contains Apache License link', async ({ page }) => {
    await page.goto(BASE)
    const footer = page.locator('footer[role="contentinfo"], .footer')
    const licenseLink = footer.locator('a[href*="apache.org"]')
    await expect(licenseLink).toBeVisible()
  })

  test('Step 5: footer is present on RGD detail page', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.locator('footer[role="contentinfo"], .footer')).toBeVisible({ timeout: 10000 })
  })

  test('Step 6: footer is present on catalog page', async ({ page }) => {
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('footer[role="contentinfo"], .footer')).toBeVisible({ timeout: 10000 })
  })

  test('Step 7: footer is present on events page', async ({ page }) => {
    await page.goto(`${BASE}/events`)
    await expect(page.locator('footer[role="contentinfo"], .footer')).toBeVisible({ timeout: 10000 })
  })
})
