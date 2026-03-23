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
 * Steps 1 & 2 test the static RGD detail DAG — these only require the RGD to be
 * present in the cluster (no Ready condition needed, kro-ui reads it as a raw object).
 *
 * Steps 3 & 4 test the live instance DAG — these are skipped in CI because the
 * forEach RGD CRD generation timing is non-deterministic and may exceed the E2E
 * setup budget. They can be run locally with SKIP_KIND_DELETE=true after verifying
 * that the test-collection RGD has reached Ready.
 *
 * Spec ref: .specify/specs/021-collection-node-cardinality/spec.md
 *
 * Cluster pre-conditions:
 * - test-collection RGD applied (RegionalDeployment, regionConfig forEach resource)
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

  // Steps 3 & 4 require the forEach CRD to be Established and an instance to exist.
  // Skipped in CI due to non-deterministic CRD generation timing.
  // Run locally: SKIP_KIND_DELETE=true make test-e2e (after RGD is Ready).
  test.skip('Step 3: live instance detail DAG shows forEach annotation on collection node', async ({ page }) => {
    const INSTANCE_URL = `${BASE}/rgds/test-collection/instances/kro-ui-e2e/test-collection-instance`
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
    await expect(page.getByTestId('dag-node-regionConfig')).toBeVisible()
    const annotation = page.getByTestId('dag-node-foreach-regionConfig')
    await expect(annotation).toBeVisible()
    await expect(annotation).toContainText('region')
  })

  test.skip('Step 4: cardinality badge appears on live DAG collection node', async ({ page }) => {
    const INSTANCE_URL = `${BASE}/rgds/test-collection/instances/kro-ui-e2e/test-collection-instance`
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
    const badge = page.getByTestId('collection-badge')
    await expect(badge).toBeVisible({ timeout: 30000 })
    const badgeText = await badge.textContent()
    expect(badgeText).toMatch(/^\d+\/\d+$/)
  })
})
