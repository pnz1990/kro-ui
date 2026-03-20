# kro-ui Constitution

## I. Iterative-First (NON-NEGOTIABLE)

Build the smallest working thing, then expand. Every feature must be shippable before the next one starts. No spec, plan, or task may depend on unimplemented prior work. Each iteration must leave the app in a runnable, deployable state.

## II. Cluster Adaptability

kro evolves rapidly. All cluster access MUST use the Kubernetes dynamic client and server-side discovery. No hardcoded API group versions, field paths, or resource kinds outside of a single, isolated mapping layer. When kro adds a new CRD (e.g., GraphRevision), the UI must pick it up with zero or minimal code changes.

## III. Read-Only

kro-ui is an observability tool. It MUST NOT mutate any cluster resource. No `create`, `update`, `patch`, `delete`, or `apply` operations. The RBAC rules in the Helm chart must enforce this at the cluster level.

## IV. Single Binary Distribution

The Go binary embeds the frontend via `go:embed`. There is no separate static file server, no CDN, no external asset fetching at runtime. The binary must run with `./kro-ui serve` and work offline after download.

## V. Simplicity Over Cleverness

No ORMs, no GraphQL, no state management libraries (no Redux, Zustand, Jotai). The API layer is plain REST with polling. The frontend uses React + React Router only. Add a dependency only when the alternative is significantly more complex.

## VI. Theme Alignment

The UI MUST use the kro.run color palette (`#5b7fc9` primary, `#1b1b1d` dark background). Dark mode is the default. The kro CEL/schema highlighter token colors must match kro.run exactly. No generic code highlighting libraries (no highlight.js, no Prism).

## VII. Spec Before Code (NON-NEGOTIABLE)

Every feature starts with a spec. No implementation begins without a corresponding `.specify/specs/NNN-feature-name/spec.md`. Tasks are derived from the spec, not invented during coding.

## Constraints

- **Go version**: 1.25+
- **Frontend**: React 19 + Vite + TypeScript (strict mode)
- **No CSS frameworks**: Tailwind, Bootstrap, MUI are prohibited. Plain CSS with CSS custom properties only.
- **Port**: 10174 (k=10, r=17, o=14 with A=0)
- **Image size target**: < 20MB final Docker image

## Governance

This constitution supersedes all implementation decisions. Any deviation requires a comment in the relevant spec explaining the exception and why it is justified. The constitution is reviewed when a new major feature is added.

**Version**: 1.0.0 | **Ratified**: 2026-03-20 | **Last Amended**: 2026-03-20
