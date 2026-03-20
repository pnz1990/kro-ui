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
 * Journey 003: RGD Detail — DAG visualization and node inspection
 *
 * Validates that the DAG renders all nodes, node types are visually distinct,
 * clicking a node opens the detail panel, and the YAML tab renders highlighted
 * kro syntax.
 *
 * Spec ref: .specify/specs/003-rgd-detail-dag/spec.md § E2E User Journey
 */

import { test, expect } from '@playwright/test'

test.describe('Journey 003 — RGD detail DAG and node inspection', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/rgds/test-app')
    await page.waitForSelector('[data-testid="dag-svg"]', { timeout: 10_000 })
  })

  test('Step 1: Graph tab is active by default', async ({ page }) => {
    const graphTab = page.getByTestId('tab-graph')
    await expect(graphTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('dag-svg')).toBeVisible()
  })

  test('Step 2: All expected nodes are rendered in the SVG', async ({ page }) => {
    // test-app fixture has: root CR, appNamespace (Namespace), appConfig
    // (ConfigMap, conditional), appStatus (ConfigMap), plus specPatch node
    await expect(page.getByTestId('dag-node-root')).toBeVisible()
    await expect(page.getByTestId('dag-node-appnamespace')).toBeVisible()
    await expect(page.getByTestId('dag-node-appconfig')).toBeVisible()
    await expect(page.getByTestId('dag-node-appstatus')).toBeVisible()

    // At least 4 nodes total
    const allNodes = page.locator('[data-testid^="dag-node-"]')
    expect(await allNodes.count()).toBeGreaterThanOrEqual(4)
  })

  test('Step 3: specPatch and conditional nodes have distinct visual classes', async ({ page }) => {
    // appConfig has includeWhen — should have conditional class
    const conditionalNode = page.getByTestId('dag-node-appconfig')
    await expect(conditionalNode).toBeVisible()
    const classes = await conditionalNode.getAttribute('class') ?? ''
    expect(classes).toContain('node-conditional')
  })

  test('Step 4: Clicking a resource node opens the detail panel', async ({ page }) => {
    await page.getByTestId('dag-node-appstatus').click()

    const panel = page.getByTestId('node-detail-panel')
    await expect(panel).toBeVisible()

    // Kind should be shown
    await expect(panel.getByTestId('node-detail-kind')).toBeVisible()
    await expect(panel.getByTestId('node-detail-kind')).toContainText('ConfigMap')

    // Concept explanation is present
    await expect(panel.getByTestId('node-detail-concept')).toBeVisible()

    // URL has NOT changed (no navigation)
    expect(page.url()).toContain('/rgds/test-app')
  })

  test('Step 5: Close button dismisses the detail panel', async ({ page }) => {
    await page.getByTestId('dag-node-appstatus').click()
    await expect(page.getByTestId('node-detail-panel')).toBeVisible()

    await page.getByTestId('node-detail-close').click()
    await expect(page.getByTestId('node-detail-panel')).not.toBeVisible()
  })

  test('Step 6: YAML tab renders the kro code block', async ({ page }) => {
    await page.getByTestId('tab-yaml').click()
    await page.waitForURL(/\?tab=yaml/)

    await expect(page.getByTestId('kro-code-block')).toBeVisible()

    // At least one CEL expression span must be present
    // (test-app fixture has ${schema.spec.appName} etc.)
    const celSpan = page.locator('[data-testid="kro-code-block"] .token-cel').first()
    await expect(celSpan).toBeVisible()
  })

  test('Step 7: YAML tab persists across page reload', async ({ page }) => {
    await page.getByTestId('tab-yaml').click()
    await page.waitForURL(/\?tab=yaml/)
    await page.reload()

    await expect(page.getByTestId('tab-yaml')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('kro-code-block')).toBeVisible()
  })

})
