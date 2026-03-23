# Quickstart: 028-instance-health-rollup

**Generated**: 2026-03-23

---

## What This Feature Does

`028-instance-health-rollup` surfaces per-instance health across three UI surfaces:

1. **RGD home cards** — async `HealthChip` showing `{ready}/{total} ready`
2. **Instance table** — 5-state `ReadinessBadge` (adds `Reconciling` and `Pending`)
3. **Instance detail header** — `HealthPill` showing the rolled-up health state
4. **ConditionsPanel** — "Not reported" empty state; summary header; absent fields omitted

---

## Files Changed

| File | Change |
|------|--------|
| `web/src/tokens.css` | Add `--color-status-reconciling`, `--color-status-pending` tokens |
| `web/src/lib/format.ts` | Add `InstanceHealthState`, `InstanceHealth`, `extractInstanceHealth()`, `aggregateHealth()` |
| `web/src/lib/api.ts` | Extend `get()` to accept `options?: { signal?: AbortSignal }` |
| `web/src/components/ReadinessBadge.tsx` | Accept `InstanceHealth`; add `reconciling`/`pending` states |
| `web/src/components/ReadinessBadge.css` | Add `.readiness-badge--reconciling` and `.readiness-badge--pending` |
| `web/src/components/HealthChip.tsx` | **New** — compact chip for RGDCard |
| `web/src/components/HealthChip.css` | **New** |
| `web/src/components/HealthPill.tsx` | **New** — header pill for InstanceDetail |
| `web/src/components/HealthPill.css` | **New** |
| `web/src/components/RGDCard.tsx` | Add `useState`+`useEffect` for async health chip |
| `web/src/components/ConditionsPanel.tsx` | Fix empty state; add summary header; omit absent fields |
| `web/src/components/ConditionsPanel.css` | Add summary row styles |
| `web/src/pages/InstanceDetail.tsx` | Add `HealthPill` to instance detail header |
| `web/src/lib/format.test.ts` | Add `extractInstanceHealth` unit tests |
| `web/src/components/HealthChip.test.tsx` | **New** — unit tests |
| `test/e2e/journeys/028-instance-health-rollup.spec.ts` | **New** — E2E journey |

---

## Development Flow

```bash
# 1. Start the dev server
make web   # or: bun run --cwd web dev

# 2. Verify TypeScript after each file change
bun run --cwd web typecheck   # or: tsc --noEmit

# 3. Run unit tests
bun run --cwd web test        # vitest run

# 4. Build the binary to verify go:embed
make build
```

---

## Key Constraints

- **No new npm dependencies** — all code is pure React + TypeScript
- **No hardcoded colors** — use `var(--color-status-reconciling)` etc.
- **Chip fetch is fire-and-forget** — never block `RGDCard` render
- **AbortController** on chip fetch — cancel on card unmount to avoid memory leaks
- **ConditionsPanel empty state** must say "Not reported" (constitution §XII)
- **`extractReadyStatus` is NOT changed** — `extractInstanceHealth` is a new parallel function

---

## Testing

```bash
# Unit tests
bun run --cwd web test --reporter verbose

# Typecheck
bun run --cwd web typecheck

# E2E (requires kind cluster)
make test-e2e
```

---

## Acceptance Check

After implementation, verify manually:

1. Home page: RGD card shows health chip ("N ready" or "N / M ready") after a brief load
2. Instance table: an instance with `Progressing=True` shows amber "Reconciling" badge
3. Instance detail: header shows `HealthPill` with correct state
4. ConditionsPanel: empty conditions shows "Not reported", not "No conditions."
5. `bun run typecheck` passes with 0 errors
6. `bun run test` passes with 0 failures
