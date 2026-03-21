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

export default defineConfig({
  // All E2E journeys live in test/e2e/journeys/
  testDir: './journeys',
  testMatch: '*.spec.ts',

  // Run journeys in order (they share a single kind cluster — parallel would
  // cause race conditions on the context-switcher state)
  workers: 1,
  fullyParallel: false,

  // Retry once on CI to absorb transient cluster latency
  retries: process.env.CI ? 1 : 0,

  // Verbose output so failures are easy to diagnose in CI logs
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
})
