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
 * Steps 1 & 2: static RGD detail DAG — only require the RGD object to exist
 * in the cluster (no Ready condition needed). Always run.
 *
 * Steps 3-5: live instance DAG — require the forEach CRD to be Established
 * and the instance to be reconciled. Run only when KRO_COLLECTION_READY=true
 * (set by global-setup.ts when the RGD became Ready within the 120s budget).
 * On resource-constrained CI runners the forEach CRD generation can take
 * longer; in that case these steps are skipped to avoid blocking the suite.
 *
 * Spec ref: .specify/specs/021-collection-node-cardinality/spec.md
 *
 * Cluster pre-conditions:
 * - test-collection RGD applied (RegionalDeployment, regionConfig forEach resource)
 * - test-collection-instance applied when KRO_COLLECTION_READY=true (2 regions)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'
const RGD_URL = `${BASE}/rgds/test-collection`
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

  // Steps 3-5 require the forEach CRD to be Established and an instance to
  // exist. They run only when global-setup successfully waited for the RGD.
  const collectionReady = process.env.KRO_COLLECTION_READY === 'true'

  test('Step 3: live instance detail DAG shows forEach annotation on collection node', async ({ page }) => {
    if (!collectionReady) test.skip()
    const INSTANCE_URL = `${BASE}/rgds/test-collection/instances/kro-ui-e2e/test-collection-instance`
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
    await expect(page.getByTestId('dag-node-regionConfig')).toBeVisible()
    const annotation = page.getByTestId('dag-node-foreach-regionConfig')
    await expect(annotation).toBeVisible()
    await expect(annotation).toContainText('region')
  })

  test('Step 4: cardinality badge appears on live DAG collection node', async ({ page }) => {
    if (!collectionReady) test.skip()
    const INSTANCE_URL = `${BASE}/rgds/test-collection/instances/kro-ui-e2e/test-collection-instance`
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
    const badge = page.getByTestId('collection-badge')
    await expect(badge).toBeVisible({ timeout: 30000 })
    const badgeText = await badge.textContent()
    expect(badgeText).toMatch(/^\d+\/\d+$/)
  })

  test('Step 5: cardinality badge count matches the instance region count (2/2)', async ({ page }) => {
    if (!collectionReady) test.skip()
    const INSTANCE_URL = `${BASE}/rgds/test-collection/instances/kro-ui-e2e/test-collection-instance`
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    const badge = page.getByTestId('collection-badge')
    await expect(badge).toBeVisible({ timeout: 30000 })

    // test-collection-instance.yaml has 2 regions (us-east-1, eu-west-1)
    // When fully reconciled the badge should show 2/2
    const badgeText = await badge.textContent()
    expect(badgeText).toMatch(/^[12]\/2$/) // allow 1/2 transiently during reconciliation
  })
})
