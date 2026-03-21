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
 * Journey 003: RGD Detail — DAG Visualization
 *
 * Validates that the RGD detail page renders the DAG graph, shows correct
 * node types (including conditional nodes), opens the node detail panel,
 * and switches to the YAML tab with CEL highlighting.
 *
 * Spec ref: .specify/specs/003-rgd-detail-dag/spec.md § E2E User Journey
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied (WebApp kind, 3 NodeTypeResource resources including
 *   one conditional with includeWhen)
 *
 * test-app fixture nodes:
 * - schema (NodeTypeInstance root — WebApp)
 * - appNamespace (NodeTypeResource — Namespace)
 * - appConfig (NodeTypeResource + includeWhen — ConfigMap, conditional)
 * - appStatus (NodeTypeResource — ConfigMap)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('003: RGD Detail — DAG Visualization', () => {
  // ── Step 1: Navigate to RGD detail (Graph tab) ──────────────────────────

  test('Step 1: navigates to RGD detail and shows Graph tab with DAG', async ({
    page,
  }) => {
    await page.goto(`${BASE}/rgds/test-app`)

    // DAG SVG is visible
    await expect(page.getByTestId('dag-svg')).toBeVisible()

    // Graph tab is active
    await expect(page.getByTestId('tab-graph')).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  // ── Step 2: All expected nodes are rendered ──────────────────────────────

  test('Step 2: all expected nodes are rendered in the DAG', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible()

    // Root instance node
    await expect(page.getByTestId('dag-node-root')).toBeVisible()

    // Resource nodes
    await expect(page.getByTestId('dag-node-appnamespace')).toBeVisible()
    await expect(page.getByTestId('dag-node-appconfig')).toBeVisible()
    await expect(page.getByTestId('dag-node-appstatus')).toBeVisible()

    // Exactly 4 nodes total
    const nodes = page.locator('[data-testid^="dag-node-"]')
    await expect(nodes).toHaveCount(4)
  })

  // ── Step 3: Conditional node has dashed border modifier ─────────────────

  test('Step 3: conditional node (appconfig) has node-conditional class', async ({
    page,
  }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible()

    const conditionalNode = page.getByTestId('dag-node-appconfig')
    await expect(conditionalNode).toHaveClass(/node-conditional/)

    // Ensure node-specpatch class does NOT exist anywhere — it is not a kro concept
    const specPatchNode = page.locator('.node-specpatch')
    await expect(specPatchNode).toHaveCount(0)
  })

  // ── Step 4: Click a node → detail panel opens ────────────────────────────

  test('Step 4: clicking a NodeTypeResource node opens the detail panel', async ({
    page,
  }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible()

    // Click the appstatus node (a ConfigMap NodeTypeResource)
    await page.getByTestId('dag-node-appstatus').click()

    // Detail panel appears
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()

    // Kind badge shows ConfigMap
    await expect(page.getByTestId('node-detail-kind')).toHaveText('ConfigMap')

    // Concept explanation is visible
    await expect(page.getByTestId('node-detail-concept')).toBeVisible()

    // URL has not navigated away
    await expect(page).toHaveURL(`${BASE}/rgds/test-app`)
  })

  // ── Step 5: Close panel ───────────────────────────────────────────────────

  test('Step 5: close button hides the detail panel', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible()

    // Open panel
    await page.getByTestId('dag-node-appstatus').click()
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()

    // Close panel
    await page.getByTestId('node-detail-close').click()
    await expect(page.getByTestId('node-detail-panel')).not.toBeVisible()
  })

  // ── Step 6: Switch to YAML tab ────────────────────────────────────────────

  test('Step 6: switching to YAML tab shows highlighted manifest', async ({
    page,
  }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await page.getByTestId('tab-yaml').click()

    // URL reflects tab change
    await expect(page).toHaveURL(`${BASE}/rgds/test-app?tab=yaml`)

    // Code block is visible
    await expect(page.getByTestId('kro-code-block')).toBeVisible()

    // At least one CEL token span is present (CEL highlighting)
    await expect(page.locator('span.token-cel').first()).toBeVisible()
  })

  // ── Step 7: YAML tab persists on reload ──────────────────────────────────

  test('Step 7: YAML tab state persists after page reload', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=yaml`)
    await expect(page.getByTestId('kro-code-block')).toBeVisible()

    // Reload
    await page.reload()

    // YAML tab is still active
    await expect(page.getByTestId('tab-yaml')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByTestId('kro-code-block')).toBeVisible()
  })
})
