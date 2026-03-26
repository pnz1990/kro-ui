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
 * Journey 043-contagious-include-when: Contagious includeWhen exclusion rendering
 *
 * Validates that when a parent resource has includeWhen=false, kro-ui correctly
 * renders BOTH the parent and its dependent child as conditionally excluded:
 *   - parentDeploy has node-conditional CSS class (includeWhen present)
 *   - childConfig also has node-conditional CSS class (contagious exclusion)
 *   - Neither node uses an error CSS class (excluded ≠ error)
 *
 * Instance spec: enableParent=false — both nodes excluded at rest.
 *
 * Spec ref: .specify/specs/043-upstream-fixture-generator/
 *
 * Cluster pre-conditions:
 *   - upstream-contagious-include-when RGD applied and Ready
 *   - upstream-contagious-include-when instance applied (enableParent: false)
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const BASE = 'http://localhost:40107'
const RGD_URL = `${BASE}/rgds/upstream-contagious-include-when`
const DAG_TIMEOUT = 15000

test.describe('Journey 043-contagious-include-when — Contagious includeWhen rendering', () => {
  test('Step 1: RGD detail DAG renders for contagious-include-when fixture', async ({ page }) => {
    test.skip(!fixtureState.contagiousReady, 'upstream-contagious-include-when RGD not Ready in setup')
    await page.goto(RGD_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
  })

  test('Step 2: parentDeploy node has conditional indicator (includeWhen present)', async ({ page }) => {
    test.skip(!fixtureState.contagiousReady, 'upstream-contagious-include-when RGD not Ready in setup')
    await page.goto(RGD_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
    await expect(page.getByTestId('dag-node-parentDeploy')).toBeVisible()
    const cls = await page.getByTestId('dag-node-parentDeploy').getAttribute('class')
    expect(cls).toMatch(/node-conditional/)
  })

  test('Step 3: childConfig node also has conditional indicator (contagious exclusion)', async ({ page }) => {
    test.skip(!fixtureState.contagiousReady, 'upstream-contagious-include-when RGD not Ready in setup')
    await page.goto(RGD_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
    await expect(page.getByTestId('dag-node-childConfig')).toBeVisible()
    // childConfig depends on parentDeploy — when parent excluded, child should
    // also be rendered with the conditional indicator (contagious exclusion).
    // If this assertion fails it reveals an application gap: kro-ui is not yet
    // marking contagiously-excluded nodes as conditional.
    const cls = await page.getByTestId('dag-node-childConfig').getAttribute('class')
    expect(cls).toMatch(/node-conditional/)
  })

  test('Step 4: neither node renders with an error CSS class (excluded ≠ error)', async ({ page }) => {
    test.skip(!fixtureState.contagiousReady, 'upstream-contagious-include-when RGD not Ready in setup')
    await page.goto(RGD_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    for (const id of ['dag-node-parentDeploy', 'dag-node-childConfig']) {
      const node = page.getByTestId(id)
      if (!await node.isVisible().catch(() => false)) continue
      const cls = await node.getAttribute('class')
      expect(cls).not.toMatch(/dag-node--error|status-error|node-error/)
    }
  })
})
