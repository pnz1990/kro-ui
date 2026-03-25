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

// conditions.ts — shared helpers for interpreting kro condition messages.
//
// Spec: .specify/specs/030-error-patterns-tab/contracts/ui-contracts.md

/**
 * rewriteConditionMessage — translates known kro internal error strings into
 * plain-English summaries. Returns null when no pattern matches (caller should
 * show the raw message as-is). (Issue #103)
 *
 * Recognised patterns:
 *   1. "cannot resolve group version kind ... schema not found"
 *      → "Referenced kind X is not yet registered — check that the providing
 *         RGD is Ready before applying this one."
 *   2. "references unknown identifiers: [...]"
 *      → "CEL expression references an unknown field or resource ID — check
 *         forEach, includeWhen, and readyWhen expressions for typos."
 *   3. "failed to build OpenAPI schema ... unknown type: array"
 *      → "Schema uses 'type: array' which is not supported by this kro version —
 *         use lists.range() with an integer field instead."
 *
 * @param reason  - condition.reason (may be undefined)
 * @param message - condition.message (may be undefined)
 * @returns Rewritten plain-English string, or null
 */
export function rewriteConditionMessage(reason: string | undefined, message: string | undefined): string | null {
  if (!message) return null

  if (message.includes('cannot resolve group version kind') && message.includes('schema not found')) {
    // Extract "Kind=ChainChild" from within the GVK string.
    // The message format is: ... "kro.run/v1alpha1, Kind=ChainChild" ...
    const kindMatch = message.match(/Kind=([A-Za-z][A-Za-z0-9]*)/)
    const kindName = kindMatch ? kindMatch[1] : 'the referenced kind'
    return `Referenced kind "${kindName}" is not yet registered. ` +
      `Ensure the ResourceGraphDefinition that provides this kind is Ready before applying.`
  }

  if (message.includes('references unknown identifiers')) {
    const identMatch = message.match(/references unknown identifiers:\s*\[([^\]]+)\]/)
    const identList = identMatch ? identMatch[1] : 'unknown fields'
    return `CEL expression references unknown identifier(s): ${identList}. ` +
      `Check forEach, includeWhen, and readyWhen expressions for typos or missing resource IDs.`
  }

  if (message.includes('unknown type: array') || (message.includes('field type') && message.includes('array'))) {
    return `Schema field uses "type: array" which is not supported by this kro version. ` +
      `Use an integer field with lists.range() in the forEach expression instead.`
  }

  if (reason === 'AwaitingReconciliation') {
    return null // handled by the "Awaiting controller processing" hint already
  }

  return null // no known pattern — show raw
}

// ── Negation-polarity condition helpers ───────────────────────────────────
//
// Some Kubernetes condition types use inverted polarity: status "False" is the
// healthy/expected value. The canonical example in kro is ReconciliationSuspended:
// when status=False the controller is running normally (not suspended), which is
// the desired state.
//
// NEGATION_POLARITY_CONDITIONS is the single source of truth for which condition
// types use this inverted polarity. Adding a new type here automatically propagates
// correct styling to ConditionItem, correct counting in ConditionsPanel, and correct
// error suppression in ErrorsTab — no other files need to change.
//
// Spec: .specify/specs/028-instance-health-rollup/ FR-011, FR-012, FR-013, FR-014
// Issue: https://github.com/pnz1990/kro-ui/issues/171

/**
 * Condition types where status="False" is the healthy/expected value.
 * Do NOT hardcode this set in component files — always import from here.
 */
export const NEGATION_POLARITY_CONDITIONS = new Set<string>([
  'ReconciliationSuspended',
])

/**
 * isHealthyCondition — returns true when a condition is in the desired/healthy state.
 *
 * For normal conditions: healthy when status="True".
 * For negation-polarity conditions (listed in NEGATION_POLARITY_CONDITIONS):
 *   healthy when status="False" (e.g. ReconciliationSuspended=False means running).
 *
 * @param type   - condition.type (e.g. "Ready", "ReconciliationSuspended")
 * @param status - condition.status ("True" | "False" | "Unknown")
 */
export function isHealthyCondition(type: string, status: string): boolean {
  if (NEGATION_POLARITY_CONDITIONS.has(type)) return status === 'False'
  return status === 'True'
}
