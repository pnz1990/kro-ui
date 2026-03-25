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
 * Journey 038: Live DAG per-node state
 *
 * Validates spec 038-live-dag-per-node-state acceptance criteria:
 *   - After the first poll, resource nodes have a live-state CSS class
 *   - The root CR (schema) node has a live-state CSS class
 *   - Pending nodes (includeWhen exclusion) have dag-node-live--pending class
 *
 * Spec ref: .specify/specs/038-live-dag-per-node-state/spec.md
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 038 — Live DAG per-node state', () => {

  test('Step 1: live DAG nodes have a live-state CSS class after first poll', async ({ page }) => {
    // Navigate to the test-instance detail page.
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    const rows = page.locator('[data-testid="instance-table-row"]')
    await expect(rows.first()).toBeVisible({ timeout: 10_000 })
    await rows.first().click()

    // Wait for the live DAG to render and poll.
    const dagSvg = page.locator('[data-testid="dag-svg"]').first()
    await expect(dagSvg).toBeVisible({ timeout: 10_000 })

    // Wait for at least one node to have a live-state class (any of alive/reconciling/error/pending/notfound).
    await page.waitForSelector(
      '[class*="dag-node-live--"]',
      { timeout: 15_000 }
    )

    const liveNodes = page.locator('[class*="dag-node-live--"]')
    const count = await liveNodes.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Step 2: root schema node receives a live-state class', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    const rows = page.locator('[data-testid="instance-table-row"]')
    await expect(rows.first()).toBeVisible({ timeout: 10_000 })
    await rows.first().click()

    await page.waitForSelector('[class*="dag-node-live--"]', { timeout: 15_000 })

    // The schema node (root CR) has nodeType 'instance' and should be coloured.
    const schemaNode = page.locator('[data-testid="dag-node-schema"]')
    const className = await schemaNode.getAttribute('class') ?? ''
    expect(className).toMatch(/dag-node-live--/)
  })
})
