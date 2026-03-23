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
 * Journey 010: Collection Node Annotation — forEach expression and cardinality badge
 *
 * Spec ref: .specify/specs/021-collection-node-cardinality/spec.md
 *
 * Cluster pre-conditions:
 * - test-collection RGD applied (RegionalDeployment, regionConfig forEach resource)
 * - test-collection-instance CR applied in kro-ui-e2e namespace
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'
const RGD_URL = `${BASE}/rgds/test-collection`
const INSTANCE_URL = `${BASE}/rgds/test-collection/instances/kro-ui-e2e/test-collection-instance`
const DAG_TIMEOUT = 15000

test.describe('010: Collection Node Annotation', () => {
  test('Step 1: static RGD detail DAG shows forEach annotation on collection node', async ({ page }) => {
    await page.goto(RGD_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
    await expect(page.getByTestId('dag-node-regionConfig')).toBeVisible()
    const annotation = page.getByTestId('dag-node-foreach-regionConfig')
    await expect(annotation).toBeVisible()
    // forEach: [{region: "${schema.spec.regions}"}] → "region: ${schema.spec.regions}"
    await expect(annotation).toContainText('region')
  })

  test('Step 2: forEach annotation absent on non-collection (root) nodes', async ({ page }) => {
    await page.goto(RGD_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
    await expect(page.getByTestId('dag-node-foreach-schema')).not.toBeVisible()
  })

  test('Step 3: live instance detail DAG shows forEach annotation on collection node', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
    await expect(page.getByTestId('dag-node-regionConfig')).toBeVisible()
    const annotation = page.getByTestId('dag-node-foreach-regionConfig')
    await expect(annotation).toBeVisible()
    await expect(annotation).toContainText('region')
  })

  test('Step 4: cardinality badge appears on live DAG collection node', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
    const badge = page.getByTestId('collection-badge')
    await expect(badge).toBeVisible({ timeout: 30000 })
    const badgeText = await badge.textContent()
    expect(badgeText).toMatch(/^\d+\/\d+$/)
  })
})
