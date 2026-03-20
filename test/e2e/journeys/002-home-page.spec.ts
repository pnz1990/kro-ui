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
 * Journey 002: Home Page — RGD card grid and navigation
 *
 * Validates that the operator can open the dashboard, see the test-app RGD
 * card, and navigate to both the Graph view and Instances tab.
 *
 * Spec ref: .specify/specs/002-rgd-list-home/spec.md § E2E User Journey
 */

import { test, expect } from '@playwright/test'

test.describe('Journey 002 — Home page RGD list and navigation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the cards to load (skeleton → real content)
    await page.waitForSelector('[data-testid="rgd-card-test-app"]', { timeout: 10_000 })
  })

  test('Step 1: Page title and top bar context name are visible', async ({ page }) => {
    await expect(page).toHaveTitle(/kro-ui/i)
    const contextName = page.getByTestId('context-name')
    await expect(contextName).toBeVisible()
    // The kind context name contains "kro-ui-e2e"
    await expect(contextName).toContainText('kro-ui-e2e')
  })

  test('Step 2: test-app RGD card renders with correct content', async ({ page }) => {
    const card = page.getByTestId('rgd-card-test-app')
    await expect(card).toBeVisible()

    await expect(card.getByTestId('rgd-name')).toHaveText('test-app')
    await expect(card.getByTestId('rgd-kind')).toHaveText('WebApp')

    // Status dot must be visible and NOT have the error class
    const dot = card.getByTestId('status-dot')
    await expect(dot).toBeVisible()
    const dotClass = await dot.getAttribute('class') ?? ''
    expect(dotClass).not.toContain('error')
  })

  test('Step 3: "Graph" button navigates to /rgds/test-app without full reload', async ({ page }) => {
    const navPromise = page.waitForURL('/rgds/test-app', { waitUntil: 'load' })
    await page.getByTestId('rgd-card-test-app').getByTestId('btn-graph').click()
    await navPromise

    expect(page.url()).toContain('/rgds/test-app')
    // DAG should be present on the RGD detail page
    await expect(page.getByTestId('dag-svg')).toBeVisible()
  })

  test('Step 4: Browser back returns to home; "Instances" button navigates to instances tab', async ({ page }) => {
    // Navigate to graph first
    await page.getByTestId('rgd-card-test-app').getByTestId('btn-graph').click()
    await page.waitForURL('/rgds/test-app')

    // Go back
    await page.goBack()
    await page.waitForURL('/')
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible()

    // Click Instances
    await page.getByTestId('rgd-card-test-app').getByTestId('btn-instances').click()
    await page.waitForURL(/\/rgds\/test-app\?tab=instances/)
    await expect(page.getByTestId('instance-table')).toBeVisible()
  })

})
