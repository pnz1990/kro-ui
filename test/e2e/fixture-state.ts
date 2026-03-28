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
 * fixture-state.ts — read fixture readiness flags written by globalSetup.
 *
 * Playwright workers run in a separate process from globalSetup, so
 * process.env mutations in globalSetup are NOT visible in test files.
 * globalSetup writes fixture-state.json; this module reads it.
 *
 * IMPORTANT: `fixtureState` is a Proxy that reads the JSON file on EVERY
 * property access. This avoids the race condition where the module is imported
 * (and the top-level constant evaluated) before globalSetup finishes writing
 * the file. With a frozen top-level constant, workers that started before the
 * file was written would see all-false defaults for the entire test run.
 *
 * Usage:
 *   import { fixtureState } from '../fixture-state'
 *   test('...', async ({ page }) => {
 *     test.skip(!fixtureState.multiReady, 'multi-resource RGD not Ready')
 *     ...
 *   })
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface FixtureState {
  testAppReady: boolean
  collectionReady: boolean
  multiReady: boolean
  externalRefReady: boolean
  celFunctionsReady: boolean
  // Added in spec 043-upstream-fixture-generator
  cartesianReady: boolean
  collectionChainReady: boolean
  contagiousReady: boolean
  clusterScopedReady: boolean
  externalCollectionReady: boolean
  celComprehensionsReady: boolean
}

const DEFAULTS: FixtureState = {
  testAppReady: false,
  collectionReady: false, multiReady: false, externalRefReady: false, celFunctionsReady: false,
  cartesianReady: false, collectionChainReady: false, contagiousReady: false,
  clusterScopedReady: false, externalCollectionReady: false, celComprehensionsReady: false,
}

const STATE_PATH = resolve(__dirname, 'fixture-state.json')

function readFixtureState(): FixtureState {
  if (!existsSync(STATE_PATH)) {
    return { ...DEFAULTS }
  }
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as FixtureState
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * fixtureState — lazily reads fixture-state.json on each property access.
 *
 * Using a Proxy ensures the file is read at test-execution time (inside each
 * `test()` callback), not at module-import time. This prevents the race where
 * the worker imports this module before globalSetup has finished writing the
 * file, which would freeze all flags at their default (false) values.
 */
export const fixtureState: FixtureState = new Proxy({} as FixtureState, {
  get(_target, prop: string) {
    return readFixtureState()[prop as keyof FixtureState]
  },
})
