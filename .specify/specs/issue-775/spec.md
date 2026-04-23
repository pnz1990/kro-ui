# Spec: 30.2 — Cross-instance error pattern correlation

## Design reference
- **Design doc**: `docs/design/30-health-system.md` §Future item 30.2
- **Issue**: #775
- **Closes**: #775

## What
Add a "Top error messages" frequency panel at the top of the Errors tab.
When 10 instances all fail with the same message (cluster-wide rollout failure),
the current tab shows 10 separate rows with no pattern signal. The new panel
shows `{count}× {message}` sorted by frequency.

## Why
A cluster-wide rollout failure (same error, many instances) is the most
actionable operator signal. It is currently invisible in the per-condition
grouped view. The frequency panel surfaces it immediately.

## Acceptance criteria

### Zone 1 — Must
- [x] `aggregateTopMessages(groups, topN=5): TopMessageEntry[]` pure function exported
- [x] Only messages with count > 1 appear (single-instance errors are not patterns)
- [x] "(no message)" and empty strings excluded
- [x] Sorted by count descending
- [x] Rendered as `{count}× {message}` list above the error groups
- [x] Hidden when there are no qualifying messages (0 entries)
- [x] `data-testid="errors-top-messages"` for E2E
- [x] CSS uses `--color-*` tokens (no hardcoded colors)
- [x] 7 unit tests T-TM01–T-TM07
- [x] `docs/design/30-health-system.md` 30.2 promoted 🔲→✅

## Out of scope
- Backend changes
- Linking messages to specific instances (can be done as follow-up)
