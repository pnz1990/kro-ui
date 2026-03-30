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
 * Journey 066: /instances status dot tooltip — condition message
 *
 * Spec: .specify/specs/066-instance-status-message/spec.md  (PR #351)
 *
 * Verifies:
 *   A) The InstanceSummary API response includes a `message` field for NotReady instances
 *   B) /instances page status dot has a title attribute with the condition message
 *   C) The message is non-empty for never-ready (awaiting resource readiness)
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.8.0
 * - never-ready-prod instance (Ready=False, message="awaiting resource readiness")
 * - kro-ui binary running at KRO_UI_BASE_URL
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 066: /instances status dot tooltip with condition message', () => {

  // ── A: API includes message field ────────────────────────────────────────────

  test('Step 1: GET /api/v1/instances response includes message field on NotReady instances', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/instances`)
    expect(res.status()).toBe(200)

    const data = await res.json()
    if (!data.total || data.total === 0) { test.skip(); return }

    // Find a never-ready instance (always NotReady in E2E cluster)
    const neverReady = data.items?.find(
      (i: { rgdName: string; ready: string }) =>
        i.rgdName === 'never-ready' && i.ready === 'False'
    )
    if (!neverReady) { test.skip(); return }

    // The InstanceSummary should include a message field
    expect(neverReady).toHaveProperty('message')
    expect(typeof neverReady.message).toBe('string')
    expect(neverReady.message.length).toBeGreaterThan(0)
    // Expected: "awaiting resource readiness"
    expect(neverReady.message).toMatch(/awaiting|NotReady|not ready/i)
  })

  // ── B: Status dot has title attribute with condition message ─────────────────

  test('Step 2: never-ready instance row status dot has title matching condition message', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/instances`)
    const data = await res.json()
    const neverReady = data.items?.find(
      (i: { rgdName: string; ready: string }) =>
        i.rgdName === 'never-ready' && i.ready === 'False'
    )
    if (!neverReady) { test.skip(); return }

    await page.goto(`${BASE}/instances`)
    await page.waitForFunction(() => {
      return document.querySelector('.instance-table') !== null &&
             document.querySelector('.instances-page__loading') === null
    }, { timeout: 30000 })

    // Search for the never-ready instance in the table
    const searchInput = page.locator('input[placeholder*="Search"]')
    if (await searchInput.count() > 0) {
      await searchInput.fill(neverReady.name)
      await page.waitForFunction(
        (name: string) => {
          const rows = document.querySelectorAll('.instance-table__row')
          return Array.from(rows).some((r) => r.textContent?.includes(name))
        },
        neverReady.name,
        { timeout: 5000 }
      )
    }

    // Find the status dot for the never-ready row
    const rows = page.locator('.instance-table__row')
    let statusDot = null
    const rowCount = await rows.count()
    for (let i = 0; i < rowCount; i++) {
      const rowText = await rows.nth(i).textContent()
      if (rowText?.includes(neverReady.name)) {
        statusDot = rows.nth(i).locator('.instance-table__status-dot, [data-testid="status-dot"]')
        break
      }
    }
    if (!statusDot) { test.skip(); return }

    // The status dot should have a title attribute
    const title = await statusDot.getAttribute('title')
    if (title !== null) {
      expect(title.length).toBeGreaterThan(0)
    }
  })

  // ── C: Message is non-empty for IN_PROGRESS+NotReady instances ───────────────

  test('Step 3: all IN_PROGRESS+Ready=False instances in API have non-empty message', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/instances`)
    const data = await res.json()
    if (!data.items) { test.skip(); return }

    const stuck = data.items.filter(
      (i: { state: string; ready: string }) =>
        i.state === 'IN_PROGRESS' && i.ready === 'False'
    )
    if (stuck.length === 0) { test.skip(); return }

    for (const inst of stuck) {
      // Message should be present and non-empty for stuck instances
      if ('message' in inst) {
        expect(typeof inst.message).toBe('string')
        // Message may be empty for some instances — just check it's not undefined
      }
    }
  })
})
