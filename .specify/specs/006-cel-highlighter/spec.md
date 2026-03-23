# Feature Specification: CEL / Schema Syntax Highlighter

**Feature Branch**: `006-cel-highlighter`
**Created**: 2026-03-20
**Status**: Merged
**Depends on**: none — this is a pure, standalone utility with no runtime deps
**Constitution ref**: §V (no external highlighting libraries), §IX (token colors
must match kro.run exactly), §VII (pure function`database` → fully unit testable)

---

## Context

kro uses a custom YAML dialect that interleaves standard Kubernetes YAML with:

1. **CEL expressions** wrapped in `${...}` — the "wires" connecting resources
2. **kro-specific structural keywords** (`id:`, `template:`, `readyWhen:`,
   `includeWhen:`, `forEach:`, `externalRef:`) — the orchestration layer
3. **SimpleSchema type annotations** (`string | default=primary | required`) —
   the schema definition language for generated CRDs

Standard YAML highlighters (Prism, highlight.js, shiki) do not understand any
of these constructs. The result is illegible output. kro.run's documentation
site uses a custom highlighter that makes RGD YAML immediately readable. This
spec defines a TypeScript port of that highlighter for use throughout kro-ui.

The token colors are sourced from kro.run's actual CSS (researched from
`kro.run/examples/aws/ack-eks-cluster`).

---

## User Scenarios & Testing

### User Story 1 — Developer reads an RGD YAML and immediately understands the structure (Priority: P1)

When viewing any kro YAML in kro-ui (RGD detail YAML tab, node detail panel),
the syntax highlighting makes the information hierarchy immediately apparent:
YAML scaffolding recedes, CEL expressions are prominent, kro concepts are
distinct from standard YAML keys.

**Why this priority**: This is what makes kro-ui feel like a first-class kro
tool rather than a generic YAML viewer. It is also required by specs 003 and 005.

**Independent Test**: Render the `web-service-graph` RGD YAML. Confirm `${...}`
expressions appear in blue, `readyWhen:` in dark slate, `string` type
annotations in pink/amber. The rendering matches kro.run's example page.

**Acceptance Scenarios**:

1. **Given** `${clusterVPC.status.vpcID}`, **When** tokenized, **Then** the
   entire `${...}` span (including nested content) is a single `celExpression`
   token rendered as `var(--hl-cel-expression)` — blue in dark mode (`#93c5fd`),
   blue in light mode (`#5b7fc9`)
2. **Given** a YAML key `apiVersion:`, **When** tokenized, **Then** it is a
   `yamlKey` token rendered as `var(--hl-yaml-key)` — warm gray
3. **Given** a kro keyword `readyWhen:`, **When** tokenized, **Then** it is a
   `kroKeyword` token rendered as `var(--hl-kro-keyword)` — dark slate;
   visually distinct from `apiVersion:` even though both end in `:`
4. **Given** `string | default=primary`, **When** tokenized, **Then**:
   - `string``database` → `schemaType` (`var(--hl-schema-type)`)
   - ` | ``database` → `schemaPipe` (`var(--hl-schema-pipe)`)
   - `default``database` → `schemaKeyword` (`var(--hl-schema-keyword)`)
   - `=``database` → plain text
   - `primary``database` → `schemaValue` (`var(--hl-schema-value)`)
5. **Given** a YAML comment `# CRD Schema`, **When** tokenized, **Then** it is
   a `comment` token rendered as `var(--hl-comment)`

---

### User Story 2 — Highlighting works in both dark and light mode (Priority: P2)

Token colors switch automatically when the theme changes. No re-render of the
YAML is required — CSS custom properties handle the switch.

**Why this priority**: Constitution §IX mandates both dark and light mode. The
highlighter must not hardcode hex values.

**Acceptance Scenarios**:

1. **Given** light mode is active (`data-theme="light"` on `<html>`), **When**
   any kro YAML renders, **Then** CEL expressions appear in `#5b7fc9` (light
   mode blue) — verified by CSS variable resolution
2. **Given** the user switches theme, **When** the page re-renders, **Then**
   token colors update without re-tokenizing the YAML (CSS variable change is
   sufficient)

---

### Edge Cases

- `${...}` spanning multiple lines`database` → entire span is one `celExpression` token
- `${` without a closing `}``database` → treat everything to end-of-line as plain text;
  do not crash
- Nested `${...}` (CEL inside CEL, rare but valid)`database` → outer `${` opens the span,
  first `}` closes it; inner is not specially handled
- Empty string input`database` → returns empty token array; `KroCodeBlock` renders an
  empty `<pre>`
- YAML with syntax errors`database` → render best-effort; do not throw; fall back to plain
  text for malformed spans
