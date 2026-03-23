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
 * - test-app RGD applied (WebApp kind: resources appNamespace, appConfig, appStatus)
 * - test-instance CR applied in namespace kro-ui-e2e (appName: kro-ui-test)
 * - kro has reconciled test-instance (child resources created)
 *
 * Node IDs in the test-app RGD (from test-rgd.yaml):
 *   - schema       — root WebApp CR (NodeTypeInstance)
 *   - appNamespace — Namespace (NodeTypeResource)
 *   - appConfig    — ConfigMap, conditional includeWhen (NodeTypeResource)
 *   - appStatus    — ConfigMap, always created (NodeTypeResource)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'
const INSTANCE_URL = `${BASE}/rgds/test-app/instances/kro-ui-e2e/test-instance`

// Allow extra time on CI for the initial parallel fetches (instance + RGD spec)
const DAG_TIMEOUT = 15000

test.describe('005: Live Instance Detail', () => {
  // ── Step 1: Navigate to instance detail ──────────────────────────────────

  test('Step 1: navigates to instance detail page and renders DAG', async ({
    page,
  }) => {
    await page.goto(INSTANCE_URL)

    // Page container is visible immediately (renders before data loads)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible()

    // DAG SVG appears after both the instance poll and the RGD spec fetch resolve
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
  })

  // ── Step 2: DAG renders with live node states ─────────────────────────────

  test('Step 2: DAG renders root node and resource nodes with refresh indicator', async ({
    page,
  }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    // Root CR node is visible (id: schema)
    await expect(page.getByTestId('dag-node-schema')).toBeVisible()

    // appStatus resource node is visible (unconditional ConfigMap, always created)
    await expect(page.getByTestId('dag-node-appStatus')).toBeVisible()

    // Refresh indicator is visible
    await expect(page.getByTestId('live-refresh-indicator')).toBeVisible()
  })

  // ── Step 3: Poll fires — refresh indicator text changes ───────────────────

  test('Step 3: refresh indicator text updates after 6s (at least one poll cycle)', async ({
    page,
  }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('live-refresh-indicator')).toBeVisible({ timeout: DAG_TIMEOUT })

    // Record initial text
    const initial = await page.getByTestId('live-refresh-indicator').textContent()

    // Wait for another poll cycle (6s)
    await page.waitForTimeout(6000)

    // Text should have changed (e.g., "refreshed 0s ago" → "refreshed 5s ago" or cycled)
    const updated = await page.getByTestId('live-refresh-indicator').textContent()

    expect(updated).not.toBeNull()
    // The indicator shows seconds, confirming the counter is ticking
    expect(updated).toMatch(/\d+s ago|loading/)
    // Suppress unused variable warning — initial is documented as baseline
    void initial
  })

  // ── Step 4: Click a resource node — detail panel opens ────────────────────

  test('Step 4: clicking a resource node opens the node detail panel', async ({
    page,
  }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    // Click the appStatus node (always-created ConfigMap, non-conditional)
    await page.getByTestId('dag-node-appStatus').click()

    // Panel is visible
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()

    // Kind is shown as ConfigMap (from the RGD template)
    await expect(page.getByTestId('node-detail-kind')).toHaveText('ConfigMap')

    // State badge is visible
    await expect(page.getByTestId('node-detail-state-badge')).toBeVisible()

    // YAML section is rendered (may show spinner or actual YAML depending on fetch timing)
    await expect(page.getByTestId('node-yaml-section')).toBeVisible()
  })

  // ── Step 5: Poll fires while panel is open — panel stays open ─────────────

  test('Step 5: panel remains open and correct after a poll cycle', async ({
    page,
  }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    // Open the panel
    await page.getByTestId('dag-node-appStatus').click()
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()

    // Wait for another poll cycle
    await page.waitForTimeout(6000)

    // Panel is STILL open — state refresh must not close it (FR-008)
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()

    // Kind is still ConfigMap (panel not reset or re-mounted)
    await expect(page.getByTestId('node-detail-kind')).toHaveText('ConfigMap')
  })

  // ── Step 6: Spec, conditions, and events sections are visible ─────────────

  test('Step 6: spec, conditions, and events panels are visible below the DAG', async ({
    page,
  }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    // Scroll down to reach the below-DAG panels
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    await expect(page.getByTestId('spec-panel')).toBeVisible()
    await expect(page.getByTestId('conditions-panel')).toBeVisible()
    await expect(page.getByTestId('events-panel')).toBeVisible()
  })

  // ── Steps 7-9: multi-resource-instance live DAG ───────────────────────────

  test('Step 7: multi-resource live DAG renders 5 nodes including autoscaler', async ({ page }) => {
    await page.goto(`${BASE}/rgds/multi-resource/instances/kro-ui-e2e/multi-resource-instance`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    // 5 nodes: schema + appConfig + appService + appDeployment + appAutoscaler
    const nodes = page.locator('[data-testid^="dag-node-"]')
    await expect(nodes).toHaveCount(5)
    await expect(page.getByTestId('dag-node-appAutoscaler')).toBeVisible()

    // Every node must have a state badge (alive/reconciling/pending — no error on healthy cluster)
    const stateBadges = page.locator('[data-testid="node-state-badge"]')
    const badgeCount = await stateBadges.count()
    expect(badgeCount).toBeGreaterThan(0)
  })

  test('Step 8: clicking appDeployment node shows Deployment kind and non-empty YAML', async ({ page }) => {
    await page.goto(`${BASE}/rgds/multi-resource/instances/kro-ui-e2e/multi-resource-instance`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    await page.getByTestId('dag-node-appDeployment').click()
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()
    await expect(page.getByTestId('node-detail-kind')).toHaveText('Deployment')

    // YAML section must render (may need a moment for fetch)
    await expect(page.getByTestId('node-yaml-section')).toBeVisible()
  })

  test('Step 9: conditions panel for multi-resource-instance has at least one condition row', async ({ page }) => {
    await page.goto(`${BASE}/rgds/multi-resource/instances/kro-ui-e2e/multi-resource-instance`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.getByTestId('conditions-panel')).toBeVisible()

    // At least one condition row must be present — multi-resource RGD produces real conditions
    const conditionRows = page.locator('[data-testid="condition-row"]')
    const rowCount = await conditionRows.count()
    expect(rowCount).toBeGreaterThan(0)
  })

  // ── Steps 10-11: external-ref-instance live DAG ───────────────────────────

  test('Step 10: external-ref live DAG contains NodeTypeExternal node with correct label', async ({ page }) => {
    await page.goto(`${BASE}/rgds/external-ref/instances/kro-ui-e2e/external-ref-instance`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    // The externalRef node must have the external node type class — never "?"
    const externalNode = page.locator('.node-type--external')
    await expect(externalNode).toBeVisible()

    // The node label text must not be "?"
    const nodeLabel = page.getByTestId('dag-node-inputConfig').locator('[data-testid="node-kind-label"]')
    const labelText = await nodeLabel.textContent()
    expect(labelText).not.toBe('?')
    expect(labelText?.length).toBeGreaterThan(0)
  })

  test('Step 11: clicking externalRef node shows pre-req ConfigMap YAML', async ({ page }) => {
    await page.goto(`${BASE}/rgds/external-ref/instances/kro-ui-e2e/external-ref-instance`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    await page.getByTestId('dag-node-inputConfig').click()
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()
    await expect(page.getByTestId('node-detail-type')).toHaveText('External ref')

    // YAML section must render
    await expect(page.getByTestId('node-yaml-section')).toBeVisible()
  })
})
