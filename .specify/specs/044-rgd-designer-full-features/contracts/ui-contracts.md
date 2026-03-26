# UI Contracts: 044-rgd-designer-full-features

**Branch**: `044-rgd-designer-full-features`
**Date**: 2026-03-26

---

## Component: `RGDAuthoringForm` (extended)

**File**: `web/src/components/RGDAuthoringForm.tsx`

### Props (unchanged)
```typescript
interface RGDAuthoringFormProps {
  state: RGDAuthoringState
  onChange: (state: RGDAuthoringState) => void
}
```

### Layout — new sections

```
┌─────────────────────────────────────┐
│ METADATA                            │
│  RGD name, Kind, Group, apiVersion  │
│  Scope: ○ Namespaced  ● Cluster     │ ← NEW
├─────────────────────────────────────┤
│ SPEC FIELDS                         │
│  [name] [type▼] [default] [Req] [×] │
│    ▸ Constraints (expand)           │ ← NEW
│  + Add Field                        │
├─────────────────────────────────────┤
│ STATUS FIELDS                       │ ← NEW SECTION
│  [name] [CEL expression input] [×]  │
│  + Add Status Field                 │
├─────────────────────────────────────┤
│ RESOURCES                           │
│  [id] [apiVersion] [kind]           │
│  Type: [Managed▼] [×]               │ ← NEW toggle
│  ▸ Edit template  ▸ Advanced options│ ← NEW expansions
│  + Add Resource                     │
└─────────────────────────────────────┘
```

---

## Contract: Metadata section

| Element | data-testid | Notes |
|---|---|---|
| Scope radio "Namespaced" | `scope-namespaced` | Checked by default |
| Scope radio "Cluster" | `scope-cluster` | Emits `scope: Cluster` in YAML |

---

## Contract: Spec Fields section

| Element | data-testid | Notes |
|---|---|---|
| Field row expand button | `field-expand-{id}` | Reveals constraint inputs |
| `enum` input | `field-enum-{id}` | Comma-separated, string type only |
| `minimum` input | `field-min-{id}` | Number input, integer/number type |
| `maximum` input | `field-max-{id}` | Number input, integer/number type |
| `pattern` input | `field-pattern-{id}` | Regex string, string type only |

---

## Contract: Status Fields section

| Element | data-testid | Notes |
|---|---|---|
| Section container | `status-fields-section` | |
| Add status field button | `add-status-field-btn` | |
| Status field name input | `status-field-name-{id}` | |
| Status field expression input | `status-field-expr-{id}` | monospace, CEL-badge |
| Remove status field button | `status-field-remove-{id}` | |

**Behavior**:
- Empty `name` OR empty `expression` → row not serialized in YAML
- Status section appears only when `statusFields.length > 0` or always (rendered
  as empty with just the "+ Add" button — matches Spec Fields section pattern)

---

## Contract: Resource row — extended

| Element | data-testid | Notes |
|---|---|---|
| Resource type select | `resource-type-{_key}` | `managed`, `forEach`, `externalRef` |
| Template expand toggle | `template-expand-{_key}` | Reveals textarea |
| Template textarea | `template-body-{_key}` | `font-family: var(--font-mono)` |
| Advanced options toggle | `advanced-expand-{_key}` | Reveals includeWhen + readyWhen |
| `includeWhen` input | `resource-include-when-{_key}` | CEL, monospace |
| readyWhen add button | `readywhen-add-{_key}` | |
| readyWhen expression input (row i) | `readywhen-expr-{_key}-{i}` | |
| readyWhen remove (row i) | `readywhen-remove-{_key}-{i}` | |

### forEach mode

| Element | data-testid | Notes |
|---|---|---|
| forEach iterator variable input (row i) | `foreach-var-{_key}-{i}` | |
| forEach iterator expression input (row i) | `foreach-expr-{_key}-{i}` | |
| forEach add iterator button | `foreach-add-{_key}` | |
| forEach remove iterator (row i) | `foreach-remove-{_key}-{i}` | |

### externalRef mode

| Element | data-testid | Notes |
|---|---|---|
| externalRef apiVersion input | `extref-apiver-{_key}` | |
| externalRef kind input | `extref-kind-{_key}` | |
| externalRef namespace input | `extref-ns-{_key}` | Optional |
| externalRef type radio "By name" | `extref-byname-{_key}` | |
| externalRef type radio "By selector" | `extref-byselector-{_key}` | |
| externalRef name input | `extref-name-{_key}` | Shown when By name |
| Selector label key input (row i) | `extref-label-key-{_key}-{i}` | Shown when By selector |
| Selector label value input (row i) | `extref-label-val-{_key}-{i}` | |
| Selector add label button | `extref-label-add-{_key}` | |
| Selector remove label (row i) | `extref-label-remove-{_key}-{i}` | |

