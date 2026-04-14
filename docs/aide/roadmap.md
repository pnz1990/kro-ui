# kro-ui: Development Roadmap

> Based on: docs/aide/vision.md

---

## Stage 0: Foundation — ✅ Complete

**Goal**: Core binary, dynamic k8s client, RGD/Instance API, basic React UI shell.

### Shipped
- Server core: binary, CLI, healthz, go:embed, ClientFactory, contexts API
- RGD list + detail: DAG visualization, YAML tab, instance table
- CEL highlighter, feature flags, context switcher
- Design system: tokens.css, color palette, typography

---

## Stage 1: Rich Observability — ✅ Complete

**Goal**: Deep visibility into kro resources — collections, events, fleet, validation, RBAC.

### Shipped
- Collection explorer (forEach drill-down), smart event stream
- Multi-cluster fleet view, RGD catalog with chaining detection
- Schema doc generator, RGD validation linting, RBAC visualizer
- Instance telemetry, error aggregation, health roll-up, DAG instance overlay
- Deletion debugger, RBAC SA auto-detection

---

## Stage 2: UX Polish + kro v0.9 — ✅ Complete

**Goal**: Production-ready UX, kro v0.9.x support, performance at scale.

### Shipped
- kro v0.9.0 + v0.9.1 upgrades (GraphRevision CRD, hash column, CEL hash functions)
- Degraded health state (6th state), multi-segment health bar
- Response cache (30s/10s/5min TTL), virtualization for 5,000+ RGDs
- Global instance search, overview SRE dashboard (7 widgets)
- 70+ E2E Playwright journeys across 9 parallel chunks
- Instance spec diff, RGD authoring (Designer), optimization advisor

---

## Stage 3: Ongoing — 🔄 Active

**Goal**: Keep up with kro upstream releases, fix issues as discovered, improve E2E coverage.

### Active
- Track kro upstream releases and apply UI changes as new CRDs/fields land
- Fix bugs reported via GitHub issues
- Expand E2E coverage for new features
- Performance and accessibility improvements

### Recently shipped (post-v0.9.4)
- Graph revision merged DAG diff — spec 009 fully implemented (PR #440, GH #13 closed)
- Production hardening — 15 security/correctness fixes (PR #441)
- Unit test coverage — 5 untested components + E2E journey 063 (PR #442)
- RGDDiffView "no changes" banner; extractExpressionsFromMap slice coverage (PR #443)

### Known gaps
- Any issues opened after v0.9.4

---

## Versioning Philosophy

Patch releases (v0.x.y) for bug fixes and minor UX polish.
Minor releases (v0.x.0) for new kro version support or significant new features.
No GA until donated to kubernetes-sigs org.
