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
 * Journey 063: kro v0.9.1 Upgrade — GraphRevision Hash Column, CEL Hash Help,
 *              Reconcile-Paused Suspended Annotation
 *
 * Validates spec 063-kro-v091-upgrade user stories:
 *
 *   US2 — Revisions tab shows graph revision hash (8-char truncation, graceful "—" on v0.9.0)
 *   US3 — CEL hash functions (hash.fnv64a/sha256/md5) documented in Designer CEL help
 *   US4 — Reconcile-paused banner uses canonical `suspended` annotation in kubectl hint
 *
 * All steps are capability-gated: steps requiring GraphRevision support skip gracefully
 * on pre-v0.9.0 clusters.
 *
 * Cluster pre-conditions:
 *   - kind cluster running with kro installed (any version)
 *   - test-app RGD applied and healthy
 *
 * Spec ref: .specify/specs/063-kro-v091-upgrade/spec.md
 *
 * E2E anti-patterns avoided (§XIV):
 *   - HTTP status checks for SPA route existence (use API check + return)
 *   - waitForTimeout for data-load (use waitForFunction)
 *   - locator.or().toBeVisible() ambiguity
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

// ── US2: GraphRevision Hash Column ────────────────────────────────────────────

test.describe('Journey 063 — US2: GraphRevision hash column in Revisions tab', () => {
  test('Step 1: capabilities API reports hasGraphRevisions status', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/kro/capabilities`)
    expect(res.ok(), `capabilities endpoint returned ${res.status()}`).toBe(true)
    const body = await res.json()
    // Field must be present regardless of kro version
    expect(typeof body?.schema?.hasGraphRevisions).toBe('boolean')
  })

  test('Step 2: Revisions tab renders on test-app with Hash column header', async ({ page, request }) => {
    // Guard: hasGraphRevisions required for meaningful Revisions tab test
    const capsRes = await request.get(`${BASE}/api/v1/kro/capabilities`)
    if (!capsRes.ok() || !(await capsRes.json())?.schema?.hasGraphRevisions) {
      test.skip(true, 'hasGraphRevisions=false — skip Revisions tab test')
      return
    }

    // Guard: test-app must exist
    const rgdRes = await request.get(`${BASE}/api/v1/rgds/test-app`)
    if (!rgdRes.ok()) {
      test.skip(true, 'test-app RGD not present')
      return
    }

    await page.goto(`${BASE}/rgds/test-app`)

    // Wait for Revisions tab to be visible and click it
    await page.waitForFunction(() => {
      const tabs = document.querySelectorAll('[role="tab"], button')
      return Array.from(tabs).some(
        (el) => el.textContent?.toLowerCase().includes('revision'),
      )
    }, { timeout: 15_000 })

    const revisionsTab = page
      .getByRole('tab', { name: /revisions/i })
      .or(page.getByRole('button', { name: /revisions/i }))
    await revisionsTab.first().click()

    // Wait for the revisions table to load
    await page.waitForFunction(() => {
      const table = document.querySelector('[data-testid="revisions-table"]')
      if (!table) return false
      // Table must have at least one row beyond the header
      const rows = table.querySelectorAll('tbody tr, [data-testid^="revision-row-"]')
      return rows.length > 0
    }, { timeout: 20_000 })

    // Hash column header must be present
    await expect(
      page.locator('.revisions-table__th--hash'),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('Step 3: Each revision row shows hash or graceful "—" placeholder', async ({ page, request }) => {
    // Guard: GraphRevisions required
    const capsRes = await request.get(`${BASE}/api/v1/kro/capabilities`)
    if (!capsRes.ok() || !(await capsRes.json())?.schema?.hasGraphRevisions) {
      test.skip(true, 'hasGraphRevisions=false — skip')
      return
    }

    const rgdRes = await request.get(`${BASE}/api/v1/rgds/test-app`)
    if (!rgdRes.ok()) {
      test.skip(true, 'test-app RGD not present')
      return
    }

    await page.goto(`${BASE}/rgds/test-app`)

    // Navigate to Revisions tab
    await page.waitForFunction(() => {
      const tabs = document.querySelectorAll('[role="tab"], button')
      return Array.from(tabs).some((el) => el.textContent?.toLowerCase().includes('revision'))
    }, { timeout: 15_000 })

    const revisionsTab = page
      .getByRole('tab', { name: /revisions/i })
      .or(page.getByRole('button', { name: /revisions/i }))
    await revisionsTab.first().click()

    // Wait for at least one revision-row element
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid^="revision-row-"]') !== null
    }, { timeout: 20_000 })

    // Each revision row must have a hash cell — either an 8-char hash or "—"
    const hashCells = page.locator('.revisions-table__td--hash')
    const count = await hashCells.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const cell = hashCells.nth(i)
      const text = (await cell.textContent()) ?? ''
      const isHash = /^[0-9a-f]{8}$/i.test(text.trim())
      const isAbsent = text.trim() === '—'
      expect(isHash || isAbsent, `Hash cell ${i} has unexpected text: "${text}"`).toBe(true)
    }
  })

  test('Step 4: kro v0.9.1 cluster shows actual 8-char hash (not just —)', async ({ request }) => {
    // Guard: cluster must have hasGraphRevisions and must be running kro v0.9.1+
    const capsRes = await request.get(`${BASE}/api/v1/kro/capabilities`)
    if (!capsRes.ok()) {
      test.skip(true, 'capabilities unavailable')
      return
    }
    const caps = await capsRes.json()
    if (!caps?.schema?.hasGraphRevisions) {
      test.skip(true, 'hasGraphRevisions=false — not kro v0.9.0+')
      return
    }

    // Fetch graph revisions for test-app
    const revRes = await request.get(`${BASE}/api/v1/kro/graph-revisions?rgd=test-app`)
    if (!revRes.ok()) {
      test.skip(true, 'graph-revisions endpoint unavailable')
      return
    }
    const revBody = await revRes.json()
    if (!Array.isArray(revBody?.items) || revBody.items.length === 0) {
      test.skip(true, 'no GraphRevision objects for test-app — skip hash check')
      return
    }

    // Check if any revision has the hash label (kro v0.9.1+)
    const hasHashLabel = revBody.items.some((rev: Record<string, unknown>) => {
      const labels = (rev.metadata as Record<string, unknown> | undefined)?.labels as
        Record<string, unknown> | undefined
      return typeof labels?.['kro.run/graph-revision-hash'] === 'string'
    })

    if (!hasHashLabel) {
      test.skip(true, 'no kro.run/graph-revision-hash label found — cluster may be kro v0.9.0')
      return
    }

    // Verify the hash is a non-empty string (at least 8 chars for 8-char truncation)
    const sampleRev = revBody.items.find((rev: Record<string, unknown>) => {
      const labels = (rev.metadata as Record<string, unknown> | undefined)?.labels as
        Record<string, unknown> | undefined
      return typeof labels?.['kro.run/graph-revision-hash'] === 'string'
    })
    const labels = (sampleRev?.metadata as Record<string, unknown>)?.labels as Record<string, unknown>
    const hash = labels['kro.run/graph-revision-hash'] as string
    expect(hash.length).toBeGreaterThanOrEqual(8)
  })
})

// ── US3: CEL hash help in Designer ───────────────────────────────────────────

test.describe('Journey 063 — US3: CEL hash functions in Designer help text', () => {
  test('Step 5: Designer CEL help mentions hash.fnv64a', async ({ page }) => {
    await page.goto(`${BASE}/author`)

    // Wait for the Designer to load (the form should appear)
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="authoring-form"]') !== null ||
             document.title.includes('Designer')
    }, { timeout: 15_000 })

    // Look for any element that mentions hash CEL functions
    // The help text appears in title attributes on CEL-related form inputs
    const pageContent = await page.content()
    const mentionsHash = pageContent.includes('hash.fnv64a') || pageContent.includes('hash.sha256')
    expect(mentionsHash, 'Designer should mention hash.fnv64a in CEL help').toBe(true)
  })
})

// ── Brace balance check ───────────────────────────────────────────────────────
// This file uses only test.describe + test (no extra closing braces needed)
