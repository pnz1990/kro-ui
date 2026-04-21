# Spec: 27.16 — Self-host Inter and JetBrains Mono fonts

## Design reference
- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future`
- **Implements**: 27.16 — Google Fonts external dependency removal (🔲 → ✅)

---

## Zone 1 — Obligations

**O1**: `web/index.html` MUST NOT contain any reference to `fonts.googleapis.com` or `fonts.gstatic.com` after this change.

**O2**: Inter (weights 300, 400, 500, 600, 700) and JetBrains Mono (weights 400, 500, 600) MUST be served as static assets embedded in the binary — no external network request for fonts at runtime.

**O3**: Font files MUST be placed in `web/public/fonts/` and served via the existing `go:embed all:dist` path (Vite copies `public/` to `dist/` at build time). No changes to the Go embed path or server routing are required.

**O4**: The `@font-face` declarations MUST use `font-display: swap` so text is visible during font loading (matches the previous Google Fonts `display=swap` parameter).

**O5**: The UI MUST render the same font family after this change as before (Inter for UI text, JetBrains Mono for code blocks).

**O6**: The binary MUST build successfully with the embedded fonts (`make build` passes).

**O7**: Go tests MUST pass (`GOPROXY=direct GONOSUMDB="*" go test ./... -race -count=1`).

---

## Zone 2 — Implementer's judgment

- WOFF2 format only — all supported browsers (Chrome 36+, Firefox 35+, Safari 12+) support it. No need for TTF/EOT fallbacks.
- Font subset: variable-weight fonts are acceptable if they reduce file size, but static weights (300–700 for Inter, 400–600 for JetBrains Mono) must be present.
- CSS may be in a separate `web/public/fonts.css` or inlined in `web/src/tokens.css` — either is acceptable.
- The `<link rel="preload">` hint for the regular-weight fonts is a nice-to-have, not required.

---

## Zone 3 — Scoped out

- Variable font optimization (subsetting by Unicode range) — defer to a separate performance item
- Icon fonts — not used in kro-ui
- Font licensing documentation — Inter (SIL OFL 1.1) and JetBrains Mono (Apache 2.0) are both open source; no additional license file needed beyond what already exists
