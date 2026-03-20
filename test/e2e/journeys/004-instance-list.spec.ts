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
 * Journey 004: Instance List — namespace filter and navigation
 *
 * Validates that the operator can find the test instance, filter by namespace,
 * and navigate to the instance detail page.
 *
 * Spec ref: .specify/specs/004-instance-list/spec.md § E2E User Journey
 */

import { test, expect } from '@playwright/test'

const NAMESPACE = 'kro-ui-e2e'

test.describe('Journey 004 — Instance list and namespace filter', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/rgds/test-app?tab=instances')
    await page.waitForSelector('[data-testid="instance-table"]', { timeout: 10_000 })
  })

  test('Step 1: Instances tab is active', async ({ page }) => {
    await expect(page.getByTestId('tab-instances')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('instance-table')).toBeVisible()
  })

  test('Step 2: test-instance row has correct content', async ({ page }) => {
    const row = page.getByTestId('instance-row-test-instance')
    await expect(row).toBeVisible()

    await expect(row.getByTestId('instance-name')).toHaveText('test-instance')
    await expect(row.getByTestId('instance-namespace')).toHaveText(NAMESPACE)

    const age = row.getByTestId('instance-age')
    await expect(age).toBeVisible()
    const ageText = await age.textContent()
    expect(ageText?.trim().length).toBeGreaterThan(0)

    await expect(row.getByTestId('readiness-badge')).toBeVisible()
  })

  test('Step 3: Namespace filter scopes to kro-ui-e2e', async ({ page }) => {
    await page.getByTestId('namespace-filter').selectOption(NAMESPACE)
    await page.waitForURL(new RegExp(`namespace=${NAMESPACE}`))

    await expect(page.getByTestId('instance-row-test-instance')).toBeVisible()
  })

  test('Step 4: Namespace filter with no instances shows empty state', async ({ page }) => {
    // kro-system has kro controllers but no TestApp instances
    await page.getByTestId('namespace-filter').selectOption('kro-system')
    await page.waitForURL(/namespace=kro-system/)

    await expect(page.getByTestId('instance-empty-state')).toBeVisible()
    await expect(page.getByTestId('instance-row-test-instance')).not.toBeVisible()
  })

  test('Step 5: Namespace filter persists on page reload', async ({ page }) => {
    await page.goto(`/rgds/test-app?tab=instances&namespace=${NAMESPACE}`)
    await page.waitForSelector('[data-testid="instance-table"]')

    const filter = page.getByTestId('namespace-filter')
    const selectedValue = await filter.inputValue()
    expect(selectedValue).toBe(NAMESPACE)

    await expect(page.getByTestId('instance-row-test-instance')).toBeVisible()
  })

  test('Step 6: Clicking "Open" navigates to instance detail', async ({ page }) => {
    const row = page.getByTestId('instance-row-test-instance')
    await row.getByTestId('btn-open').click()

    await page.waitForURL(`/rgds/test-app/instances/${NAMESPACE}/test-instance`)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible()
  })

})
