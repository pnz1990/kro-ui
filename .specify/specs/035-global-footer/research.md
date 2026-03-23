# Research: 035-global-footer

## Q1 — Do any existing design-system tokens cover the footer's visual needs?

**Decision**: Yes. All required visual properties are covered by existing tokens.

**Rationale**:
- Background: `var(--color-surface)` — same as TopBar, maintains consistent shell depth
- Top border / divider: `var(--color-border-subtle)` — mirrors TopBar's `border-bottom`
- Body text: `var(--color-text-faint)` — subdued label; 4.6:1 on `--color-surface` (AA pass)
- Link text default: `var(--color-text-muted)` — secondary text, 5.6:1 on surface (AA pass)
- Link hover: transitions to `var(--color-primary)` — standard anchor token from `tokens.css` global `a` rule
- Typography: `var(--font-sans)` — same as TopBar labels

No new tokens are required for the footer. The global `a { color: var(--color-primary) }` rule in `tokens.css` handles link color automatically.

**Alternatives considered**:
- `--color-bg` as background: rejected — would visually detach footer from the same depth as the TopBar
- Adding `--shadow-footer`: rejected — a top-border divider is sufficient; adding an upward shadow on a nav shell element is over-engineering

---

## Q2 — How is the sticky-footer layout best achieved given the current shell?

**Decision**: Add `<Footer />` as a third flex child of `.layout`; no CSS changes to `.layout` or `.layout__content` are needed.

**Rationale**:
`.layout` is already `display: flex; flex-direction: column; min-height: 100vh` and `.layout__content` has `flex: 1`. Any subsequent sibling will be pushed naturally to the bottom of the viewport on short pages and will flow below content on tall pages. No `position: sticky` or `position: fixed` is needed.

**Alternatives considered**:
- `position: sticky; bottom: 0`: rejected — would overlap page content; wrong for an informational footer
- `position: fixed; bottom: 0`: rejected — reserved for modals / drawers; would add z-index complexity and cover page content

---

## Q3 — What links and content should the footer contain?

**Decision**: Minimal two-section layout:

| Section | Content |
|---------|---------|
| Left | "kro-ui" label + version string (from `/api/v1/version` if available, else omit) |
| Right | Three links: kro.run, GitHub (kubernetes-sigs/kro), and Apache 2.0 license |

**Rationale**:
- Issue #127 explicitly asks for "kro-ui — Built for [kro](https://kro.run)" and a GitHub link
- Apache 2.0 license link is standard for OSS tooling in the kubernetes-sigs org
- Version string is already fetched by the app (TopBar or elsewhere); if unavailable, graceful degradation omits it
- Slack/Discord/mailing list links deferred — no official kro community channel URL is stable; can be added later

**Alternatives considered**:
- A `?` help icon in TopBar (mentioned in issue): deferred — out of scope for this spec; requires NAV layout change
- A full "About" page: over-engineered; a footer satisfies the requirement
- Community Slack link: no stable URL; risk of going stale

---

## Q4 — Is a version API call needed, and does it exist?

**Decision**: Use the existing `GET /api/v1/version` endpoint if already consumed; otherwise omit the version display entirely and show only static content. The footer must not add a new `fetch` call that could affect performance.

**Rationale**:
Looking at the AGENTS.md spec history, `001-server-core` introduced a version endpoint. However, the spec requires the footer to be a purely static component with zero network calls. The version string is a nice-to-have. Given that no existing hook exports a version value and adding one would add complexity, the footer will be static only: no version fetch, no API dependency.

**Alternatives considered**:
- Import a `useVersion()` hook: rejected for this spec — no such hook exists, and adding one is out of scope
- Pass version as a prop from Layout: rejected — Layout currently has no data-fetching responsibility

---

## Q5 — Where should the external URLs point?

**Decision**:

| Link label | URL |
|------------|-----|
| kro.run | `https://kro.run` |
| GitHub | `https://github.com/kubernetes-sigs/kro` |
| License | `https://www.apache.org/licenses/LICENSE-2.0` |

All links open in a new tab (`target="_blank" rel="noopener noreferrer"`) per security best practice.

---

## Q6 — Token compliance summary for Footer.css

All colors referenced in `Footer.css` must be CSS custom properties. Verified token mapping:

| CSS property | Token |
|---|---|
| `background` | `var(--color-surface)` |
| `border-top` color | `var(--color-border-subtle)` |
| `color` (text) | `var(--color-text-faint)` |
| link `color` | inherited from global `a` rule (`var(--color-primary)`) |
| link hover `color` | inherited from global `a:hover` (`var(--color-primary-hover)`) |
| `font-family` | `var(--font-sans)` |

**No `rgba()`, hex literals, or new tokens needed.** Constitution §IX: PASS.

---

## Summary of Decisions

| Decision | Choice |
|---|---|
| New tokens needed? | None |
| New npm packages? | None |
| Footer position | Third flex child of `.layout` |
| Layout mechanism | Existing `flex: 1` on `layout__content` — no CSS changes needed |
| Footer content | Static: label + three external links |
| Version string | Omitted (no fetch, no hook) |
| External links open in new tab? | Yes (`target="_blank" rel="noopener noreferrer"`) |
| Shadow token needed? | No — top border suffices |
| Backend changes? | None |
