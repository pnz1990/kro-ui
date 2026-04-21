// share.ts — Designer collaboration URL encoding/decoding.
//
// Serializes RGDAuthoringState into a compact base64url query param so users
// can share the Designer with a pre-loaded view. The recipient's browser
// decodes the param and renders the RGD in readonly mode (no editing).
//
// Encoding: JSON.stringify → TextEncoder UTF-8 → base64url (no padding)
// Decoding: base64url → TextDecoder UTF-8 → JSON.parse
//
// No compression library is used — no new npm dependencies.
// The URL fragment approach (?share=...) works behind any reverse proxy.
//
// Design ref: docs/design/31-rgd-designer.md §Future → ✅ (Designer: collaboration mode)
// Spec: issue-544

import type { RGDAuthoringState } from '@/lib/generator'

/** URL query parameter name used to embed the shared state. */
export const SHARE_PARAM = 'share'

/**
 * Encode an RGDAuthoringState into a base64url string suitable for embedding
 * in a URL query parameter.
 *
 * Returns `null` if serialization fails (should not happen in practice).
 */
export function encodeDesignerShare(state: RGDAuthoringState): string | null {
  try {
    const json = JSON.stringify(state)
    const bytes = new TextEncoder().encode(json)
    // btoa only accepts latin1; use Uint8Array → binary string approach
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    // base64url: replace + → - and / → _ and strip padding =
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  } catch {
    return null
  }
}

/**
 * Decode a base64url share token back into an RGDAuthoringState.
 *
 * Returns `null` if decoding or JSON parsing fails (e.g. corrupted URL).
 */
export function decodeDesignerShare(token: string): RGDAuthoringState | null {
  try {
    // Re-add base64 padding and restore standard chars
    const padded = token.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4
    const b64 = pad ? padded + '='.repeat(4 - pad) : padded
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const json = new TextDecoder().decode(bytes)
    const state = JSON.parse(json) as RGDAuthoringState
    // Minimal validation: must have rgdName string and resources array
    if (typeof state.rgdName !== 'string' || !Array.isArray(state.resources)) {
      return null
    }
    return state
  } catch {
    return null
  }
}

/**
 * Build a shareable URL for the current Designer state.
 *
 * Uses `window.location` as the base URL so it works regardless of
 * which host/port the app is served on.
 *
 * Returns `null` if encoding fails.
 */
export function buildShareUrl(state: RGDAuthoringState): string | null {
  const token = encodeDesignerShare(state)
  if (token === null) return null
  const url = new URL(window.location.href)
  url.search = ''  // clear any existing params
  url.hash = ''
  url.searchParams.set(SHARE_PARAM, token)
  return url.toString()
}

/**
 * Extract a shared RGDAuthoringState from the current URL's query params.
 *
 * Returns `null` if no `?share=` param is present or if decoding fails.
 */
export function extractShareFromUrl(): RGDAuthoringState | null {
  const params = new URLSearchParams(window.location.search)
  const token = params.get(SHARE_PARAM)
  if (!token) return null
  return decodeDesignerShare(token)
}
