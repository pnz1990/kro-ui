# Data Model: 043 — Upstream Fixture Generator (Full Coverage)

## New fixture families

### 1. Cartesian forEach (`upstream-cartesian-foreach`)

| Field | Value |
|-------|-------|
| RGD name | `upstream-cartesian-foreach` |
| CR kind | `CartesianApp` |
| CR group | `e2e.kro-ui.dev` |
| Scope | Namespaced |
| Namespace | `kro-ui-e2e` |
| Spec | `name: string`, `regions: []string`, `tiers: []string` |
| Resources | `appConfigs` — `NodeTypeCollection`, 2D forEach `[{region: regions}, {tier: tiers}]` |
| Instance spec | `regions: [us-east-1, eu-west-1]`, `tiers: [web, api]` → 4 ConfigMaps |
| `fixtureState` key | `cartesianReady` |

### 2. Resource→Collection dependency (`upstream-collection-chain`)

| Field | Value |
|-------|-------|
| RGD name | `upstream-collection-chain` |
| CR kind | `CollectionChain` |
| Scope | Namespaced |
| Namespace | `kro-ui-e2e` |
| Spec | `name: string`, `values: []string` |
| Resources | `baseConfig` (`NodeTypeResource`, ConfigMap), `chainedConfigs` (`NodeTypeCollection`, forEach refs `baseConfig`) |
| Instance spec | `values: [alpha, beta]` → 2 chained ConfigMaps |
| `fixtureState` key | `collectionChainReady` |

### 3. Contagious `includeWhen` (`upstream-contagious-include-when`)

| Field | Value |
|-------|-------|
| RGD name | `upstream-contagious-include-when` |
| CR kind | `ContagiousApp` |
| Scope | Namespaced |
| Namespace | `kro-ui-e2e` |
| Spec | `name: string`, `enableParent: boolean` |
| Resources | `parentDeploy` (`NodeTypeResource`, Deployment, `includeWhen: ["${schema.spec.enableParent}"]`), `childConfig` (`NodeTypeResource`, ConfigMap refs `${parentDeploy.metadata.name}`) |
| Instance spec | `enableParent: false` — both nodes excluded at rest |
| `fixtureState` key | `contagiousReady` |

### 4. Cluster-scoped CR (`upstream-cluster-scoped`)

| Field | Value |
|-------|-------|
| RGD name | `upstream-cluster-scoped` |
| CR kind | `ClusterApp` |
| Scope | **Cluster** (`krov1alpha1.ResourceScopeCluster`) |
| Spec | `name: string`, `targetNamespace: string` |
| Resources | `appConfig` (`NodeTypeResource`, ConfigMap placed in `${schema.spec.targetNamespace}`) |
| Instance | None committed — cluster-scoped CRs have no namespace; journey navigates to instance list which should be empty with correct no-namespace UI |
| `fixtureState` key | `clusterScopedReady` |

### 5. `NodeTypeExternalCollection` (`upstream-external-collection`)

| Field | Value |
|-------|-------|
| RGD name | `upstream-external-collection` |
| CR kind | `ExternalCollectionApp` |
| Scope | Namespaced |
| Namespace | `kro-ui-e2e` |
| Spec | `name: string`, `targetNamespace: string` |
| Resources | `teamConfigs` (`NodeTypeExternalCollection`, `externalRef.metadata.selector: {role: team-config}`), `summary` (`NodeTypeResource`, ConfigMap, refs `teamConfigs`) |
| Prereq | `upstream-external-collection-prereq.yaml` — 2 ConfigMaps with label `role: team-config` in `kro-ui-e2e` |
| Instance | Applied after prereq + RGD Ready; spec `{targetNamespace: kro-ui-e2e}` |
| `fixtureState` key | `externalCollectionReady` |

### 6. CEL two-variable comprehensions (`upstream-cel-comprehensions`)

| Field | Value |
|-------|-------|
| RGD name | `upstream-cel-comprehensions` |
| CR kind | `CelComprehensionsApp` |
| Scope | Namespaced |
| Namespace | `kro-ui-e2e` |
| Spec | `name: string`, `items: object` (map<string,string>), `scores: object`, `tags: []string` |
| Resources | `output` (`NodeTypeResource`, ConfigMap with data fields using `transformMap`, `transformList`, `transformMapEntry`) |
| Instance spec | `items: {a: "1", b: "2"}`, `scores: {x: "5"}`, `tags: [go, kro]` |
| `fixtureState` key | `celComprehensionsReady` |

---

## Extended `FixtureState` interface

```ts
interface FixtureState {
  // Existing
  collectionReady: boolean
  multiReady: boolean
  externalRefReady: boolean
  celFunctionsReady: boolean       // ← now actively used (journey 006 guards)
  // New (Part C)
  cartesianReady: boolean
  collectionChainReady: boolean
  contagiousReady: boolean
  clusterScopedReady: boolean
  externalCollectionReady: boolean
  celComprehensionsReady: boolean
}
```

---

## `cmd/dump-fixtures` output manifest

| Output file | Builder function | kro generator calls |
|-------------|----------------|---------------------|
| `upstream-cartesian-foreach-rgd.yaml` | `buildCartesianForEachRGD()` | `NewRGD` + `WithSchema` + `WithResourceCollection` (2 forEach dims) |
| `upstream-cartesian-foreach-instance.yaml` | `buildCartesianForEachInstance()` | plain `unstructured.Unstructured` |
| `upstream-collection-chain-rgd.yaml` | `buildCollectionChainRGD()` | `NewRGD` + `WithResource` + `WithResourceCollection` (ref-gated forEach) |
| `upstream-collection-chain-instance.yaml` | `buildCollectionChainInstance()` | plain `unstructured.Unstructured` |
| `upstream-contagious-include-when-rgd.yaml` | `buildContagiousIncludeWhenRGD()` | `NewRGD` + `WithResource` (includeWhen) + `WithResource` (child) |
| `upstream-contagious-include-when-instance.yaml` | `buildContagiousIncludeWhenInstance()` | plain `unstructured.Unstructured` |
| `upstream-cluster-scoped-rgd.yaml` | `buildClusterScopedRGD()` | `NewRGD` + `WithSchema(..., WithScope(Cluster))` + `WithResource` |
| `upstream-external-collection-rgd.yaml` | `buildExternalCollectionRGD()` | `NewRGD` + `WithExternalRef` (selector) + `WithResource` |
| `upstream-external-collection-prereq.yaml` | `buildExternalCollectionPrereq()` | plain `corev1.ConfigMap` × 2 |
| `upstream-cel-comprehensions-rgd.yaml` | `buildCelComprehensionsRGD()` | `NewRGD` + `WithResource` (transformMap/transformList/transformMapEntry in template data) |
| `upstream-cel-comprehensions-instance.yaml` | `buildCelComprehensionsInstance()` | plain `unstructured.Unstructured` |
