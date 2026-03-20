# Feature Specification: CEL / Schema Syntax Highlighter

**Feature Branch**: `006-cel-highlighter`
**Created**: 2026-03-20
**Status**: Draft

## User Scenarios & Testing

### User Story 1 — User reads an RGD YAML and immediately understands the structure (Priority: P1)

When viewing a kro RGD YAML, the user sees a custom syntax highlighting that distinguishes kro-specific concepts from standard YAML — gray for YAML keys, blue for CEL expressions, pink for schema types, dark slate for kro keywords. The colors match kro.run's own documentation.

**Why this priority**: The highlighter is what makes kro YAML readable at a glance. Without it, a 200-line RGD is a wall of text.

**Independent Test**: Render a kro YAML with `${...}` CEL expressions. Confirm they appear in `#93c5fd` (dark mode blue). Confirm `readyWhen:` appears in `#d6d3d1` (kro keyword). Confirm `string` appears in `#e0c080` (schema type).

**Acceptance Scenarios**:

1. **Given** a YAML with `${clusterVPC.status.vpcID}`, **When** rendered, **Then** the entire `${...}` span is blue (`--hl-cel-expression`)
2. **Given** a YAML key like `apiVersion:`, **When** rendered, **Then** it is gray (`--hl-yaml-key`)
3. **Given** a kro keyword like `readyWhen:`, `forEach:`, `includeWhen:`, `template:`, `id:`, **When** rendered, **Then** it is dark slate (`--hl-kro-keyword`)
4. **Given** a SimpleSchema type like `string | default=warrior`, **When** rendered, **Then** `string` is pink, `|` is muted gray, `default` is muted blue, `warrior` is lavender
5. **Given** a YAML comment like `# CRD Schema`, **When** rendered, **Then** it is rendered in comment gray

---

### User Story 2 — Highlighter works correctly in light mode (Priority: P2)

In light mode, the token colors switch to their light-mode equivalents (matching kro.run light theme) without any flash or overlap.

**Why this priority**: Light mode support is required per the constitution. The highlighter uses CSS custom properties so this is automatic if implemented correctly.

**Independent Test**: Switch to light mode. Confirm CEL expressions appear in `#5b7fc9` (light mode blue). Confirm background is `#f6f8fa`.

**Acceptance Scenarios**:

1. **Given** light mode is active, **When** a kro YAML is rendered, **Then** all tokens use their light-mode CSS variable values
2. **Given** the user switches from dark to light mode, **When** the YAML is already rendered, **Then** colors update immediately without re-rendering the YAML

---

### Edge Cases

- What if a `${...}` expression spans multiple lines? → Highlight the entire span in blue.
- What if a YAML value contains a literal `${` without a closing `}`? → Do not highlight; treat as plain text.
- What if the YAML has syntax errors? → Render as plain text for the malformed portion; do not crash.
- What if the YAML is empty? → Render an empty block with no error.

## Requirements

### Functional Requirements

- **FR-001**: Highlighter MUST be a pure TypeScript function `tokenize(yaml: string): Token[]` — no external libraries
- **FR-002**: MUST recognize 8 token types: `yamlKey`, `kroKeyword`, `celExpression`, `schemaType`, `schemaPipe`, `schemaKeyword`, `schemaValue`, `comment`
- **FR-003**: `celExpression` MUST match the full `${...}` span including nested content
- **FR-004**: `kroKeyword` MUST match: `id:`, `template:`, `readyWhen:`, `includeWhen:`, `forEach:`, `externalRef:` (kro-specific fields)
- **FR-005**: `schemaType` MUST match SimpleSchema primitives: `string`, `integer`, `boolean`, `number`, `object`, `array`
- **FR-006**: `schemaPipe` MUST match the ` | ` separator in SimpleSchema constraints
- **FR-007**: `schemaKeyword` MUST match SimpleSchema constraint keywords: `default`, `required`, `min`, `max`, `pattern`, `enum`
- **FR-008**: Token colors MUST be applied via CSS custom properties (e.g., `var(--hl-cel-expression)`) so dark/light mode switching is automatic
- **FR-009**: The `KroCodeBlock` React component MUST accept `code: string` and `language?: "yaml"` and render a `<pre>` with a copy button
- **FR-010**: Token colors in dark mode MUST exactly match kro.run's example page colors (sourced from research)

### Key Entities

- **`tokenize(yaml: string): Token[]`**: pure function, no side effects
- **`Token`**: `{ type: TokenType; text: string }`
- **`KroCodeBlock`**: React component using `tokenize` to render highlighted YAML

## Success Criteria

- **SC-001**: All `${...}` CEL expressions in `dungeon-graph` YAML are highlighted blue in dark mode
- **SC-002**: `readyWhen:`, `forEach:`, `includeWhen:`, `id:`, `template:` are highlighted in kro keyword color
- **SC-003**: Light/dark mode token colors match kro.run documentation page colors exactly
- **SC-004**: The tokenizer handles a 500-line RGD YAML in under 10ms
