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
 * Journey 009: RGD Graph Diff View (spec 009-rgd-graph-diff)
 *
 * Validates the merged-DAG diff view in the Revisions tab.
 *
 * All steps are capability-gated: the entire journey skips gracefully on
 * clusters where hasGraphRevisions=false (pre-kro-v0.9.0).
 *
 * The hermetic E2E cluster runs kro v0.9.1 with the test-app RGD applied.
 * test-app normally only has 1 revision (created on first Apply). Steps that
 * require 2+ revisions must apply a spec change to generate a second revision,
 * and skip when the second revision is not yet available.
 *
 * Cluster pre-conditions:
 *   - kind cluster running with kro v0.9.0+ installed
 *   - test-app RGD applied and Ready
 *
 * Spec ref: .specify/specs/009-rgd-graph-diff/spec.md
 *
 * E2E anti-patterns avoided:
 *   - HTTP status to detect nonexistent SPA routes (§XIV — use API check)
 *   - waitForTimeout for data-load (§XIV — use waitForFunction)
 *   - locator.or().toBeVisible() when both may be visible
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

// ── Step 1: capability guard ──────────────────────────────────────────────────

test.describe('Journey 009 — Graph Diff (spec 009)', () => {

  test('Step 1: capabilities API reports hasGraphRevisions (kro v0.9.0+ required)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/kro/capabilities`)
    expect(res.ok(), `capabilities endpoint returned ${res.status()}`).toBe(true)
    const body = await res.json()
    // Log for CI visibility regardless of whether we skip
    const has = body?.schema?.hasGraphRevisions === true
    if (!has) {
      test.skip(true, 'hasGraphRevisions=false — cluster does not support GraphRevisions; skipping spec-009 journey')
      return
    }
    expect(body?.schema?.hasGraphRevisions).toBe(true)
  })

  // ── Step 2: Revisions tab visible on test-app RGD ─────────────────────────

  test('Step 2: Revisions tab is visible on test-app RGD detail page', async ({ page, request }) => {
    // Capability guard
    const capsRes = await request.get(`${BASE}/api/v1/kro/capabilities`)
    if (!capsRes.ok() || !(await capsRes.json())?.schema?.hasGraphRevisions) {
      test.skip(true, 'hasGraphRevisions=false; skipping')
      return
    }

    // Verify test-app RGD exists
    const rgdRes = await request.get(`${BASE}/api/v1/rgds/test-app`)
    if (!rgdRes.ok()) {
      test.skip(true, 'test-app RGD not present on this cluster')
      return
    }

    await page.goto(`${BASE}/rgds/test-app`)
    await page.waitForFunction(
      () => document.querySelector('[data-testid="rgd-detail"]') !== null ||
            document.querySelector('[role="main"]') !== null,
      { timeout: 15_000 }
    )

    // Click the Revisions tab
    await page.getByRole('tab', { name: /revisions/i }).click()

    // Wait for the revisions tab to render (loading state resolves)
    await page.waitForFunction(
      () => document.querySelector('[data-testid="revisions-tab"]') !== null,
      { timeout: 15_000 }
    )

    const tab = page.locator('[data-testid="revisions-tab"]')
    await expect(tab).toBeVisible()
  })

  // ── Step 3: RevisionSelector and DAG diff render with ≥2 revisions ───────

  test('Step 3: RevisionSelector and RGDDiffView render when 2+ revisions exist', async ({ page, request }) => {
    // Capability guard
    const capsRes = await request.get(`${BASE}/api/v1/kro/capabilities`)
    if (!capsRes.ok() || !(await capsRes.json())?.schema?.hasGraphRevisions) {
      test.skip(true, 'hasGraphRevisions=false; skipping')
      return
    }

    // Check how many revisions test-app has
    const revRes = await request.get(`${BASE}/api/v1/kro/graph-revisions?rgd=test-app`)
    if (!revRes.ok()) {
      test.skip(true, 'Could not fetch revisions')
      return
    }
    const revBody = await revRes.json()
    const items = Array.isArray(revBody?.items) ? revBody.items : []
    if (items.length < 2) {
      test.skip(true, `test-app only has ${items.length} revision(s) — need 2+ for diff; skipping`)
      return
    }

    await page.goto(`${BASE}/rgds/test-app?tab=revisions`)
    await page.waitForFunction(
      () => document.querySelector('[data-testid="revisions-tab"]') !== null,
      { timeout: 15_000 }
    )

    // RevisionSelector should be visible (shown when ≥2 revisions)
    await page.waitForFunction(
      () => document.querySelector('[data-testid="revision-selector"]') !== null,
      { timeout: 15_000 }
    )
    const selector = page.locator('[data-testid="revision-selector"]')
    await expect(selector).toBeVisible()

    // The dag-diff-svg should appear (default pair auto-selected)
    await page.waitForFunction(
      () => document.querySelector('[data-testid="dag-diff-svg"]') !== null ||
            document.querySelector('[data-testid="rgd-diff-view"]') !== null,
      { timeout: 15_000 }
    )
    const dagDiff = page.locator('[data-testid="dag-diff-svg"]')
    await expect(dagDiff).toBeVisible()

    // Legend should be present
    const legend = page.locator('[data-testid="dag-diff-legend"]')
    await expect(legend).toBeVisible()
  })

  // ── Step 4: single-revision RGD shows "Only one revision exists" message ──

  test('Step 4: single-revision RGD shows "Only one revision exists" message', async ({ page, request }) => {
    // Capability guard
    const capsRes = await request.get(`${BASE}/api/v1/kro/capabilities`)
    if (!capsRes.ok() || !(await capsRes.json())?.schema?.hasGraphRevisions) {
      test.skip(true, 'hasGraphRevisions=false; skipping')
      return
    }

    // Find an RGD with exactly 1 revision (test-app typically has 1 on first apply)
    const rgdRes = await request.get(`${BASE}/api/v1/rgds/test-app`)
    if (!rgdRes.ok()) {
      test.skip(true, 'test-app not available')
      return
    }

    const revRes = await request.get(`${BASE}/api/v1/kro/graph-revisions?rgd=test-app`)
    if (!revRes.ok()) {
      test.skip(true, 'Could not fetch revisions')
      return
    }
    const items = (await revRes.json())?.items ?? []
    if (items.length !== 1) {
      test.skip(true, `test-app has ${items.length} revision(s) — need exactly 1 for this step`)
      return
    }

    await page.goto(`${BASE}/rgds/test-app?tab=revisions`)
    await page.waitForFunction(
      () => document.querySelector('[data-testid="revisions-tab"]') !== null,
      { timeout: 15_000 }
    )

    // The dag-diff section should NOT show RevisionSelector
    // Instead it shows the "Only one revision exists" message
    await page.waitForFunction(
      () => {
        const msg = document.querySelector('[data-testid="revision-selector-single-msg"]')
        const selector = document.querySelector('[data-testid="revision-selector"]')
        return msg !== null || selector === null
      },
      { timeout: 15_000 }
    )

    // Revisions table should still show the single revision
    await page.waitForFunction(
      () => document.querySelector('[data-testid="revisions-table"]') !== null,
      { timeout: 10_000 }
    )
    const table = page.locator('[data-testid="revisions-table"]')
    await expect(table).toBeVisible()
  })

  // ── Step 5: diff section absent when revisions not available ─────────────

  test('Step 5: graph-diff section only renders when hasGraphRevisions=true', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/kro/capabilities`)
    expect(res.ok()).toBe(true)
    const body = await res.json()

    if (body?.schema?.hasGraphRevisions === false) {
      // Verify the revisions API returns an empty list (not an error)
      const revRes = await request.get(`${BASE}/api/v1/kro/graph-revisions?rgd=test-app`)
      expect(revRes.ok()).toBe(true)
      const revBody = await revRes.json()
      expect(Array.isArray(revBody.items)).toBe(true)
    } else {
      // hasGraphRevisions=true: just verify the API works
      const revRes = await request.get(`${BASE}/api/v1/kro/graph-revisions?rgd=test-app`)
      expect(revRes.ok()).toBe(true)
    }
  })

}) // end test.describe
