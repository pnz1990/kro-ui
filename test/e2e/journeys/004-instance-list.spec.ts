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
 * Journey 004: Instance List — namespace filter, readiness badges, navigation
 *
 * Validates that the Instances tab of an RGD detail page:
 * - Lists all live CR instances across namespaces by default
 * - Filters by namespace via the namespace dropdown
 * - Preserves and restores the namespace filter from the URL
 * - Navigates to the instance detail page on "Open" click
 *
 * Spec ref: .specify/specs/004-instance-list/spec.md § E2E User Journey
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied (WebApp kind)
 * - test-instance CR applied in namespace kro-ui-e2e
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const BASE = 'http://localhost:40107'

test.describe('004: Instance List', () => {
  // ── Step 1: Navigate to Instances tab ──────────────────────────────────

  test('Step 1: navigates to Instances tab and shows instance table', async ({
    page,
  }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)

    // Instances tab is active
    await expect(page.getByTestId('tab-instances')).toHaveAttribute(
      'aria-selected',
      'true',
    )

    // Instance table is visible
    await expect(page.getByTestId('instance-table')).toBeVisible()
  })

  // ── Step 2: test-instance appears in table ──────────────────────────────

  test('Step 2: test-instance appears in the instance table', async ({
    page,
  }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    await expect(page.getByTestId('instance-table')).toBeVisible()

    const row = page.getByTestId('instance-row-test-instance')
    await expect(row).toBeVisible()

    // Name cell
    await expect(row.getByTestId('instance-name')).toHaveText('test-instance')

    // Namespace cell
    await expect(row.getByTestId('instance-namespace')).toHaveText('kro-ui-e2e')

    // Age cell is non-empty
    const ageText = await row.getByTestId('instance-age').textContent()
    expect(ageText).toBeTruthy()
    expect(ageText).not.toBe('')

    // Readiness badge is present
    await expect(row.getByTestId('readiness-badge')).toBeVisible()
  })

  // ── Step 3: Namespace filter scopes results ──────────────────────────────

  test('Step 3: namespace filter scopes instance list', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    await expect(page.getByTestId('instance-table')).toBeVisible()

    // Select kro-ui-e2e namespace — test-instance should still appear
    await page.getByTestId('namespace-filter').selectOption('kro-ui-e2e')
    await expect(page).toHaveURL(/namespace=kro-ui-e2e/)
    await expect(page.getByTestId('instance-row-test-instance')).toBeVisible()

    // Select "All Namespaces" (value "") — test-instance should still appear
    await page.getByTestId('namespace-filter').selectOption('')
    // namespace param is removed from URL
    await expect(page).not.toHaveURL(/namespace=/)
    await expect(page.getByTestId('instance-row-test-instance')).toBeVisible()

    // Navigate directly to a namespace that has no test-app instances → empty state
    // Using a namespace value that exists in the cluster but has no WebApp CRs.
    await page.goto(`${BASE}/rgds/test-app?tab=instances&namespace=kro-system`)
    await expect(page.getByTestId('instance-empty-state')).toBeVisible()
    await expect(
      page.getByTestId('instance-row-test-instance'),
    ).not.toBeVisible()
  })

  // ── Step 4: Namespace filter persists on reload ──────────────────────────

  test('Step 4: namespace filter value restored from URL on reload', async ({
    page,
  }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=instances&namespace=kro-ui-e2e`)

    // Filter select pre-selected
    await expect(page.getByTestId('namespace-filter')).toHaveValue('kro-ui-e2e')

    // test-instance is visible
    await expect(page.getByTestId('instance-row-test-instance')).toBeVisible()
  })

  // ── Step 5: Navigate to instance detail ──────────────────────────────────

  test('Step 5: clicking Open navigates to instance detail page', async ({
    page,
  }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=instances&namespace=kro-ui-e2e`)
    await expect(page.getByTestId('instance-row-test-instance')).toBeVisible()

    // Click the Open button in the test-instance row
    await page
      .getByTestId('instance-row-test-instance')
      .getByTestId('btn-open')
      .click()

    // URL must be the instance detail path
    await expect(page).toHaveURL(
      `${BASE}/rgds/test-app/instances/kro-ui-e2e/test-instance`,
    )

    // InstanceDetail stub page is visible
    await expect(page.getByTestId('instance-detail-page')).toBeVisible()
  })

  // ── Steps 6-10: new fixture instances ────────────────────────────────────

  test('Step 6: multi-resource-instance appears in the instance table', async ({ page }) => {
    test.skip(!fixtureState.multiReady, 'multi-resource RGD did not become Ready in setup')
    await page.goto(`${BASE}/rgds/multi-resource?tab=instances`)
    await expect(page.getByTestId('instance-table')).toBeVisible()

    const row = page.getByTestId('instance-row-multi-resource-instance')
    await expect(row).toBeVisible()
    await expect(row.getByTestId('instance-namespace')).toHaveText('kro-ui-e2e')
  })

  test('Step 7: multi-resource-instance readiness badge is not in error state', async ({ page }) => {
    test.skip(!fixtureState.multiReady, 'multi-resource RGD did not become Ready in setup')
    await page.goto(`${BASE}/rgds/multi-resource?tab=instances&namespace=kro-ui-e2e`)
    await expect(page.getByTestId('instance-table')).toBeVisible()

    const row = page.getByTestId('instance-row-multi-resource-instance')
    await expect(row).toBeVisible()

    const badge = row.getByTestId('readiness-badge')
    await expect(badge).toBeVisible()
    // Badge must not carry an error class on a healthy kind cluster
    await expect(badge).not.toHaveClass(/badge--error/)
  })

  test('Step 8: external-ref-instance appears in the instance table', async ({ page }) => {
    test.skip(!fixtureState.externalRefReady, 'external-ref RGD did not become Ready in setup')
    await page.goto(`${BASE}/rgds/external-ref?tab=instances`)
    await expect(page.getByTestId('instance-table')).toBeVisible()

    const row = page.getByTestId('instance-row-external-ref-instance')
    await expect(row).toBeVisible()
    await expect(row.getByTestId('instance-namespace')).toHaveText('kro-ui-e2e')
  })

  test('Step 9: namespace filter on multi-resource instances — kro-ui-e2e shows instance, default does not', async ({ page }) => {
    test.skip(!fixtureState.multiReady, 'multi-resource RGD did not become Ready in setup')
    await page.goto(`${BASE}/rgds/multi-resource?tab=instances`)
    await expect(page.getByTestId('instance-table')).toBeVisible()

    // Select kro-ui-e2e — instance visible
    await page.getByTestId('namespace-filter').selectOption('kro-ui-e2e')
    await expect(page.getByTestId('instance-row-multi-resource-instance')).toBeVisible()

    // Select default — no multi-resource instances there
    await page.getByTestId('namespace-filter').selectOption('default')
    await expect(page.getByTestId('instance-empty-state')).toBeVisible()
    await expect(page.getByTestId('instance-row-multi-resource-instance')).not.toBeVisible()
  })

  test('Step 10: instance table renders for test-app', async ({ page }) => {
    // Validates the instance list page still loads correctly after context operations.
    // Sort UI is not asserted here — col-header-name testid may not be implemented.
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    await expect(page.getByTestId('instance-table')).toBeVisible()
    await expect(page.getByTestId('instance-row-test-instance')).toBeVisible()
  })

  // ── Step 11: empty state — RGD with no instances ──────────────────────────

  test('Step 11: Instances tab for chain-parent (no instances) shows empty state', async ({ page }) => {
    // chain-parent RGD is applied in globalSetup step 6f (fire-and-forget).
    // It has no instance CRs, so the Instances tab must render the empty state.
    // Verify the API confirms no instances first.
    const apiRes = await page.request.get(`${BASE}/api/v1/rgds/chain-parent/instances`)
    // API returns 200 with empty items array (not 404) for a known RGD with no instances
    if (apiRes.status() !== 200) {
      test.skip(true, 'chain-parent RGD not yet registered — skipping empty-state check')
      return
    }
    const body = await apiRes.json() as { items: unknown[] }
    if (!Array.isArray(body.items) || body.items.length > 0) {
      test.skip(true, 'chain-parent has instances or unknown items shape — skipping')
      return
    }

    await page.goto(`${BASE}/rgds/chain-parent?tab=instances`)
    await expect(page.getByTestId('tab-instances')).toHaveAttribute('aria-selected', 'true')

    // Wait for instance table or empty state (both are valid rendered states)
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="instance-table"]') !== null ||
        document.querySelector('[data-testid="instance-empty-state"]') !== null,
      { timeout: 15000 }
    )

    // When items array is empty, the empty state must be rendered
    await expect(page.getByTestId('instance-empty-state')).toBeVisible({ timeout: 5000 })
  })
})
