# RGD Designer — Pre-flight Checks, Filters & Optimizations

**Spec**: `045-rgd-designer-validation-optimizer`
**Last updated**: 2026-03-26 (US9 + US10 added)
**Applies to**: `/author` route — `RGDAuthoringForm` + `generateRGDYAML` pipeline

This document describes every check, filter, silent sanitization, and user-visible
warning that runs on an `RGDAuthoringState` before or during YAML generation. It
covers the state as it exists after the full implementation of spec 045 (US1–US10).

All checks are advisory unless marked **[FILTER]** (silently dropped from output)
or **[BLOCK]** (blocks the specific action, e.g. import).
None block YAML generation or copying.

---

## Layer 1 — Silent filters in `generateRGDYAML` (`generator.ts`) [FILTER]

These run unconditionally on every YAML generation. The user sees no warning —
invalid or incomplete data is simply omitted from the output.

| # | What is filtered | Condition | Behaviour |
|---|-----------------|-----------|-----------|
| F-1 | Resources | `res.id` is empty | Entire resource block omitted from `spec.resources[]` |
| F-2 | Spec fields | `field.name` is empty | Field line omitted from `spec.schema.spec` |
| F-3 | Status fields | `sf.name` or `sf.expression` is empty | Status field line omitted from `spec.schema.status` |
| F-4 | forEach iterators | `it.variable` or `it.expression` is empty | Iterator entry omitted from `forEach:` array |
| F-5 | readyWhen entries | Entry is empty or whitespace-only | Entry omitted from `readyWhen:` array |
| F-6 | includeWhen | Value is empty or whitespace-only | `includeWhen:` block omitted entirely |
| F-7 | `scope` key | `scope === 'Namespaced'` (the default) | `scope:` line omitted — only `Cluster` is emitted |
| F-8 | `group` key | `group === 'kro.run'` (the default) | `group:` line omitted — only non-default values emitted |
| F-9 | `spec.schema.spec` block | `specFields` array is empty | Entire `spec:` sub-block omitted |
| F-10 | `spec.schema.status` block | No status fields pass F-3 | Entire `status:` sub-block omitted |
| F-11 | `spec.resources` block | `resources` array is empty after F-1 | Entire `resources:` block omitted |

**Source**: `generator.ts:553–688` (`generateRGDYAML`)

---

## Layer 2 — Silent filters in `rgdAuthoringStateToSpec` (`generator.ts`) [FILTER]

These run when building the spec object for the **live DAG preview** (debounced at
300ms). Same semantics as Layer 1 — invalid rows are dropped silently so the DAG
never sees them.

| # | What is filtered | Condition |
|---|-----------------|-----------|
| D-1 | Resources | `res.id` is empty |
| D-2 | forEach iterators | `it.variable` or `it.expression` is empty |
| D-3 | readyWhen entries | Entry is whitespace-only |
| D-4 | includeWhen | Value is empty/whitespace |
| D-5 | Spec schema fields | `field.name` is empty |

**Source**: `generator.ts:750–825` (`rgdAuthoringStateToSpec`)

---

## Layer 3 — User-visible validation in `validateRGDState` (`generator.ts`)

Runs synchronously on every render of `RGDAuthoringForm`. Results are shown as
inline advisory messages adjacent to the affected inputs. **All are advisory —
YAML generation is never blocked.**

Summary badge (`data-testid="validation-summary"`) shows total issue count when > 0.

### Metadata checks

| # | Check | Condition | Type | Message shown |
|---|-------|-----------|------|---------------|
| V-1 | RGD name required | `rgdName === ''` | **error** | "RGD name is required" |
| V-2 | RGD name format | Non-empty but fails RFC 1123 DNS subdomain regex or contains `--` | warning | "RGD name should be a valid DNS subdomain (lowercase alphanumeric and hyphens)" |
| V-3 | Kind required | `kind === ''` | **error** | "Kind is required" |
| V-4 | Kind format | Non-empty but fails `/^[A-Z][a-zA-Z0-9]*$/` | warning | "Kind should be PascalCase (e.g. WebApp, MyService)" |

### Resource-level checks

| # | Check | Condition | Type | Message shown | Location |
|---|-------|-----------|------|---------------|----------|
| V-5 | Duplicate resource ID | Two or more resources share the same non-empty `id` | warning | "Duplicate resource ID" | Beneath `id` input on each offending resource row |
| V-6 | forEach needs iterator | `resourceType === 'forEach'` AND no iterator has both `variable` + `expression` non-empty | warning | "forEach resources require at least one iterator" | Beneath `id` input on that resource row |

