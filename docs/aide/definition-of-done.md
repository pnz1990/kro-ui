# Definition of Done

> The project is complete when every journey below passes end-to-end on a live kind cluster.

---

## Journey 1: Browse RGDs and inspect a DAG

**The user story**: A platform engineer connects kro-ui to a cluster with RGDs deployed
and can visually inspect the resource graph for any RGD.

### Steps

```bash
./kro-ui serve &
open http://localhost:40107
# Navigate to an RGD → Graph tab
# Verify DAG renders with correct node types and health states
```

### Pass criteria

- [ ] Overview page loads and shows RGD cards with health chips
- [ ] Clicking an RGD navigates to detail page with Graph tab
- [ ] DAG renders nodes with correct type labels and health colors
- [ ] Node click shows YAML panel with resource content

---

## Journey 2: Inspect a live instance

**The user story**: An SRE can drill into a specific instance, see its live health,
child resource states, conditions, and events.

### Steps

```bash
# From RGD detail → Instances tab → click an instance
# Verify Live DAG, Telemetry, Conditions, Events all load
```

### Pass criteria

- [ ] Instance detail page loads with per-node health states (6-state model)
- [ ] Conditions panel shows condition table (or "not reported")
- [ ] Events panel shows recent events grouped by resource
- [ ] Telemetry panel shows age, state, children health summary

---

## Journey 3: Multi-cluster fleet view

**The user story**: An operator with multiple kubeconfig contexts can see all clusters
in one view and switch between them.

### Steps

```bash
# Navigate to /fleet
# Verify cluster cards show per-context kro version and health matrix
# Use context switcher to switch clusters
```

### Pass criteria

- [ ] Fleet page shows a card per kubeconfig context
- [ ] Each card shows kro version, instance counts, health breakdown
- [ ] Context switcher dropdown appears and switches the active cluster

---

## Journey 4: Validate and author an RGD

**The user story**: A developer can use the RGD Designer to write a new RGD YAML
with live validation and CEL expression highlighting.

### Steps

```bash
# Navigate to /author
# Write a simple RGD YAML
# Verify validation feedback and CEL highlighting work
```

### Pass criteria

- [ ] /author route loads the RGD Designer
- [ ] CEL expressions are syntax-highlighted in the YAML editor
- [ ] Validation runs and surfaces errors inline
- [ ] Generated instance YAML is copyable

---

## Journey 5: Search instances globally

**The user story**: An SRE can find all instances of any type across all namespaces
from a single search page.

### Steps

```bash
# Navigate to /instances
# Apply health state filter and namespace filter
# Verify results are accurate
```

### Pass criteria

- [ ] /instances page loads with instance list
- [ ] Health state chips are clickable and filter the list
- [ ] Namespace dropdown filters correctly
- [ ] Instance name search works

---

## Journey Status

| Journey | Status | Notes |
|---|---|---|
| 1: Browse RGDs + DAG | ✅ Implemented | Covered by E2E journeys 002, 003 |
| 2: Inspect live instance | ✅ Implemented | Covered by E2E journeys 005, 027, 038 |
| 3: Multi-cluster fleet | ✅ Implemented | Covered by E2E journey 014 |
| 4: Author + validate RGD | ✅ Implemented | Covered by E2E journeys 039, 042, 044, 045 |
| 5: Global instance search | ✅ Implemented | Covered by E2E journey 058 |
