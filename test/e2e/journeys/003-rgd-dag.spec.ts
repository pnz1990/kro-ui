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
import { fixtureState } from '../fixture-state'

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
    await expect(page.getByTestId('dag-node-schema')).toBeVisible()

    // Resource nodes
    await expect(page.getByTestId('dag-node-appNamespace')).toBeVisible()
    await expect(page.getByTestId('dag-node-appConfig')).toBeVisible()
    await expect(page.getByTestId('dag-node-appStatus')).toBeVisible()

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

    const conditionalNode = page.getByTestId('dag-node-appConfig')
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

    // Click the appStatus node (a ConfigMap NodeTypeResource)
    await page.getByTestId('dag-node-appStatus').click()

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
    await page.getByTestId('dag-node-appStatus').click()
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

  // ── Steps 8-10: multi-resource RGD (5-node DAG with HPA and edge) ────────

  test('Step 8: multi-resource DAG renders all 5 nodes', async ({ page }) => {
    await page.goto(`${BASE}/rgds/multi-resource`)
    await expect(page.getByTestId('dag-svg')).toBeVisible()

    // schema (root) + appConfig + appService + appDeployment + appAutoscaler = 5
    const nodes = page.locator('[data-testid^="dag-node-"]')
    await expect(nodes).toHaveCount(5)
    await expect(page.getByTestId('dag-node-appAutoscaler')).toBeVisible()
  })

  test('Step 9: multi-resource DAG has at least one dependency edge', async ({ page }) => {
    test.skip(!fixtureState.multiReady, 'multi-resource RGD not Ready')
    await page.goto(`${BASE}/rgds/multi-resource`)
    await expect(page.getByTestId('dag-svg')).toBeVisible()

    // Edges use the dag-edge CSS class on SVG path/line elements
    const edges = page.locator('[class*="dag-edge"]')
    const edgeCount = await edges.count()
    expect(edgeCount).toBeGreaterThan(0)
  })

  test('Step 10: clicking appAutoscaler node shows HorizontalPodAutoscaler kind', async ({ page }) => {
    await page.goto(`${BASE}/rgds/multi-resource`)
    await expect(page.getByTestId('dag-svg')).toBeVisible()

    await page.getByTestId('dag-node-appAutoscaler').click()
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()
    await expect(page.getByTestId('node-detail-kind')).toHaveText('HorizontalPodAutoscaler')
  })

  // ── Steps 11-13: external-ref RGD (NodeTypeExternal) ─────────────────────

  test('Step 11: external-ref DAG contains a NodeTypeExternal node', async ({ page }) => {
    await page.goto(`${BASE}/rgds/external-ref`)
    await expect(page.getByTestId('dag-svg')).toBeVisible()

    // Node class follows the pattern dag-node--{nodeType}
    const externalNode = page.locator('[class*="dag-node--external"]')
    await expect(externalNode).toBeVisible()
  })

  test('Step 12: clicking the externalRef node shows External ref type badge', async ({ page }) => {
    await page.goto(`${BASE}/rgds/external-ref`)
    await expect(page.getByTestId('dag-svg')).toBeVisible()

    await page.getByTestId('dag-node-inputConfig').click()
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()

    // Type badge class: node-type-badge--external
    const typeBadge = page.locator('[class*="node-type-badge--external"]')
    await expect(typeBadge).toBeVisible()
  })

  test('Step 13: external-ref YAML tab contains orValue CEL expression', async ({ page }) => {
    await page.goto(`${BASE}/rgds/external-ref?tab=yaml`)
    await expect(page.getByTestId('kro-code-block')).toBeVisible()

    // orValue is part of the optional-chaining CEL expression in external-ref-rgd.yaml
    const celSpans = page.locator('[data-testid="kro-code-block"] span.token-cel-expression')
    const texts = await celSpans.allTextContents()
    const hasOrValue = texts.some(t => t.includes('orValue'))
    expect(hasOrValue).toBe(true)
  })

  // ── Steps 14-15: test-collection RGD (NodeTypeCollection) ────────────────

  test('Step 14: test-collection DAG contains a NodeTypeCollection node', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-collection`)
    await expect(page.getByTestId('dag-svg')).toBeVisible()

    // Node class follows the pattern dag-node--{nodeType}
    const collectionNode = page.locator('[class*="dag-node--collection"]')
    await expect(collectionNode).toBeVisible()
  })

  test('Step 15: clicking the collection node shows collection type badge', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-collection`)
    await expect(page.getByTestId('dag-svg')).toBeVisible()

    await page.getByTestId('dag-node-regionConfig').click()
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()

    // Type badge class: node-type-badge--collection
    const typeBadge = page.locator('[class*="node-type-badge--collection"]')
    await expect(typeBadge).toBeVisible()
  })

  // ── Step 16: error state — non-existent RGD ───────────────────────────────

  test('Step 16: navigating to a non-existent RGD shows the error state (not a blank page)', async ({ page }) => {
    // The API returns 404 for an unknown RGD name; the page must render an
    // informative error element, never a blank/crash screen.
    // Use `page.request.get()` to verify the API first (SPA always returns 200
    // on page navigation — cannot rely on HTTP status from page.goto).
    const apiRes = await page.request.get(`${BASE}/api/v1/rgds/does-not-exist-rgd-xyz`)
    expect(apiRes.status()).toBe(404)

    await page.goto(`${BASE}/rgds/does-not-exist-rgd-xyz`)
    await expect(page.getByTestId('rgd-detail-error')).toBeVisible({ timeout: 15000 })

    // Error element must contain text — not be blank
    const errorText = await page.getByTestId('rgd-detail-error').textContent()
    expect(errorText?.trim().length).toBeGreaterThan(0)
  })
})
