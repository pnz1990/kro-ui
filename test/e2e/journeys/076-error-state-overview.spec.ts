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
 * Journey 076: Error state — Overview page
 *
 * Mocks /api/v1/instances and /api/v1/rgds returning 500 to verify that
 * the Overview page shows a non-empty error state.
 *
 * Design ref: docs/design/27-stage3-kro-tracking.md §27.6
 * Spec: .specify/specs/issue-531/spec.md
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 076: Overview error state', () => {
  test('Overview shows error state when API returns 500', async ({ page }) => {
    // Mock /api/v1/instances to return 500
    await page.route('**/api/v1/instances*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal server error' }),
      }),
    )

    // Mock /api/v1/rgds to return 500
    await page.route('**/api/v1/rgds*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal server error' }),
      }),
    )

    await page.goto(BASE)

    // Wait for error state to appear
    await page.waitForFunction(
      () =>
        document.querySelector('.home__error[role="alert"]') !== null ||
        document.querySelector('[role="alert"]') !== null,
      { timeout: 10000 },
    )

    await expect(page.locator('.home__error[role="alert"], [role="alert"]').first()).toBeVisible()

    // Error message must be non-empty
    const errorText = await page.locator('.home__error[role="alert"]').textContent().catch(() => '')
    const alertText = await page.locator('[role="alert"]').first().textContent().catch(() => '')
    const text = errorText || alertText || ''
    expect(text.trim().length).toBeGreaterThan(0)
  })
})
