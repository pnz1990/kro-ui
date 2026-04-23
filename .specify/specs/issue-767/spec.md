# Spec: issue-767

## Design reference
- **Design doc**: `docs/design/28-rgd-display.md`
- **Section**: `§ Future`
- **Implements**: 28.1 — RGD detail "what's new" section: when a GraphRevision is created (kro v0.9.1+), the Graph tab currently shows the latest revision's DAG; it does not highlight what changed since the prior revision in the live view; add a "Changes since last revision" banner at the top of the Graph tab when `spec.revisions.length >= 2`: "N nodes added, M nodes removed since r{prev}" with a "Diff revisions" shortcut link to the RevisionsTab diff

---

## Zone 1 — Obligations (falsifiable)

- **O1**: When `hasRevisions=true` AND the RGD has ≥2 GraphRevisions, a banner appears at the top of the Graph tab content area showing "N nodes added, M nodes removed since r{prev}". Falsifiable: render with a mock RGD + 2 revisions → banner element is visible.
- **O2**: The banner contains a link (or button) labeled "Diff revisions" that navigates to `?tab=revisions`. Falsifiable: clicking the link sets the tab to `revisions`.
- **O3**: When there are 0 nodes added AND 0 nodes removed (identical graphs), no banner is rendered. Falsifiable: render with identical revisions → banner element is absent.
- **O4**: When `hasRevisions=false` (kro < v0.9.0 cluster), no banner is rendered regardless of revision count. Falsifiable: render with `hasRevisions=false` → no banner.
- **O5**: The banner uses only `var(--color-*)` tokens from `tokens.css` — no hardcoded hex/rgba. Falsifiable: grep for hex/rgba in the new CSS file returns empty.
- **O6**: The comparison uses `spec.resources[].id` to identify nodes. Added = in latest but not prior. Removed = in prior but not latest. Falsifiable: unit test with mock revision specs.

---

## Zone 2 — Implementer's judgment

- Fetch revisions lazily: only when on the Graph tab and `hasRevisions=true`
- Render 0 as "no changes" text if both added and removed are 0 → show no banner (O3)
- Use `listGraphRevisions` API (already available) — no new API needed
- Loading state: no banner while fetching; error: silently hide banner (non-critical path)
- Comparison function can live in `@/lib/format.ts` as a pure function (testable)

---

## Zone 3 — Scoped out

- Per-node diff (which specific nodes changed) — only counts, not list
- Showing the diff inline on the Graph tab — the Diff revisions link covers navigation
- Caching revision data between tab switches (single-fetch per page load is fine)
