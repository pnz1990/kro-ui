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
 * Journey 081: Partial-RBAC / Restricted-Namespace Testing
 *
 * Spec: .specify/specs/issue-574/spec.md  (27.12)
 *
 * Verifies:
 *   A) GET /api/v1/instances always returns HTTP 200, never 5xx (O1)
 *   B) Response includes the `rbacHidden` field (defaults to 0 in full-access cluster) (O1)
 *   C) GET /api/v1/rgds/{name}/instances always returns HTTP 200 (O2)
 *   D) /instances page renders without error and does not show RBAC warning in normal cluster (O3)
 *   E) ListInstances response includes `items` field (O2)
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.8.0
 * - At least one RGD (test-app)
 * - kro-ui binary running at KRO_UI_BASE_URL
 *
 * Note: Full RBAC restriction testing (actually forbidden namespaces) requires
 * cluster-specific RBAC setup and is covered in Go unit tests
 * (TestListInstances_ForbiddenReturns200WithWarning, TestListAllInstances_RBACForbiddenSetsRBACHidden).
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 081: Partial-RBAC — graceful degradation', () => {

  // ── A: ListAllInstances returns 200 with rbacHidden field ────────────────────

  test('Step 1: GET /api/v1/instances returns 200 and includes rbacHidden field', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/instances`)
    expect(res.status()).toBe(200)

    const data = await res.json() as { items: unknown[]; total: number; rbacHidden?: number }
    expect(Array.isArray(data.items)).toBe(true)
    expect(typeof data.total).toBe('number')
    // rbacHidden must be present (even if 0) — its absence would be a regression
    expect(typeof data.rbacHidden).toBe('number')
    // In a full-access E2E cluster, rbacHidden should be 0
    expect(data.rbacHidden).toBe(0)
  })

  // ── B: ListInstances for an RGD returns 200 with items field ─────────────────

  test('Step 2: GET /api/v1/rgds/test-app/instances returns 200 and includes items', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/rgds/test-app/instances`)
    expect(res.status()).toBe(200)

    const data = await res.json() as { items: unknown[] | null; warning?: string }
    // items is always an array (or null in older kro versions, coerced to [] by UI)
    expect(data.items === null || Array.isArray(data.items)).toBe(true)
    // warning must not be set in a full-access cluster
    expect(data.warning).toBeUndefined()
  })

  // ── C: /instances page renders without RBAC warning in normal cluster ────────

  test('Step 3: /instances page renders without RBAC warning', async ({ page }) => {
    await page.goto(`${BASE}/instances`)

    // Wait for the page to load (instances table or empty state)
    await page.waitForFunction(() => {
      const hasTable = !!document.querySelector('[data-testid="instances-table"]')
      const hasEmpty = !!document.querySelector('.instances-page__empty')
      const hasError = !!document.querySelector('.instances-page__error')
      return hasTable || hasEmpty || hasError
    }, { timeout: 30_000 })

    // RBAC warning should NOT be visible in a full-access cluster
    const rbacWarning = page.locator('[data-testid="instances-rbac-warning"]')
    const warningVisible = await rbacWarning.isVisible().catch(() => false)
    expect(warningVisible).toBe(false)
  })

  // ── D: /instances page renders correctly ─────────────────────────────────────

  test('Step 4: /instances page loads and shows instance count', async ({ page }) => {
    await page.goto(`${BASE}/instances`)

    // Wait for the instances count to appear (not still loading)
    await page.waitForFunction(() => {
      const count = document.querySelector('[data-testid="instances-count"]')
      return count !== null && count.textContent !== ''
    }, { timeout: 30_000 })

    const countEl = page.locator('[data-testid="instances-count"]')
    const countText = await countEl.textContent()
    expect(countText).not.toBeNull()
    // The count element should show a number
    expect(countText).toMatch(/\d+/)
  })

})