> **Priority rule**: V-5 takes priority over V-6 on the same resource row. A
> forEach resource with a duplicate ID only shows V-5.

### Spec field checks

| # | Check | Condition | Type | Message shown | Location |
|---|-------|-----------|------|---------------|----------|
| V-7 | Duplicate spec field name | Two or more spec fields share the same non-empty `name` | warning | "Duplicate spec field name" | Beneath `name` input on each offending row |
| V-8 | min > max constraint | `minimum` and `maximum` both set and `Number(minimum) > Number(maximum)` | warning | "minimum must be ≤ maximum" | Inside the expanded constraints panel |

> **Priority rule**: V-7 takes priority over V-8 on the same field row.

### Status field checks

| # | Check | Condition | Type | Message shown | Location |
|---|-------|-----------|------|---------------|----------|
| V-9 | Duplicate status field name | Two or more status fields share the same non-empty `name` | warning | "Duplicate status field name" | Beneath `name` input on each offending row |

**Source**: `generator.ts:218–344` (`validateRGDState`)

---

## Layer 4 — Template heuristic in `RGDAuthoringForm` (component)

A lightweight structural check on the raw `templateYaml` textarea content to
warn the user that the DAG may be missing edges.

| # | Check | Condition | Type | Message shown | Location |
|---|-------|-----------|------|---------------|----------|
| T-1 | Template not parseable | `templateYaml` is non-empty AND does not contain any `word:` pattern (`/^\s*\w+\s*:/m`) | warning | "⚠" icon on the "Edit template" button | Template editor toggle button |

This is intentionally minimal — it only detects completely unparseable content
(e.g., free-form text, JSON without colons). Valid YAML that happens to have no
CEL references will pass this check silently.

**Source**: `RGDAuthoringForm.tsx:675–677`

---

## Layer 5 — Import guard in `parseRGDYAML` [BLOCK on import only]

Runs when the user pastes YAML into the import panel and clicks "Apply".
Returns `{ ok: false, error }` on any structural problem; form state is not
changed. **Does not affect YAML generation.**

| # | Check | Condition | Error shown |
|---|-------|-----------|-------------|
| I-1 | Empty input | YAML is empty or whitespace-only | "Empty input" |
| I-2 | Not an RGD | `kind: ResourceGraphDefinition` not present in input | "Not a ResourceGraphDefinition" |
| I-3 | Missing schema | `spec.schema` block absent | "Missing spec.schema" |
| I-4 | Parse exception | Any JavaScript exception during line parsing | "Parse failed: \<message\>" |

On `{ ok: true }` the form state is fully replaced and the panel collapses.

**Source**: `generator.ts` (US8 — to be implemented, tasks T033–T051)

---

## Layer 6 — Offline kro-library deep validation (`POST /api/v1/rgds/validate/static`)

Runs automatically in `AuthorPage`, debounced at 1 second after any YAML change.
Calls the backend, which uses kro's own Go libraries (`pkg/simpleschema` and
`pkg/cel`) — **no cluster connection required**. Results shown in a "Deep
validation" section in `RGDAuthoringForm`.

This layer catches the semantic errors that Layers 1–5 cannot detect statically:

| # | Check | kro library used | Condition | Message shown |
|---|-------|-----------------|-----------|---------------|
| K-1 | Spec field type validity | `pkg/simpleschema.ParseField` | Type string (e.g. `"badtype"`) rejected by kro's schema parser | "Spec field '\<name\>': \<kro error\>" |
| K-2 | SimpleSchema constraint consistency | `pkg/simpleschema.ParseField` | Invalid constraint combination (e.g. `enum` on `integer`) | "Spec field '\<name\>': \<kro error\>" |
| K-3 | CEL expression syntax | `pkg/cel.DefaultEnvironment` + `env.Parse` | `${...}` expression fails CEL parse | "Resource '\<id\>': CEL parse error: \<kro error\>" |
| K-4 | Resource ID format | regex `/^[a-z][a-zA-Z0-9]*$/` | ID is PascalCase, kebab-case, contains numbers at start, etc. | "Resource '\<id\>': resource ID must be lowerCamelCase" |

**Version tracking**: All four checks automatically use the kro version pinned in
`go.mod`. Upgrading kro is `go get github.com/kubernetes-sigs/kro@vX.Y.Z && make tidy`.
Only `internal/validate/` needs updating if kro's library API changes.

