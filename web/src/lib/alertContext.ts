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

// AlertContext — React context for sharing health alert subscription callback
// with pages that poll instance health data.
//
// Layout creates the subscription and provides checkTransitions via this context.
// The Home page consumes it to fire alerts when instances transition to error/degraded.
//
// Spec: .specify/specs/issue-540/spec.md  O2, O3

import { createContext, useContext } from 'react'
import type { InstanceSummary } from '@/lib/api'

export interface AlertContextValue {
  /** Check the given instances for health-state transitions and fire browser notifications. */
  checkTransitions: (items: InstanceSummary[]) => void
}

export const AlertContext = createContext<AlertContextValue>({
  // Default no-op: safe when no provider is present (e.g. tests, non-Layout rendering)
  checkTransitions: () => undefined,
})

/**
 * useAlertContext — access the health alert subscription callback.
 *
 * Call `checkTransitions(instances)` after each successful instance fetch.
 * The function is a no-op if the user has not subscribed.
 */
export function useAlertContext(): AlertContextValue {
  return useContext(AlertContext)
}
