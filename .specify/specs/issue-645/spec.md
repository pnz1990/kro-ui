# Spec: 27.20 — Frontend per-request fetch timeout

## Design reference
- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future`
- **Implements**: 27.20 — Frontend per-request fetch timeout (AbortSignal.timeout 30s fallback) (🔲 → ✅)

---

## Zone 1 — Obligations

**O1**: `get()` in `web/src/lib/api.ts` MUST use `AbortSignal.any([options?.signal, AbortSignal.timeout(30_000)])` (or equivalent) so that all GET requests time out after 30 seconds even if the caller passes no signal.

**O2**: `post()` in `web/src/lib/api.ts` MUST apply the same 30-second timeout fallback so that all POST requests time out after 30 seconds even if the caller passes no signal.

**O3**: When the timeout fires (i.e. the fetch is aborted by the internal timeout and not by a caller signal), the error thrown MUST have a message that includes "timed out" or "timeout" (case-insensitive) so callers can distinguish a timeout from a server error.

**O4**: When the caller supplies its own `AbortSignal` and that signal fires first, the behavior MUST be unchanged from the current implementation (signal propagates as-is; no "timed out" message is injected).

**O5**: `AbortSignal.any()` is available in all supported browsers (Chrome 116+, Firefox 115+, Safari 17.4+). A polyfill is NOT required — if `AbortSignal.any` is absent (e.g. older test environment), the function MUST fall back gracefully to the caller-supplied signal (or no signal) rather than throwing a TypeError.

**O6**: TypeScript must compile without errors (`tsc --noEmit`).

**O7**: Go tests must pass (`GOPROXY=direct GONOSUMDB="*" go test ./... -race -count=1`).

---

## Zone 2 — Implementer's judgment

- The timeout value of 30 seconds matches the server-side 30s route-level timeout. Using the same value creates a symmetric budget: the client gives up at the same time the server would.
- `AbortSignal.any()` is the idiomatic approach over a manual `AbortController` + `setTimeout` combination. Use it.
- The graceful fallback for environments without `AbortSignal.any` (O5) can be a simple `typeof AbortSignal.any === 'function'` guard.
- Error message: wrapping in a named `TimeoutError` class is a Zone 2 choice; a plain `Error('Request timed out')` is sufficient for O3.
- The `validateRGD` and `validateRGDStatic` functions use their own `fetch` calls directly — they do not go through `get()`/`post()`. Applying the same timeout to these is a Zone 2 choice (recommended for consistency but not required by this spec).

---

## Zone 3 — Scoped out

- Retry logic on timeout (defer to a separate spec)
- Configurable timeout per-endpoint (all endpoints use the same 30s floor)
- E2E test simulating a slow API (tracked as 27.19 — separate item)
- Unit tests using Jest mocks for AbortSignal.timeout (recommended but not required by this spec)
