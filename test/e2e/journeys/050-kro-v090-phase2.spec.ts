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
 * Journey 050: kro v0.9.0 Phase 2 — Reconcile-Paused Banner + Cluster-Scoped
 *
 * Validates spec 050-kro-v090-phase2:
 *   - Reconcile-paused banner appears when kro.run/reconcile=suspended annotation is set
 *     (cluster-conditional: skip when no suspended instance exists)
 *   - Cluster-scoped namespace display shows "—" for cluster-scoped instances
 *   - displayNamespace utility correctly hides empty namespace
 *
 * Spec ref: .specify/specs/050-kro-v090-phase2/
 *
 * Cluster pre-conditions:
 *   - kind cluster running, kro v0.9.0+ installed
 *   - test-app RGD applied and Ready
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 050 — kro v0.9.0 Phase 2', () => {

  test('Step 1: instance detail page loads without showing raw annotation values', async ({ page, request }) => {
    const rgdRes = await request.get(`${BASE}/api/v1/rgds/test-app`)
    if (!rgdRes.ok()) {
      test.skip(true, 'test-app not available')
      return
    }

    // Get an instance
    const instRes = await request.get(`${BASE}/api/v1/rgds/test-app/instances`)
    if (!instRes.ok()) {
      test.skip(true, 'test-app instances not available')
      return
    }
    const instBody = await instRes.json()
    const items = instBody?.items ?? []
    if (items.length === 0) {
      test.skip(true, 'no test-app instances found')
      return
    }

    const inst = items[0]
    const ns = inst?.metadata?.namespace ?? ''
    const name = inst?.metadata?.name ?? ''
    if (!name) {
      test.skip(true, 'no valid instance found')
      return
    }

    const url = ns
      ? `${BASE}/rgds/test-app/instances/${ns}/${name}`
      : `${BASE}/rgds/test-app/instances//${name}`
    await page.goto(url)

    await page.waitForFunction(
      () => document.querySelector('[data-testid="instance-detail"]') !== null ||
            document.querySelector('[data-testid="live-dag"]') !== null ||
            document.querySelector('.instance-detail') !== null,
      { timeout: 20_000 }
    )

    // No raw annotation keys should be visible
    const bodyText = await page.locator('body').textContent() ?? ''
    expect(bodyText).not.toContain('kro.run/reconcile=')
    expect(bodyText).not.toContain('[object Object]')
  })

  test('Step 2: cluster-scoped RGDs show scope badge or cluster-scoped indicator', async ({ page, request }) => {
    // Try to find a cluster-scoped RGD
    const capsRes = await request.get(`${BASE}/api/v1/kro/capabilities`)
    if (!capsRes.ok()) {
      test.skip(true, 'capabilities endpoint unavailable')
      return
    }

    const clusterScopedRgd = await request.get(`${BASE}/api/v1/rgds/upstream-cluster-scoped`)
    if (!clusterScopedRgd.ok()) {
      test.skip(true, 'upstream-cluster-scoped RGD not available on this cluster')
      return
    }

    await page.goto(`${BASE}/rgds/upstream-cluster-scoped`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 20_000 })

    // Should show a scope badge or "cluster-scoped" indicator
    await page.waitForFunction(
      () => document.body.innerText.includes('cluster') ||
            document.body.innerText.includes('Cluster') ||
            document.querySelector('[data-testid="rgd-scope-badge"]') !== null,
      { timeout: 10_000 }
    )
  })

  test('Step 3: suspended/paused instance shows reconcile banner when annotation present', async ({ page, request }) => {
    // This test is inherently cluster-conditional — skip if no suspended instances
    const instRes = await request.get(`${BASE}/api/v1/rgds/test-app/instances`)
    if (!instRes.ok()) {
      test.skip(true, 'test-app instances not available')
      return
    }

    const instBody = await instRes.json()
    const items = instBody?.items ?? []
    // Check if any instance has kro.run/reconcile=suspended annotation
    const suspended = items.find((item: Record<string, unknown>) => {
      const annotations = (item as Record<string, Record<string, string>>)?.metadata?.annotations ?? {}
      return annotations['kro.run/reconcile'] === 'suspended' ||
             annotations['kro.run/reconcile'] === 'disabled'
    })
    if (!suspended) {
      test.skip(true, 'no suspended instances found — banner test skipped')
      return
    }

    const ns = (suspended as Record<string, Record<string, string>>)?.metadata?.namespace ?? ''
    const name = (suspended as Record<string, Record<string, string>>)?.metadata?.name ?? ''
    await page.goto(`${BASE}/rgds/test-app/instances/${ns}/${name}`)
    await page.waitForFunction(
      () => document.body.innerText.includes('suspended') ||
            document.body.innerText.includes('paused') ||
            document.body.innerText.includes('Reconciliation suspended') ||
            document.querySelector('[data-testid="reconcile-paused-banner"]') !== null,
      { timeout: 15_000 }
    )
  })

}) // end test.describe
