# Feature Specification: Condition-based WARNINGS Counter

**Feature Branch**: `059-condition-warnings`
**Created**: 2026-03-28
**Status**: Merged (PR #328)

## Context

The TelemetryPanel WARNINGS cell counts Kubernetes `Warning`-type events.
These expire after ~1 hour. For long-running stuck instances (like `never-ready`,
stuck for 2183 minutes), the WARNINGS counter shows `0` — misleading.

## Fix

Add `countFailedConditions(instance)` that counts non-Ready conditions with
`status=False` or `status=Unknown`. Combine with event warnings:
`warningCount = eventWarnings + conditionWarnings`.

`never-ready-prod` with `ResourcesReady=False` → WARNINGS = 1.

## Acceptance Criteria

- [ ] `countFailedConditions` added to `telemetry.ts`
- [ ] TelemetryPanel WARNINGS = event warnings + condition warnings
- [ ] 7 unit tests for `countFailedConditions`
- [ ] Existing tests still pass
- [ ] `tsc --noEmit` clean
