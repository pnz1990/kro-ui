# Spec: issue-720 — Health system: health snapshot clipboard export

## Design reference
- **Design doc**: `docs/design/30-health-system.md`
- **Section**: `§ Future`
- **Implements**: Health system: health snapshot clipboard export (🔲 → ✅)

## Summary

An operator debugging a cluster incident needs to share current health state with
their team. Add a "Copy snapshot" button to the Overview SRE dashboard header that
produces a structured JSON blob containing health state counts, top-5 errors, the
active cluster context name, and a timestamp.

---

## Zone 1 — Obligations

**O1**: The snapshot MUST be a stable JSON object with the following top-level fields:
- `version`: always `"1"` — allows future parsers to detect format version
- `timestamp`: ISO 8601 UTC string
- `context`: active kubeconfig context name (`ContextsResponse.active`)
- `health`: health distribution counts (ready/error/degraded/reconciling/pending/unknown/total)
- `topErrors`: array of up to 5 `{ rgdName: string; count: number }` objects (descending)

**O2**: The button MUST copy the JSON to the clipboard (Clipboard API, fallback to
`document.execCommand('copy')`) and display a temporary "Copied!" indicator for 2s.

**O3**: The button MUST be disabled while `isFetching` is true (stale data guard).

**O4**: When clipboard permission is denied or unavailable, the button MUST NOT crash.
Show a silent no-op (no error banner). The clipboard permission failure is non-fatal.

**O5**: The button MUST appear in the Overview header controls, to the left of the
Refresh button.

---

## Zone 2 — Implementer's judgment

- The context name is read from `ContextsResponse.active` which Home already fetches
  as part of `capabilitiesState` — but `active` context is in `listContexts()`, not
  `getCapabilities()`. Add a lightweight context fetch or read from the existing
  `capabilitiesState` (which doesn't include context name). Best: reuse the context
  from `ContextSwitcher` via the Layout context, or add a lightweight fetch.
- Simplest: fetch context name once on mount via `listContexts()`.
- The "Copied!" toast is a simple state toggle (no external library).
- The JSON format is stable — do not add fields without bumping `version`.

---

## Zone 3 — Scoped out

- Sharing via link or email (clipboard only)
- Persistent snapshot history
- Per-RGD-namespace breakdown
