# Research: kro v0.9.0 Upgrade

**Date**: 2026-03-26
**Branch**: `046-kro-v090-upgrade`
**Resolved by**: Inspection of `github.com/kubernetes-sigs/kro@v0.9.0` module in Go module cache

---

## Decision 1: GraphRevision API Group and GVR

**Decision**: Use `internal.kro.run/v1alpha1` as the API group/version for GraphRevision.
The resource name is `graphrevisions` (lowercased plural). The constant
`InternalKRODomainName = "internal.kro.run"` is defined in
`api/internal.kro.run/v1alpha1/groupversion_info.go`.

```
Group:    "internal.kro.run"
Version:  "v1alpha1"
Resource: "graphrevisions"
```

**Rationale**: These are the upstream-defined values. Using the dynamic client +
discovery means we never hardcode the CRD name, but we do need the GVR to make
the `List` and `Get` calls. The group string must match exactly.

**Alternatives considered**: None — this is a factual lookup from upstream source.

---

## Decision 2: Filtering GraphRevisions by RGD Name

**Decision**: Use a **field selector** `spec.snapshot.name=<rgd-name>` when listing
GraphRevisions. The CRD declares `+kubebuilder:selectablefield:JSONPath=".spec.snapshot.name"`,
which means the Kubernetes API server indexes this field and supports efficient
server-side filtering via `ListOptions.FieldSelector`.

This is the approach kro's own controller uses
(`controller_reconcile.go:442: "spec.snapshot.name": rgd.Name`).

**Rationale**: Server-side field selection is far more efficient than fetching all
GraphRevisions and filtering client-side, especially on clusters with many RGDs.
The selectable field declaration guarantees Kubernetes indexes it.

**Fallback**: If the field selector fails (older or non-standard API server), the
handler should fall back to listing all revisions and filtering client-side on
`spec.snapshot.name`. This ensures graceful degradation.

**Alternatives considered**: Label selectors — `GraphRevision` objects carry the
`kro.run/graph-revision-hash` label but not a stable RGD-name label. Field
selector is the canonical approach here.

---

## Decision 3: GraphRevision Detection in Capabilities

**Decision**: Extend `SchemaCapabilities` with `HasGraphRevisions bool`. Set to
`true` when discovery finds `graphrevisions` in the `internal.kro.run/v1alpha1`
API group resources.

**Rationale**: The existing capabilities system uses `ServerResourcesForGroupVersion`
to probe what CRDs exist. We can add a second probe for `internal.kro.run/v1alpha1`.
This is consistent with the existing `kro.run/v1alpha1` probe.

**Implementation**: Add `detectInternalKroCRDs(ctx, disc)` alongside the existing
`detectSchemaCapabilities` goroutine. Call `disc.ServerResourcesForGroupVersion("internal.kro.run/v1alpha1")`.
If this returns resources containing `graphrevisions`, set `HasGraphRevisions = true`.

**Alternatives considered**: Checking `CachedServerGroupsAndResources` for the
group — also valid but slightly more expensive since it returns all groups. The
targeted `ServerResourcesForGroupVersion` call is cheaper and already the pattern
used for `kro.run/v1alpha1`.

---

## Decision 4: BASELINE `hasExternalRefSelector` Change

**Decision**: Change `BASELINE.schema.hasExternalRefSelector` from `false` to `true`
in both `internal/k8s/capabilities.go` (Go baseline) and `web/src/lib/features.ts`
(TypeScript baseline).

**Rationale**: kro v0.9.0 ships `externalRef.metadata.selector` by default (it was
added before v0.9.0 but the UI was conservative). With v0.9.0 as the minimum
supported kro version for this release of kro-ui, the baseline should reflect
what all v0.9.0+ clusters support.

**Risk**: This changes the frontend baseline for pre-v0.9.0 clusters. Users on
older kro versions who haven't upgraded will see the ExternalCollection node type
rendered even if their cluster doesn't support it. However, since the UI only
_reads_ existing RGD data, and the selector node type is only shown when the RGD
actually contains `externalRef.metadata.selector`, this is safe — a pre-v0.9.0
cluster simply wouldn't have such an RGD.

**Alternatives considered**: Leave baseline as `false` — overly conservative now
that v0.9.0 is GA.

---

## Decision 5: Scope Badge Visual Treatment

**Decision**: Add a small inline badge "Cluster" to RGD cards when `spec.schema.scope === 'Cluster'`.
Reuse the existing badge/chip pattern from RGDCard (the existing "chainable" badge
uses a similar inline chip). Add two new tokens to `tokens.css`:
`--badge-cluster-bg` and `--badge-cluster-fg`.

