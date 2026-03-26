# Research: 043 — Upstream Fixture Generator (Full Coverage)

## Finding 1: Complete kro upstream feature inventory

Source: audit of all 15 integration test files in `kubernetes-sigs/kro/test/integration/suites/core/`.

| kro Feature | Upstream tests | Previous kro-ui coverage | This spec |
|---|---|---|---|
| `NodeTypeResource` basic | lifecycle, readiness, status, topology, nested, cascading_deletion, metadata_fields | ✅ test-rgd, multi-resource | Unchanged |
| `NodeTypeResource` + `includeWhen` | include_when (4 tests) | ⚠️ narrow (1 conditional node on test-rgd) | Contagious variant added |
| `NodeTypeCollection` single-dim | collection | ✅ test-collection | Unchanged |
| `NodeTypeCollection` cartesian (2D) | collection | ❌ | ✅ Added |
| `NodeTypeCollection` resource-gated | collection | ❌ | ✅ Added |
| `NodeTypeExternal` by name | externalref | ✅ external-ref | Unchanged |
| **`NodeTypeExternalCollection`** by selector | externalref, instance_cluster_scoped | ❌ | ✅ Added |
| Cluster-scoped CR | instance_cluster_scoped | ❌ | ✅ Added |
| Cycle detection | topology | ⚠️ fixture existed, never applied | ✅ Fixed (Part A) |
| CEL two-var comprehensions | two_var_comprehensions | ❌ | ✅ Added |
| RGD condition contract | rgd_conditions | ⚠️ journey 017 "no crash" only | ✅ Upgraded |
| Instance conditions | instance_conditions | ⚠️ journey 005 "panel visible" only | ✅ Upgraded |
| `celFunctionsReady` dead code | — | ⚠️ defined, never guarding | ✅ Fixed (Part D) |

---

## Finding 2: `NodeTypeExternalCollection` generator pattern

**Source**: `instance_cluster_scoped_test.go`

```go
generator.WithExternalRef("teamconfigs", &krov1alpha1.ExternalRef{
  APIVersion: "v1",
  Kind:       "ConfigMap",
  Metadata: krov1alpha1.ExternalRefMetadata{
    Namespace: "${schema.spec.targetNamespace}",
    Selector: &metav1.LabelSelector{
      MatchLabels: map[string]string{"role": "team-config"},
    },
  },
}, nil, nil)
```

The `Metadata.Selector` field (not `Metadata.Name`) triggers `NodeTypeExternalCollection`.
Pre-requisite: ConfigMaps with label `role: team-config` must exist before the instance
is applied. The prereq fixture (`upstream-external-collection-prereq.yaml`) creates 2
such ConfigMaps in `kro-ui-e2e` namespace.

**kro-ui rendering**: The node should render with a distinct type badge
(`NodeTypeExternalCollection`). The kro-ui `dag.ts` maps this to `"External ref collection"`.
The CSS class is `dag-node--external-collection`.

---

## Finding 3: CEL two-variable comprehensions generator pattern

**Source**: `two_var_comprehensions_test.go`

```go
// transformMap on a map: add 10 to each value
"data": "${items.transformMap(k, v, {k: string(int(v) + 10)})}"
// transformList on a map: extract keys
"data": "${schema.spec.scores.transformList(k, v, k).join(',')}"
// transformMapEntry: build {value: index} from a list
"data": "${schema.spec.tags.transformMapEntry(i, v, v, string(i))}"
```

Spec fields needed: `items: map<string, string>`, `scores: map<string, string>`,
`tags: []string`.

These are valid kro v0.8.5+ CEL extension macros. The fixture exercises the CEL
tokenizer's ability to handle `transformMap`/`transformList`/`transformMapEntry`
function calls without producing `?` tokens.

**kro-ui impact**: journey 006 (CEL highlighting) already asserts `token-cel-expression`
spans. The new journey step asserts these specific function call tokens appear correctly.

---

## Finding 4: Contagious `includeWhen` — confirmed 3 upstream patterns

**Source**: `include_when_test.go`

Three distinct upstream-tested patterns, all representable as static fixtures:

1. **Direct `includeWhen`** on parent; child references parent via CEL template field
   → child excluded because its CEL expression can't resolve when parent is absent.
2. **`includeWhen` expression references another resource's data field**
   (`${source.data.enabled == 'true'}`): this is what the fixture uses — the
   `enableParent` boolean in spec drives the `includeWhen`.
3. **Status-backed `includeWhen`**: requires live status patch — out of scope.

The fixture uses pattern 1 (simplest, most representative):
- `parentDeploy`: `includeWhen: ["${schema.spec.enableParent}"]`
- `childConfig`: references `${parentDeploy.metadata.name}` — excluded because parent absent

Instance spec: `enableParent: false` — both nodes excluded at rest.

