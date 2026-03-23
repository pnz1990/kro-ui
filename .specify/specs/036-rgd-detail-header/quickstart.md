# Quickstart: 036 — RGD Detail Header Kind Label + Status Badge

## What this feature does

Adds a Kind label and status dot to the RGD detail page header (`/rgds/:name`),
matching the information shown on the home page RGD card.

## Files changed

| File | Change |
|------|--------|
| `web/src/pages/RGDDetail.tsx` | Import `StatusDot`, `extractRGDKind`, `extractReadyStatus`; add variables; update header JSX |
| `web/src/pages/RGDDetail.css` | Add `.rgd-detail-header-row` and `.rgd-detail-kind` CSS rules |

## How to verify

1. Start the dev server:
   ```bash
   cd web && bun run dev
   ```
2. Navigate to the home page and note the Kind label and status dot on any RGD card.
3. Click through to the RGD detail page (`/rgds/:name`).
4. Verify: header shows RGD name, status dot (green/gray/red), and Kind badge.
5. Verify: if `spec.schema.kind` is absent, the Kind badge is omitted.
6. Run TypeScript typecheck:
   ```bash
   bun run typecheck
   ```

## Key design decisions

- **No new components** — `StatusDot` is reused directly.
- **No new extraction functions** — `extractRGDKind` and `extractReadyStatus`
  from `@/lib/format` cover all needed data.
- **No new tokens** — all colors come from existing `tokens.css` custom properties.
- **No new API calls** — status and kind come from the RGD object already fetched.