Color choice: use `--color-pending` (violet, `#a78bfa`) family for the cluster
scope badge to visually distinguish it from the status colors (emerald/amber/rose).
Alternatively, derive from `--color-primary`. Final token values defined in tasks.

**Rationale**: Scope is immutable after creation and affects the operational model
(no namespace on instances). It warrants a distinct visual indicator. The existing
chip/badge CSS class pattern avoids adding new layout.

**Alternatives considered**: Showing scope as text in the card footer — adds noise
for the common case (Namespaced). Badge pattern is less intrusive.

---

## Decision 6: DocsTab Types Section

**Decision**: Render a "Types" section in DocsTab below the Spec section, gated on
`caps.schema.hasTypes`. Parse `spec.schema.types` using the same `parseSchema`
function already used for Spec fields (it returns `ParsedType[]`). Display in the
same `FieldTable` component.

**Rationale**: `spec.schema.types` has the same SimpleSchema format as `spec.schema.spec`.
Reusing the existing parser and table component keeps the implementation minimal
and consistent.

**Alternatives considered**: A separate parser for types — unnecessary; the format
is identical.

---

## Decision 7: `lastIssuedRevision` in RGD Detail Header

**Decision**: Add `lastIssuedRevision` as an optional chip in the RGD detail header
alongside the existing status dot. The chip shows "Rev #N" when `status.lastIssuedRevision > 0`.
This is a v0.9.0+ field; graceful degradation (absent or zero → omit) per §XII.

**Rationale**: Surfaces the revision counter at a glance without requiring users
to open the YAML tab.

---

## Decision 8: Designer Cartesian forEach — "Add Iterator" Button

**Decision**: The existing `RGDAuthoringForm.tsx` already supports multiple
`ForEachIterator[]` entries in the form state and `generateRGDYAML` already emits
them correctly. The only missing piece is a UI button to add a second iterator row.
Add an "Add iterator" button below the existing iterator row in the forEach section.
The "Remove" button should appear on each iterator row when there are ≥2 iterators.

**Rationale**: The generator and form state already handle multi-iterator correctly
(verified in `generator.test.ts:534`). This is a UI-only change — just wiring the
"add" action that already exists in form state management.

---

## Decision 9: CEL Comprehension Macros — Regression Guard Only

**Decision**: No code changes required in `highlighter.ts`. The three macros
(`transformMap`, `transformList`, `transformMapEntry`) appear inside `${...}` CEL
expression blocks, which are already classified as `celExpression` tokens by the
current tokenizer. The E2E journey `043-cel-comprehensions` validates this.

The `transformMap` etc. are not YAML keys and not SimpleSchema types — they're
plain CEL identifiers within the expression body. The tokenizer treats the entire
`${...}` block as a single `celExpression` token, which is correct.

Add one unit test asserting that a CEL expression containing `transformMap(...)` 
produces a `celExpression` token (regression guard for future refactors).

**Rationale**: Confirmed by reading `highlighter.ts` tokenizeLine function — it
scans for `${...}` and emits the entire block as `celExpression`. No per-function
classification is done. This is intentional and sufficient.

---

## Decision 10: No New Go Module Dependencies

**Decision**: All new code uses only `k8s.io/client-go/dynamic`, `k8s.io/apimachinery`,
`github.com/go-chi/chi/v5`, and `github.com/rs/zerolog` — all already in `go.mod`.
The `internal.kro.run/v1alpha1` types from `github.com/kubernetes-sigs/kro` are
already in `go.mod` at v0.9.0.

**Rationale**: Constitution §V prohibits adding dependencies without strong justification.
All needed APIs are already available.

---

## Open Questions Resolved

| Question | Answer |
|----------|--------|
| Does `internal.kro.run/v1alpha1` exist in kro v0.9.0? | Yes — `api/internal.kro.run/v1alpha1/` package exists in the module |
| How to filter GraphRevisions by RGD? | Field selector `spec.snapshot.name=<name>` (selectable field in CRD) |
| Is `scope` field in kro v0.9.0? | Yes — `ResourceScope` type with `Namespaced`/`Cluster` values |
| Is `types` field in kro v0.9.0? | Yes — `Schema.Types runtime.RawExtension` |
| Is `lastIssuedRevision` in kro v0.9.0? | Yes — `ResourceGraphDefinitionStatus.LastIssuedRevision int64` |
| Does cartesian forEach work with existing generator? | Yes — already implemented in generator.ts, just needs UI "Add iterator" button |
| Do comprehension macros need new tokenizer support? | No — they're inside `${...}` which is already `celExpression` |