---

## Contract: `generateRGDYAML` — YAML output shape

### With `scope: Cluster`
```yaml
spec:
  schema:
    apiVersion: v1alpha1
    kind: MyKind
    scope: Cluster
    spec:
      ...
```

### With `statusFields`
```yaml
spec:
  schema:
    apiVersion: v1alpha1
    kind: MyKind
    spec:
      name: string
    status:
      endpoint: ${service.spec.clusterIP}
      replicas: ${deploy.status.availableReplicas}
```

### With `includeWhen` on a resource
```yaml
  resources:
    - id: monitor
      includeWhen:
        - ${schema.spec.monitoring}
      template:
        apiVersion: monitoring.coreos.com/v1
        kind: ServiceMonitor
        ...
```

### With `readyWhen` on a resource
```yaml
  resources:
    - id: database
      readyWhen:
        - ${database.status.endpoint != ""}
      template:
        apiVersion: db.example.com/v1
        kind: PostgreSQL
        ...
```

### With `forEach` (single iterator)
```yaml
  resources:
    - id: regionConfig
      forEach:
        - region: ${schema.spec.regions}
      template:
        apiVersion: v1
        kind: ConfigMap
        metadata:
          name: ${schema.metadata.name}-${region}-config
        spec: {}
```

### With `forEach` (cartesian product, 2 iterators)
```yaml
  resources:
    - id: appConfigs
      forEach:
        - region: ${schema.spec.regions}
        - tier: ${schema.spec.tiers}
      template:
        apiVersion: v1
        kind: ConfigMap
        metadata:
          name: ${schema.metadata.name}-${region}-${tier}
        spec: {}
```

### With `externalRef` (scalar)
```yaml
  resources:
    - id: platformConfig
      externalRef:
        apiVersion: v1
        kind: ConfigMap
        metadata:
          name: platform-config
          namespace: platform-system
```

### With `externalRef` (collection)
```yaml
  resources:
    - id: teamConfigs
      externalRef:
        apiVersion: v1
        kind: ConfigMap
        metadata:
          namespace: platform-system
          selector:
            matchLabels:
              role: team-config
```

### With `templateYaml` (non-empty template body)
```yaml
  resources:
    - id: web
      template:
        apiVersion: apps/v1
        kind: Deployment
        metadata:
          name: ${schema.metadata.name}-web
          namespace: ${schema.metadata.namespace}
        spec:
          replicas: ${schema.spec.replicas}
          selector:
            matchLabels:
              app: ${schema.metadata.name}
          template:
            metadata:
              labels:
                app: ${schema.metadata.name}
            spec:
              containers:
                - name: app
                  image: ${schema.spec.image}
```

### Template body injection rules
- `templateYaml` is indented 8 spaces (4 levels at 2 spaces each) when injected under `template:`
- The `metadata.name` and `metadata.namespace` placeholders are prepended by
  the generator when `templateYaml` does NOT already contain a `metadata:` line
- If `templateYaml` DOES contain `metadata:`, the generator injects the raw string
  as-is (trusting the user), omitting the default `metadata:` lines

---

## Contract: `rgdAuthoringStateToSpec` — DAG spec shape

For `buildDAGGraph` to correctly classify nodes:

### forEach resource
```javascript
{
  id: 'regionConfig',
  forEach: [{ region: '${schema.spec.regions}' }],
  template: {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name: '' },
    _raw: '...templateYaml string...',
  },
  includeWhen: ['${expr}'],   // optional
}
```

### externalRef (scalar)
```javascript
{
  id: 'platformConfig',
  externalRef: {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name: 'platform-config', namespace: 'platform-system' },
  },
}
```

### externalRef (collection)
```javascript
{
  id: 'teamConfigs',
  externalRef: {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      namespace: 'platform-system',
      selector: { matchLabels: { role: 'team-config' } },
    },
  },
}
```

---

## Contract: Live DAG node types

After `rgdAuthoringStateToSpec` is extended, the live DAG preview correctly shows:

| Designer config | `classifyResource` result | DAG node style |
|---|---|---|
| `resourceType: 'managed'` | `'resource'` | Rectangle, solid border |
| `resourceType: 'managed'` + `includeWhen` set | `'resource'`, `isConditional: true` | Rectangle, dashed border or `?` indicator |
| `resourceType: 'forEach'` | `'collection'` | Triangle / forEach badge |
| `resourceType: 'externalRef'` + name set | `'external'` | Circle |
| `resourceType: 'externalRef'` + selector set | `'externalCollection'` | Circle + collection badge |
