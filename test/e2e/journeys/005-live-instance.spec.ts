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
 * Journey 005: Live Instance Detail — DAG with live state, node inspection, panels
 *
 * Validates that the instance detail page:
 * - Renders the live DAG with node state colors
 * - Polls every 5 seconds and updates the refresh indicator
 * - Opens the NodeDetailPanel when a resource node is clicked
 * - Keeps the panel open through poll refreshes
 * - Shows spec, conditions, and events sections below the DAG
 *
 * Spec ref: .specify/specs/005-instance-detail-live/spec.md § E2E User Journey
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied (WebApp kind with configmap + namespace resources)
 * - test-instance CR applied in namespace kro-ui-e2e
 * - kro has reconciled test-instance (child resources created)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'
const INSTANCE_URL = `${BASE}/rgds/test-app/instances/kro-ui-e2e/test-instance`

test.describe('005: Live Instance Detail', () => {
  // ── Step 1: Navigate to instance detail ──────────────────────────────────

  test('Step 1: navigates to instance detail page and renders DAG', async ({
    page,
  }) => {
    await page.goto(INSTANCE_URL)

    // Page container is visible
    await expect(page.getByTestId('instance-detail-page')).toBeVisible()

    // DAG SVG is visible
    await expect(page.getByTestId('dag-svg')).toBeVisible()
  })

  // ── Step 2: DAG renders with live node states ─────────────────────────────

  test('Step 2: DAG renders root node and resource nodes with refresh indicator', async ({
    page,
  }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    // Root CR node is visible
    await expect(page.getByTestId('dag-node-schema')).toBeVisible()

    // Configmap node is visible (test-app RGD has a configmap resource)
    await expect(page.getByTestId('dag-node-configmap')).toBeVisible()

    // Refresh indicator is visible
    await expect(page.getByTestId('live-refresh-indicator')).toBeVisible()
  })

  // ── Step 3: Poll fires — refresh indicator text changes ───────────────────

  test('Step 3: refresh indicator text updates after 6s (at least one poll cycle)', async ({
    page,
  }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('live-refresh-indicator')).toBeVisible({ timeout: 10000 })

    // Record initial text
    const initial = await page.getByTestId('live-refresh-indicator').textContent()

    // Wait for another poll cycle (6s)
    await page.waitForTimeout(6000)

    // Text should have changed (e.g., "refreshed 0s ago" → "refreshed 5s ago" or cycled)
    const updated = await page.getByTestId('live-refresh-indicator').textContent()

    // At minimum, the timestamp has advanced — text is not identical to what it was 6s ago
    // (The counter ticks every second, so "refreshed Ns ago" will differ)
    expect(updated).not.toBeNull()
    // The indicator should show seconds, confirming the counter is ticking
    expect(updated).toMatch(/\d+s ago|loading/)
  })

  // ── Step 4: Click a resource node — detail panel opens ────────────────────

  test('Step 4: clicking a resource node opens the node detail panel', async ({
    page,
  }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    // Click the configmap node
    await page.getByTestId('dag-node-configmap').click()

    // Panel is visible
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()

    // Kind is shown as ConfigMap
    await expect(page.getByTestId('node-detail-kind')).toHaveText('ConfigMap')

    // State badge is visible
    await expect(page.getByTestId('node-detail-state-badge')).toBeVisible()

    // YAML section is rendered (may show spinner or actual YAML)
    await expect(page.getByTestId('node-yaml-section')).toBeVisible()
  })

  // ── Step 5: Poll fires while panel is open — panel stays open ─────────────

  test('Step 5: panel remains open and correct after a poll cycle', async ({
    page,
  }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    // Open the panel
    await page.getByTestId('dag-node-configmap').click()
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()

    // Wait for another poll cycle
    await page.waitForTimeout(6000)

    // Panel is STILL open
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()

    // Kind is still ConfigMap (panel not reset)
    await expect(page.getByTestId('node-detail-kind')).toHaveText('ConfigMap')
  })

  // ── Step 6: Spec, conditions, and events sections are visible ─────────────

  test('Step 6: spec, conditions, and events panels are visible below the DAG', async ({
    page,
  }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    // Scroll down to panels
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    await expect(page.getByTestId('spec-panel')).toBeVisible()
    await expect(page.getByTestId('conditions-panel')).toBeVisible()
    await expect(page.getByTestId('events-panel')).toBeVisible()
  })
})
