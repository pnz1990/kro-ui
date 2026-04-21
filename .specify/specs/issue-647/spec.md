# Spec: Designer localStorage draft persistence

## Design reference
- **Design doc**: `docs/design/31-rgd-designer.md`
- **Section**: `§ Future`
- **Implements**: Designer `localStorage` persistence of in-progress RGD draft (🔲 → ✅)

---

## Zone 1 — Obligations

**O1**: When the user edits the RGD state on `/author` (not in readonly mode), the state MUST be auto-saved to `localStorage` under the key `"kro-ui-designer-draft"`, debounced at 2 seconds after the last change.

**O2**: On next visit to `/author` (i.e., when the component mounts), if a draft exists in `localStorage` AND the page is not loading a `?share=` URL, a "Restore draft?" prompt MUST be visible.

**O3**: The restore prompt MUST offer two actions: "Restore" (loads the draft) and "Discard" (clears the draft and proceeds with the default starter state). After either action the prompt MUST disappear.

**O4**: If the user restores the draft, `rgdState` MUST be set to the saved draft value.

**O5**: If the user discards the draft, `localStorage.removeItem("kro-ui-designer-draft")` MUST be called and the state MUST remain as the default `STARTER_RGD_STATE`.

**O6**: The restore prompt MUST NOT appear when a `?share=` URL is present (readonly mode) — the shared URL takes priority.

**O7**: TypeScript must compile without errors (`tsc --noEmit`).

**O8**: The auto-save MUST NOT run when `readonly` is true — shared read-only views must not overwrite the draft.

---

## Zone 2 — Implementer's judgment

- The prompt can be an inline banner within the form pane (not a modal dialog) — same style as `DesignerReadonlyBanner` or `YAMLImportPanel`.
- `JSON.stringify`/`JSON.parse` are sufficient for serialization. Invalid JSON in `localStorage` must be swallowed (try/catch → ignore corrupted draft).
- Debounce implementation: reuse the existing `useDebounce` hook or a `useEffect` + `setTimeout` pattern.
- The restore prompt's accessible role should be `role="status"` or `role="alert"` so screen readers announce it.

---

## Zone 3 — Scoped out

- Draft versioning (the saved draft has no schema version; breaking changes to `RGDAuthoringState` may silently load a corrupted draft — acceptable for now)
- Cross-tab sync (two open Designer tabs can stomp on each other's drafts — deferred)
- "Last saved" timestamp display — not required by this spec