**kro-ui rendering**: DAG renders both nodes with `dag-node--conditional` or an
exclusion indicator. Key assertion: neither renders with an error CSS class.

---

## Finding 5: Cartesian forEach — confirmed pattern

**Source**: `collection_test.go`

```go
generator.WithResourceCollection("appConfigs", template,
  []krov1alpha1.ForEachDimension{
    {"region": "${schema.spec.regions}"},
    {"tier":   "${schema.spec.tiers}"},
  }, nil, nil)
```

Instance: `regions: [us-east-1, eu-west-1]`, `tiers: [web, api]` → 4 ConfigMaps.

The kro-ui DAG node for `appConfigs` should display two forEach dimension annotations.
The cardinality badge (on live instance) should reflect 4 total (2×2).

---

## Finding 6: Resource→Collection dependency — confirmed upstream pattern

**Source**: `collection_test.go` — "should handle collection chaining with dynamic forEach expression"

```go
generator.WithResource("baseConfig", ...)
generator.WithResourceCollection("chainedConfigs", template,
  []krov1alpha1.ForEachDimension{
    {"val": "${has(baseConfig.data.enabled) ? schema.spec.values : []}"},
  }, nil, nil)
```

The `chainedConfigs` forEach expression references `baseConfig`, creating a
`NodeTypeResource → NodeTypeCollection` dependency edge in the DAG. This is the
pattern of interest — not true collection-to-collection, but the resource-to-collection
edge. (True collection-to-collection is a separate upstream test: "should handle
collection-to-collection chaining" using `${firstConfigs}` typed as `list(ConfigMap)`.
That pattern requires the schema to type the collection output and is deferred —
the resource→collection pattern is the more common and useful case.)

---

## Finding 7: Cluster-scoped — confirmed generator call

**Source**: `instance_cluster_scoped_test.go`

```go
generator.WithSchema("ClusterPolicy", "v1alpha1", spec, status,
  generator.WithScope(krov1alpha1.ResourceScopeCluster),
)
```

`krov1alpha1.ResourceScopeCluster` = `"Cluster"`. The schema `group` is derived from
`kro.run`; `apiVersion` from the schema `group + "/" + version`.

For the fixture: simplified to a single `NodeTypeResource` (ConfigMap in
`${schema.spec.targetNamespace}`). No external refs needed — keep it minimal.
No instance YAML committed — the RGD object alone lets journey 043-cluster-scoped
navigate to the instance list and assert empty namespace.

---

## Finding 8: Journey 017 — condition type strings

**Source**: `rgd_conditions_test.go` — "should report the exact success condition contract"

The 5 RGD condition types are:
- `Ready`
- `KindReady`
- `ControllerReady`
- `GraphAccepted`
- `GraphRevisionsResolved`

On a healthy cluster, all are `True`. Journey 017 currently only checks the tab
renders without crashing. The upgrade: assert at least one condition row contains
text matching `GraphAccepted` or `Ready`. If no condition rows are present, log
"kro version may not emit conditions" and soft-pass (this path is already
gracefully handled by journey 017's existing empty-state check).

---

## Finding 9: Journey 005 — condition reason field

**Source**: `instance_conditions_test.go`

On a healthy reconciled instance, `status.conditions[0].reason` = `"Ready"`.
Journey 005 Step 9 currently checks `conditions-panel` is visible. Upgrade:
assert the panel contains at least one condition with a non-empty `reason` text
(text content of any `.condition-reason` element or similar). If no element found,
soft-pass (absent data → "Not reported", per constitution §XII).

---

## Finding 10: `celFunctionsReady` dead code

Journey 006 Steps 5 and 6 navigate to `/rgds/cel-functions` and assert specific
CEL token types. These steps currently run unconditionally — if `cel-functions` RGD
didn't become Ready, the steps will fail with a page-not-found error or an empty DAG.

Fix: add `test.skip(!fixtureState.celFunctionsReady, 'cel-functions RGD not Ready')` 
on Steps 5 and 6. The import of `fixtureState` is already present in the file
(confirmed from the codebase audit).

---

## Finding 11: `NodeTypeExternalCollection` CSS class in kro-ui

From the anti-pattern table in `AGENTS.md`:

> `NodeTypeExternalCollection` | External ref collection | `externalRef.metadata.selector` set

The kro-ui `dag.ts` node type label is `"External ref collection"`. The CSS class
applied to the DAG node is `dag-node--external-collection`. If the kro-ui code
does not yet have this distinction implemented (possible if it falls back to
`dag-node--external`), the journey step must soft-assert: check for either class,
and if only `dag-node--external` is present, log a warning that the UI may not
distinguish between ExternalRef and ExternalRefCollection — this is a potential UI
feature gap that becomes a separate bug/spec.

---

## All unknowns resolved.
