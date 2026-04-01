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

// kro.test.ts — regression guard for kro.run/* label key constants.
//
// If a constant is accidentally changed (e.g. by a broad search-replace),
// this test catches the mismatch before CI deploys it to a cluster where the
// label mismatch would silently break state-map keying and collection tracking.
// GH #394.

import { describe, it, expect } from 'vitest'
import { LABEL_NODE_ID, LABEL_COLL_INDEX, LABEL_COLL_SIZE, LABEL_INSTANCE_NAME } from './kro'

describe('kro label constants', () => {
  it('LABEL_NODE_ID matches upstream kro.run/node-id', () => {
    expect(LABEL_NODE_ID).toBe('kro.run/node-id')
  })

  it('LABEL_COLL_INDEX matches upstream kro.run/collection-index', () => {
    expect(LABEL_COLL_INDEX).toBe('kro.run/collection-index')
  })

  it('LABEL_COLL_SIZE matches upstream kro.run/collection-size', () => {
    expect(LABEL_COLL_SIZE).toBe('kro.run/collection-size')
  })

  it('LABEL_INSTANCE_NAME matches upstream kro.run/instance-name', () => {
    expect(LABEL_INSTANCE_NAME).toBe('kro.run/instance-name')
  })

  it('all constants are non-empty strings with the kro.run/ prefix', () => {
    for (const label of [LABEL_NODE_ID, LABEL_COLL_INDEX, LABEL_COLL_SIZE, LABEL_INSTANCE_NAME]) {
      expect(label).toMatch(/^kro\.run\//)
    }
  })
})
