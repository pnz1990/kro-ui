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

import { defineConfig, devices } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE_URL = `http://localhost:${PORT}`

// ── Journey chunk definitions ─────────────────────────────────────────────────
//
// Journey 007 (context-switcher) calls POST /api/v1/contexts/switch, which
// mutates global server state. It must run AFTER all other journeys complete
// so parallel workers don't receive responses from an unexpected context.
//
// All other journeys are read-only against the server and fully isolated by
// Playwright's per-test browser page — safe to run with workers: 4.
//
// Chunking strategy (by numeric prefix):
//   chunk-1:  001–006   server health, home, DAG, instance list, live instance, CEL
//   chunk-3:  008–015   feature flags, virtualization, collection, chaining, fleet, catalog
//   chunk-4:  017–025   validation, rbac, events, schema-doc, cardinality, metrics, advisor, chain
//   chunk-5:  027–040   telemetry, health, overlay, errors, deletion, rbac-sa, onboarding …
//   chunk-6:  043-*     upstream fixture journeys (new in spec 043)
//   chunk-7:  041,045-047  UX audit, designer, kro v0.9.0, ux-improvements, state-map
//   chunk-8:  051-054   instance diff, response cache, multi-version kro, ux-gaps-round3
//   serial:   007       context-switcher — runs after all chunks complete
//
// Each chunk runs with workers: 4 (parallel files); the serial project uses workers: 1.

const PARALLEL_OPTS = {
  use: { ...devices['Desktop Chrome'], baseURL: BASE_URL },
}

export default defineConfig({
  testDir: './journeys',

  // Retry once on CI to absorb transient cluster latency
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  // Per-test timeout: 60s (some steps wait 6s for poll cycles + cluster ops)
  timeout: 60_000,

  // Expect timeout: 10s (DOM assertions)
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,

    // All journeys use Chromium — required by journey 006 for CSS custom
    // property resolution via getComputedStyle (spec 006, §E2E User Journey).
    ...devices['Desktop Chrome'],

    // Capture trace on first retry to aid debugging
    trace: 'on-first-retry',

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Grant clipboard permissions so journey 006 can assert copy-button output
    contextOptions: {
      permissions: ['clipboard-read', 'clipboard-write'],
    },
  },

  // Global setup/teardown: kind cluster lifecycle + kro install + server start
  globalSetup: './setup/global-setup.ts',
  globalTeardown: './setup/global-teardown.ts',

  projects: [
    // ── Parallel chunks ───────────────────────────────────────────────────
    {
      name: 'chunk-1',
      testMatch: /00[1-6]-.*\.spec\.ts/,
      ...PARALLEL_OPTS,
      workers: 4,
      fullyParallel: true,
    },
    {
      name: 'chunk-3',
      testMatch: /(008|009|010|011|012|013|015)-.*\.spec\.ts/,
      ...PARALLEL_OPTS,
      workers: 4,
      fullyParallel: true,
    },
    {
      name: 'chunk-4',
      testMatch: /(017|018|019|020|021|022|023|025)-.*\.spec\.ts/,
      ...PARALLEL_OPTS,
      workers: 4,
      fullyParallel: true,
    },
    {
      name: 'chunk-5',
      testMatch: /(027|028|029|030|031|032|033|034|035|036|037|038|039|040)-.*\.spec\.ts/,
      ...PARALLEL_OPTS,
      workers: 4,
      fullyParallel: true,
    },
    {
      name: 'chunk-6',
      testMatch: /043-.*\.spec\.ts/,
      ...PARALLEL_OPTS,
      workers: 4,
      fullyParallel: true,
    },
    {
      // chunk-7 covers journeys added in specs 041, 045, 046, 047, 047b
      // (UX audit, RGD Designer validation, kro v0.9.0 upgrade, ux-improvements,
      //  live-dag state-map fixes)
      name: 'chunk-7',
      testMatch: /(041|045|046|047[a-z]?)-.*\.spec\.ts/,
      ...PARALLEL_OPTS,
      workers: 4,
      fullyParallel: true,
    },
    {
      // chunk-8 covers journeys added in specs 051–054
      // (instance diff, response cache, multi-version kro support, ux-gaps-round3)
      name: 'chunk-8',
      testMatch: /(051|052|053|054)-.*\.spec\.ts/,
      ...PARALLEL_OPTS,
      workers: 4,
      fullyParallel: true,
    },

    // ── Serial: context-switcher (depends on all parallel chunks) ─────────
    // Journey 007 calls POST /api/v1/contexts/switch — global server state.
    // Must run after all other journeys to avoid context race conditions.
    {
      name: 'serial',
      testMatch: /007-.*\.spec\.ts/,
      dependencies: ['chunk-1', 'chunk-3', 'chunk-4', 'chunk-5', 'chunk-6', 'chunk-7', 'chunk-8'],
      ...PARALLEL_OPTS,
      workers: 1,
      fullyParallel: false,
    },
  ],
})
