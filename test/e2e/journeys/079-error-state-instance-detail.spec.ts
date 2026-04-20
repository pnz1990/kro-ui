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
 * Journey 079: Error state — Instance detail page
 *
 * Mocks /api/v1/instances/kro-ui-e2e/test-instance returning 500 to verify
 * that the Instance detail page shows a non-empty error state.
 *
 * Design ref: docs/design/27-stage3-kro-tracking.md §27.6
 * Spec: .specify/specs/issue-531/spec.md
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

const INSTANCE_URL = `${BASE}/rgds/test-app/instances/kro-ui-e2e/test-instance`

test.describe('Journey 079: Instance detail error state', () => {
  test('Instance detail shows error state when RGD API returns 500', async ({ page }) => {
    test.skip(!fixtureState.testAppReady, 'test-app RGD not Ready — skipping instance detail error state test')

    // Mock /api/v1/rgds/test-app (the RGD fetch used by InstanceDetail) to return 500
    await page.route('**/api/v1/rgds/test-app', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal server error' }),
      }),
    )

    await page.goto(INSTANCE_URL)

    // Wait for error state to appear
    await page.waitForFunction(
      () => document.querySelector('.instance-detail-error[role="alert"]') !== null,
      { timeout: 10000 },
    )

    const errorEl = page.locator('.instance-detail-error[role="alert"]')
    await expect(errorEl).toBeVisible()

    // Error message must be non-empty
    const text = await errorEl.textContent().catch(() => '')
    expect((text ?? '').trim().length).toBeGreaterThan(0)
  })
})
