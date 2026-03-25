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

// errors.ts — API error translation utility.
//
// Translates raw Go/Kubernetes API error strings into user-readable messages.
// Called at render time (not in api.ts) so that components can pass context
// (e.g. whether the RGD is Ready) to produce contextual messages.
//
// Spec: .specify/specs/041-error-states-ux-audit/spec.md FR-001
// Issue: #187

/**
 * Context hints for translateApiError.
 * All fields are optional — omit when the context is not available.
 */
export interface TranslateContext {
  /**
   * When false (RGD not Ready), prefer "CRD may not be provisioned yet" wording
   * for resource-not-found / no-kind-registered errors.
   * Undefined is treated the same as true (no RGD-readiness info available).
   */
  rgdReady?: boolean

  /**
   * Tab hint for contextual "check the X tab" suggestions.
   * Values: "validation" | "access" | "yaml" | "generate" | "docs"
   */
  tab?: string
}

/**
 * Translate a raw API error string into a user-readable message.
 *
 * Pattern matching order (first match wins):
 *  1. "the server could not find the requested resource"  → CRD not provisioned
 *  2. /no kind "X" is registered/i                       → Kind not registered
 *  3. HTTP 403 / "forbidden"                             → Permission denied
 *  4. HTTP 401 / "Unauthorized"                          → Not authenticated
 *  5. "connection refused" / "dial tcp" / HTTP 503        → API server unreachable
 *  6. "context deadline exceeded"                         → Request timed out
 *  7. "x509: certificate"                                 → TLS certificate error
 *
 * Returns the original message unchanged when no pattern matches.
 * Returns the original message unchanged when input is empty or whitespace-only.
 */
export function translateApiError(message: string, context?: TranslateContext): string {
  if (!message || !message.trim()) return message

  const m = message.toLowerCase()

  // Pattern 1: resource not found / CRD not provisioned
  if (m.includes('the server could not find the requested resource')) {
    if (context?.rgdReady === false) {
      return "The RGD's CRD has not been provisioned yet — instances can only be created once the RGD is Ready. Check the Validation tab."
    }
    return "The API server doesn't recognise this resource type — the CRD may not be provisioned yet. Check the Validation tab."
  }

  // Pattern 2: no kind registered (extract kind name)
  const noKindMatch = message.match(/no kind "([^"]+)" is registered/i)
  if (noKindMatch) {
    const kind = noKindMatch[1]
    if (context?.rgdReady === false) {
      return `The kind '${kind}' is not registered — the RGD CRD hasn't been created yet. Check the Validation tab.`
    }
    return `The kind '${kind}' is not registered in this cluster — the RGD CRD hasn't been created yet.`
  }

  // Pattern 3: HTTP 403 / forbidden
  if (m.includes('403') || m.includes('forbidden')) {
    return "Permission denied — kro-ui's service account lacks access. Check the Access tab."
  }

  // Pattern 4: HTTP 401 / Unauthorized
  if (m.includes('401') || m.includes('unauthorized')) {
    return "Not authenticated — your kubeconfig credentials may have expired."
  }

  // Pattern 5: connection refused / dial tcp / HTTP 503
  if (m.includes('connection refused') || m.includes('dial tcp') || m.includes('503')) {
    return "Cannot reach the Kubernetes API server — check cluster connectivity."
  }

  // Pattern 6: context deadline exceeded
  if (m.includes('context deadline exceeded')) {
    return "Request timed out — the cluster may be under load. Try again."
  }

  // Pattern 7: TLS certificate error
  if (m.includes('x509')) {
    return "TLS certificate error — your kubeconfig certificate may be invalid or expired."
  }

  // No known pattern — return original so advanced operators see the raw message
  return message
}
