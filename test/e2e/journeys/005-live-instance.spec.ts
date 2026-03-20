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
 * Journey 005: Live Instance View — DAG, polling, and node YAML inspection
 *
 * Validates that the live instance DAG renders with node states, the 5-second
 * poll fires and updates the refresh indicator, and clicking a node opens the
 * detail panel that survives poll refreshes.
 *
 * Spec ref: .specify/specs/005-instance-detail-live/spec.md § E2E User Journey
 */

import { test, expect } from '@playwright/test'

const NAMESPACE = 'kro-ui-e2e'

test.describe('Journey 005 — Live instance view and polling', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`/rgds/test-app/instances/${NAMESPACE}/test-instance`)
    await page.waitForSelector('[data-testid="instance-detail-page"]', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="dag-svg"]', { timeout: 10_000 })
  })

  test('Step 1: Instance detail page and DAG are visible', async ({ page }) => {
    await expect(page.getByTestId('instance-detail-page')).toBeVisible()
    await expect(page.getByTestId('dag-svg')).toBeVisible()
    await expect(page.getByTestId('dag-node-root')).toBeVisible()
  })

  test('Step 2: Live refresh indicator is visible', async ({ page }) => {
    await expect(page.getByTestId('live-refresh-indicator')).toBeVisible()
  })

  test('Step 3: Poll fires and refresh indicator updates after 6 seconds', async ({ page }) => {
    const indicator = page.getByTestId('live-refresh-indicator')
    const before = await indicator.textContent()

    // Wait for one full poll cycle (5s interval + 1s buffer)
    await page.waitForTimeout(6_000)

    const after = await indicator.textContent()
    // The text should have changed (e.g., "refreshed 1s ago" → "refreshed 6s ago")
    expect(after).not.toBe(before)
  })

  test('Step 4: Clicking a resource node opens the detail panel', async ({ page }) => {
    // appStatus is a ConfigMap — always created by kro during reconciliation
    await page.getByTestId('dag-node-appstatus').click()

    const panel = page.getByTestId('node-detail-panel')
    await expect(panel).toBeVisible()
    await expect(panel.getByTestId('node-detail-kind')).toContainText('ConfigMap')
    await expect(panel.getByTestId('node-detail-state-badge')).toBeVisible()
    await expect(panel.getByTestId('node-yaml-section')).toBeVisible()
  })

  test('Step 5: Detail panel stays open through a poll cycle', async ({ page }) => {
    await page.getByTestId('dag-node-appstatus').click()
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()

    // Wait for another poll cycle
    await page.waitForTimeout(6_000)

    // Panel must still be visible — not closed by the state refresh
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()
    await expect(page.getByTestId('node-detail-kind')).toContainText('ConfigMap')
  })

  test('Step 6: Spec, conditions, and events panels are visible below DAG', async ({ page }) => {
    await expect(page.getByTestId('spec-panel')).toBeVisible()
    await expect(page.getByTestId('conditions-panel')).toBeVisible()
    await expect(page.getByTestId('events-panel')).toBeVisible()
  })

})