- Very long line (2000+ chars)`database` → tokenize without truncation; `<pre>` is
  scrollable horizontally via CSS

---

## Requirements

### Functional Requirements

- **FR-001**: `tokenize(yaml: string): Token[]` MUST be a pure function — no
  side effects, no external dependencies, deterministic
- **FR-002**: `Token` type: `{ type: TokenType; text: string }` where
  `TokenType` is a string union of the 8 types below
- **FR-003**: The 8 token types and their matching rules:

  | Token type | CSS variable | Matches |
  |------------|-------------|---------|
  | `celExpression` | `--hl-cel-expression` | Full `${...}` span including nested content |
  | `kroKeyword` | `--hl-kro-keyword` | Upstream kro keywords: `id:`, `template:`, `readyWhen:`, `includeWhen:`, `forEach:`, `externalRef:`, `scope:`, `types:` at line start or after whitespace |
  | `yamlKey` | `--hl-yaml-key` | Other `word:` patterns (standard YAML keys) |
  | `schemaType` | `--hl-schema-type` | `string`, `integer`, `boolean`, `number`, `object`, `array` as standalone words in a value position |
  | `schemaPipe` | `--hl-schema-pipe` | ` \| ` separator in SimpleSchema values |
  | `schemaKeyword` | `--hl-schema-keyword` | `default`, `required`, `min`, `max`, `pattern`, `enum` after a `\|` separator |
  | `schemaValue` | `--hl-schema-value` | Value after `=` in a SimpleSchema constraint |
  | `comment` | `--hl-comment` | `#` to end-of-line |

  **Note on upstream kro CEL variables**: the well-known variable names defined
  by upstream kro are:
  - `schema` — refers to the generated CR instance (e.g., `${schema.spec.replicas}`)
  - `each` — per-item iterator variable in `forEach` readyWhen/template expressions
  - `<resource-id>` — any resource's outputs referenced by ID

  `specPatch` is NOT an upstream kro keyword and MUST NOT appear in the keyword
  list or be specially highlighted.

- **FR-004**: Token colors MUST be applied via CSS custom properties only — no
  hardcoded hex values in the React component (constitution §IX)
- **FR-005**: `KroCodeBlock` React component:
  - Props: `code: string`, `language?: "yaml"`, `title?: string`
  - Renders `<pre>` with tokenized spans using CSS variables
  - Includes a copy-to-clipboard button (uses `navigator.clipboard.writeText`)
  - Optionally renders a title bar above the code block when `title` is provided
- **FR-006**: Dark mode token colors MUST exactly match kro.run's example page:

  | Token | Dark hex |
  |-------|----------|
  | `celExpression` | `#93c5fd` |
  | `kroKeyword` | `#d6d3d1` |
  | `yamlKey` | `#a8a29e` |
  | `schemaType` | `#e0c080` |
  | `schemaPipe` | `#78716c` |
  | `schemaKeyword` | `#94a3b8` |
  | `schemaValue` | `#c4b5dc` |
  | `comment` | `#6b6b6b` |

- **FR-007**: Light mode token colors MUST exactly match kro.run's light theme:

  | Token | Light hex |
  |-------|-----------|
  | `celExpression` | `#5b7fc9` |
  | `kroKeyword` | `#475569` |
  | `yamlKey` | `#6b7280` |
  | `schemaType` | `#be7b8a` |
  | `schemaPipe` | `#9ca3af` |
  | `schemaKeyword` | `#6b8cae` |
  | `schemaValue` | `#5b7fc9` |
  | `comment` | `#9ca3af` |

### Non-Functional Requirements

- **NFR-001**: `tokenize()` MUST process a 500-line RGD YAML in under 10ms
  (measured with `performance.now()` in a unit test)
- **NFR-002**: TypeScript strict mode — no `any`, no `@ts-ignore`
- **NFR-003**: No dependencies beyond the standard library — no regex engine
  library, no parser generator

### Key Entities

- **`tokenize`** (`web/src/lib/highlighter.ts`): pure function
- **`Token`**, **`TokenType`** (`web/src/lib/highlighter.ts`): types
- **`KroCodeBlock`** (`web/src/components/KroCodeBlock.tsx`): React component

---

## Testing Requirements

### Unit Tests (required before merge)

All tests use Vitest. The tokenizer is a pure function — it has 100% testable
behavior.

