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
 * Shared kro label key constants.
 *
 * Single source of truth for kro.run/* label strings. Import from here instead
 * of duplicating inline strings across components — if kro upstream renames a
 * label, only this file needs to change.
 */

/** kro.run/node-id — maps a child resource to the RGD resource node that created it. */
export const LABEL_NODE_ID = 'kro.run/node-id'

/** kro.run/collection-index — position of a child within its forEach collection. */
export const LABEL_COLL_INDEX = 'kro.run/collection-index'

/** kro.run/collection-size — total expected items in a forEach collection. */
export const LABEL_COLL_SIZE = 'kro.run/collection-size'

/** kro.run/instance-name — associates a child resource with its parent CR instance. */
export const LABEL_INSTANCE_NAME = 'kro.run/instance-name'