**Graceful degradation**: if the endpoint is unavailable (server error), the "Deep
validation" section is hidden — form-level validation (Layer 3) continues normally.

**Source**: `internal/validate/` + `internal/api/handlers/validate.go:ValidateRGDStatic`
(US10 — to be implemented, tasks T061–T073)

---

## Layer 7 — Cluster dry-run validation (`POST /api/v1/rgds/validate`)

Manual — triggered by clicking "Validate against cluster" in `YAMLPreview`.
Performs a `dryRun=All` SSA apply via the dynamic client. This is the only check
that goes through **kro's full admission webhook chain**, catching:

| What kro's webhook catches | Not caught by any other layer |
|---------------------------|-------------------------------|
| CEL semantic type errors (e.g. accessing a field that doesn't exist on the referenced resource) | ✓ Only here |
| Cross-resource reference resolution (e.g. `${deployment.status.readyReplicas}` — does `deployment` exist as a resource ID?) | ✓ Only here |
| Schema type resolution against CRD definitions | ✓ Only here |
| Topological sort / dependency cycle detection (graph level) | ✓ Only here |
| Namespace/cluster scope conflicts | ✓ Only here |

| # | Result | Shown as |
|---|--------|---------|
| R-1 | kro webhook accepted | Green "✓ Valid" badge |
| R-2 | kro webhook rejected | Red "✗ Validation failed: \<error\>" |
| R-3 | Cluster unreachable | "Could not reach cluster" |
| R-4 | Timeout (>5s) | "Validation timed out" |
| R-5 | kro not installed | "kro not available in this cluster" (503 from backend) |

**Does NOT persist anything.** `dryRun=All` means kro processes the object through
its full admission chain but the Kubernetes API server does not write to etcd.

**Source**: `internal/api/handlers/validate.go:ValidateRGD`
(US9 — to be implemented, tasks T052–T060)

---

## Summary: what is and isn't checked

### Checked / surfaced (after full US1–US10 implementation)

| What | Where | Online? |
|------|-------|---------|
| Empty required metadata (`rgdName`, `kind`) | Layer 3 — form inline | Offline |
| Bad metadata format (DNS subdomain, PascalCase) | Layer 3 — form inline | Offline |
| Duplicate resource IDs | Layer 3 — form inline | Offline |
| forEach with no valid iterator | Layer 3 — form inline | Offline |
| Duplicate spec/status field names | Layer 3 — form inline | Offline |
| Constraint inversion (min > max) | Layer 3 — form inline | Offline |
| Unparseable template body | Layer 4 — template heuristic | Offline |
| Non-RGD / malformed YAML on import | Layer 5 — import guard | Offline [BLOCK] |
| Invalid SimpleSchema type strings | Layer 6 — kro library | Offline |
| SimpleSchema constraint inconsistencies | Layer 6 — kro library | Offline |
| CEL syntax errors in template expressions | Layer 6 — kro library | Offline |
| Resource ID format violations (lowerCamelCase) | Layer 6 — kro library | Offline |
| CEL semantic type errors / unresolved refs | Layer 7 — dry-run | **Online** |
| Cross-resource dependency cycles | Layer 7 — dry-run | **Online** |
| Schema resolution against CRD definitions | Layer 7 — dry-run | **Online** |
| Scope/namespace conflicts | Layer 7 — dry-run | **Online** |

### Silently filtered (Layers 1–2, never shown, never causes YAML error)

- Unnamed resources, fields, status fields, iterators — dropped from output
- Default `scope` / `group` values — omitted from output (correct kro behaviour)
- Empty `readyWhen` / `includeWhen` entries — dropped from output

### Still not checked (known remaining gaps)

| Gap | Why not covered |
|-----|----------------|
| `readyWhen` / `includeWhen` CEL syntax | Layer 6 could check these too — not yet wired (future enhancement) |
| `externalRef` completeness (both `name` and `selectorLabels` empty) | Silently emits incomplete metadata block; kro rejects at apply time — Layer 7 will catch this |
| `enum` values matching the declared type (e.g. `enum=1,2` on `string`) | `pkg/simpleschema.ParseField` may or may not catch this — depends on kro version |
| Resource `apiVersion` / `kind` format | Not validated by any layer; Layer 7 catches at dry-run |
| `pattern` regex validity | Not validated offline; Layer 7 catches if pattern is invalid enough to trip kro's CRD schema |

**Spec**: `045-rgd-designer-validation-optimizer`
**Last updated**: 2026-03-26
**Applies to**: `/author` route — `RGDAuthoringForm` + `generateRGDYAML` pipeline

This document describes every check, filter, silent sanitization, and user-visible
warning that runs on an `RGDAuthoringState` before or during YAML generation. It
covers the state as it exists after the implementation of spec 045 (including the
planned US8 bidirectional import from `parseRGDYAML`).

All checks are advisory unless marked **[FILTER]** (silently dropped from output).
None block YAML generation or copying.

---

## Layer 1 — Silent filters in `generateRGDYAML` (`generator.ts`)

These run unconditionally on every YAML generation. The user sees no warning —
invalid or incomplete data is simply omitted from the output.

| # | What is filtered | Condition | Behaviour |
|---|-----------------|-----------|-----------|
| F-1 | Resources | `res.id` is empty | Entire resource block omitted from `spec.resources[]` |
| F-2 | Spec fields | `field.name` is empty | Field line omitted from `spec.schema.spec` |
| F-3 | Status fields | `sf.name` or `sf.expression` is empty | Status field line omitted from `spec.schema.status` |
| F-4 | forEach iterators | `it.variable` or `it.expression` is empty | Iterator entry omitted from `forEach:` array |
| F-5 | readyWhen entries | Entry is empty or whitespace-only | Entry omitted from `readyWhen:` array |
| F-6 | includeWhen | Value is empty or whitespace-only | `includeWhen:` block omitted entirely |
| F-7 | `scope` key | `scope === 'Namespaced'` (the default) | `scope:` line omitted — only `Cluster` is emitted |
| F-8 | `group` key | `group === 'kro.run'` (the default) | `group:` line omitted — only non-default values emitted |
| F-9 | `spec.schema.spec` block | `specFields` array is empty | Entire `spec:` sub-block omitted |
| F-10 | `spec.schema.status` block | No status fields pass F-3 | Entire `status:` sub-block omitted |
| F-11 | `spec.resources` block | `resources` array is empty after F-1 | Entire `resources:` block omitted |

**Source**: `generator.ts:553–688` (`generateRGDYAML`)

---

## Layer 2 — Silent filters in `rgdAuthoringStateToSpec` (`generator.ts`)

These run when building the spec object for the **live DAG preview** (debounced at
300ms). Same semantics as Layer 1 — invalid rows are dropped silently so the DAG
never sees them.

| # | What is filtered | Condition |
|---|-----------------|-----------|
| D-1 | Resources | `res.id` is empty |
| D-2 | forEach iterators | `it.variable` or `it.expression` is empty |
| D-3 | readyWhen entries | Entry is whitespace-only |
| D-4 | includeWhen | Value is empty/whitespace |
| D-5 | Spec schema fields | `field.name` is empty |

**Source**: `generator.ts:750–825` (`rgdAuthoringStateToSpec`)

---

## Layer 3 — User-visible validation in `validateRGDState` (`generator.ts`)

Runs synchronously on every render of `RGDAuthoringForm`. Results are shown as
inline advisory messages adjacent to the affected inputs. **All are advisory —
YAML generation is never blocked.**

Summary badge (`data-testid="validation-summary"`) shows total issue count when > 0.

### Metadata checks

| # | Check | Condition | Type | Message shown |
|---|-------|-----------|------|---------------|
| V-1 | RGD name required | `rgdName === ''` | **error** | "RGD name is required" |
| V-2 | RGD name format | Non-empty but fails RFC 1123 DNS subdomain regex or contains `--` | warning | "RGD name should be a valid DNS subdomain (lowercase alphanumeric and hyphens)" |
| V-3 | Kind required | `kind === ''` | **error** | "Kind is required" |
| V-4 | Kind format | Non-empty but fails `/^[A-Z][a-zA-Z0-9]*$/` | warning | "Kind should be PascalCase (e.g. WebApp, MyService)" |

### Resource-level checks

| # | Check | Condition | Type | Message shown | Location |
|---|-------|-----------|------|---------------|----------|
| V-5 | Duplicate resource ID | Two or more resources share the same non-empty `id` | warning | "Duplicate resource ID" | Beneath `id` input on each offending resource row |
| V-6 | forEach needs iterator | `resourceType === 'forEach'` AND no iterator has both `variable` + `expression` non-empty | warning | "forEach resources require at least one iterator" | Beneath `id` input on that resource row |

> **Priority rule**: V-5 takes priority over V-6 on the same resource row. A
> forEach resource with a duplicate ID only shows V-5.

### Spec field checks

| # | Check | Condition | Type | Message shown | Location |
|---|-------|-----------|------|---------------|----------|
| V-7 | Duplicate spec field name | Two or more spec fields share the same non-empty `name` | warning | "Duplicate spec field name" | Beneath `name` input on each offending row |
| V-8 | min > max constraint | `minimum` and `maximum` both set and `Number(minimum) > Number(maximum)` | warning | "minimum must be ≤ maximum" | Inside the expanded constraints panel |

> **Priority rule**: V-7 takes priority over V-8 on the same field row.

### Status field checks

| # | Check | Condition | Type | Message shown | Location |
|---|-------|-----------|------|---------------|----------|
| V-9 | Duplicate status field name | Two or more status fields share the same non-empty `name` | warning | "Duplicate status field name" | Beneath `name` input on each offending row |

**Source**: `generator.ts:218–344` (`validateRGDState`)

---

## Layer 4 — Template heuristic in `RGDAuthoringForm` (component)

A lightweight structural check on the raw `templateYaml` textarea content to
warn the user that the DAG may be missing edges.

| # | Check | Condition | Type | Message shown | Location |
|---|-------|-----------|------|---------------|----------|
| T-1 | Template not parseable | `templateYaml` is non-empty AND does not contain any `word:` pattern (`/^\s*\w+\s*:/m`) | warning | "⚠" icon on the "Edit template" button | Template editor toggle button |

This is intentionally minimal — it only detects completely unparseable content
(e.g., free-form text, JSON without colons). Valid YAML that happens to have no
CEL references will pass this check silently.

**Source**: `RGDAuthoringForm.tsx:675–677`

---

## Layer 5 — Import guard in `parseRGDYAML` (planned — US8)

Runs when the user pastes YAML into the import panel and clicks "Apply".
Returns `{ ok: false, error }` on any structural problem; form state is not
changed.

| # | Check | Condition | Error shown |
|---|-------|-----------|-------------|
| I-1 | Empty input | YAML is empty or whitespace-only | "Empty input" |
| I-2 | Not an RGD | `kind: ResourceGraphDefinition` not present in input | "Not a ResourceGraphDefinition" |
| I-3 | Missing schema | `spec.schema` block absent | "Missing spec.schema" |
| I-4 | Parse exception | Any JavaScript exception during line parsing | "Parse failed: \<message\>" |

On `{ ok: true }` the form state is fully replaced and the panel collapses.

**Source**: `generator.ts` (to be added — spec FR-011)

---

## Summary: what is and isn't checked

### Checked / surfaced
- Empty required metadata (`rgdName`, `kind`) — **error**
- Bad format on metadata (`rgdName` DNS subdomain, `kind` PascalCase) — **warning**
- Duplicate resource IDs — **warning** (structural YAML error at kro apply time)
- forEach with no valid iterator — **warning** (kro rejects `forEach: []`)
- Duplicate spec/status field names — **warning** (last-write-wins, silently broken)
- Constraint inversion (`min > max`) — **warning** (kro schema parse error)
- Unparseable template body — **warning** (DAG edges may be missing)
- Non-RGD / malformed YAML on import — **error** (import blocked)

### Silently filtered (never shown to user, never causes YAML error)
- Unnamed resources, fields, status fields, iterators — dropped from output
- Default `scope` / `group` values — omitted from output (correct kro behaviour)
- Empty `readyWhen` / `includeWhen` entries — dropped from output
- Empty `forEach` iterators — dropped from output (only named, filled pairs emitted)

### Not checked (known gaps)
- CEL expression syntax validity (e.g. unclosed `${`) — emitted verbatim; kro
  rejects at runtime. No static CEL linter exists in the UI.
- `enum` values that don't match `type` (e.g. `enum=1,2` on a `string` field) —
  not validated; kro may reject at schema validation time.
- `pattern` regex validity — not validated; an invalid regex is emitted verbatim.
- `readyWhen` / `includeWhen` CEL expression syntax — no static check.
- `externalRef` completeness (e.g. both `name` and `selectorLabels` empty) —
  silently emits an incomplete `metadata:` block; kro rejects at apply time.
- Resource `apiVersion` / `kind` format — not validated.
- Circular CEL references between resources (e.g., A references B, B references A)
  — not detected; kro's reconciler handles this at runtime.