```typescript
// web/src/lib/highlighter.test.ts
describe("tokenize", () => {
  describe("celExpression", () => {
    it("tokenizes simple ${expr}", () => {
      const tokens = tokenize("name: ${foo.bar}")
      expect(tokens).toContainEqual({ type: "celExpression", text: "${foo.bar}" })
    })
    it("tokenizes ${expr} with nested dots", () => { ... })
    it("does NOT tokenize unclosed ${", () => { ... })
  })

  describe("kroKeyword", () => {
    it("tokenizes readyWhen: as kroKeyword", () => { ... })
    it("tokenizes forEach: as kroKeyword", () => { ... })
    it("tokenizes includeWhen: as kroKeyword", () => { ... })
    it("does NOT tokenize apiVersion: as kroKeyword", () => { ... })
  })

  describe("schemaType", () => {
    it("tokenizes string in value position", () => { ... })
    it("tokenizes integer in value position", () => { ... })
    it("does NOT tokenize 'string' inside a CEL expression", () => { ... })
  })

  describe("SimpleSchema constraint", () => {
    it("tokenizes 'string | default=primary' with all 4 token types", () => { ... })
    it("tokenizes 'integer | min=1 | max=10'", () => { ... })
  })

  describe("comment", () => {
    it("tokenizes # to end of line as comment", () => { ... })
    it("does NOT tokenize # inside a string value", () => { ... })
  })

  describe("performance", () => {
    it("tokenizes a 500-line YAML in under 10ms", () => {
      const yaml = generateLargeYaml(500)  // helper
      const start = performance.now()
      tokenize(yaml)
      expect(performance.now() - start).toBeLessThan(10)
    })
  })
})
```

---

## Success Criteria

- **SC-001**: All `${...}` CEL expressions in a `web-service-graph` YAML render in
  `var(--hl-cel-expression)` with the correct dark-mode hex `#93c5fd`
- **SC-002**: `readyWhen:`, `forEach:`, `includeWhen:`, `template:`, `id:` all
  tokenize as `kroKeyword` — verified by unit tests
- **SC-003**: Dark and light mode colors match kro.run exactly — verified by
  visual inspection against `kro.run/examples/aws/ack-eks-cluster`
- **SC-004**: 500-line YAML tokenized in under 10ms — verified by unit test with
  `performance.now()`
- **SC-005**: TypeScript strict mode passes with 0 errors
- **SC-006**: All tokenizer unit tests pass with `vitest run`

---

## E2E User Journey

**File**: `test/e2e/journeys/006-cel-highlighting.spec.ts`
**Browser**: Chromium (required — CSS custom property resolution via
`getComputedStyle` works in Chromium headless)
**Cluster pre-conditions**: kind cluster running, `test-app` RGD applied. The
`test-app` fixture YAML must contain at least one `${...}` CEL expression and
one `readyWhen:` field so token colors can be asserted.

### Journey: Operator reads highlighted kro YAML and token colors are correct

This journey uses Playwright's `evaluate()` + `getComputedStyle()` to assert
the actual rendered CSS color values of highlighted tokens — not just the
presence of CSS class names.

```
Step 1: Navigate to the YAML tab
  - Navigate to http://localhost:40107/rgds/test-app?tab=yaml
  - Assert: [data-testid="kro-code-block"] is visible

Step 2: CEL expression token is the correct blue
  - Locate the first span.token-cel inside [data-testid="kro-code-block"]
  - Assert it exists (the test-app fixture has a CEL expression)
  - Use page.evaluate() with getComputedStyle() to read its color property
  - Assert: computed color equals rgb(147, 197, 253) — which is #93c5fd
    (dark mode default, Chromium resolves CSS variables to their computed value)

Step 3: kro keyword token is the correct dark slate
  - Locate the first span.token-kro-keyword
  - Assert: computed color equals rgb(214, 211, 209) — which is #d6d3d1

Step 4: YAML key token is the correct warm gray
  - Locate the first span.token-yaml-key
  - Assert: computed color equals rgb(168, 162, 158) — which is #a8a29e

Step 5: Copy button works
  - Click [data-testid="code-block-copy-btn"] inside the YAML tab
  - Assert: clipboard contains the full raw YAML of the test-app RGD
    (use page.evaluate(() => navigator.clipboard.readText()))
  - Note: Playwright grants clipboard permissions automatically in Chromium;
    no special permission grant needed in playwright.config.ts context options
```

**Implementation note**: CSS custom property values are resolved by Chromium at
render time. `getComputedStyle(el).color` returns the fully-resolved `rgb()`
value even when the property was set via `var(--hl-cel-expression)`. This is
why Chromium is required for this journey.

**What this journey does NOT cover** (unit tests only):
- All 8 token type tokenization rules
- Light mode color values (CSS variable switch)
- Performance (500-line YAML < 10ms)
- Edge cases: unclosed `${`, multiline CEL, empty input
