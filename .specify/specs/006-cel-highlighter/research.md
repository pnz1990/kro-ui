# Research: CEL / Schema Syntax Highlighter

**Feature**: `006-cel-highlighter` | **Date**: 2026-03-20

---

## Research Topics

### 1. Token Color Source of Truth

**Decision**: `tokens.css` (implementing design spec 000) is the authoritative
source for all token colors. Where spec 006 values differ, `tokens.css` wins.

**Rationale**: The design system spec (000) is ratified and explicitly states it
is "the single source of truth for all visual decisions." `tokens.css` implements
it. Spec 006 was drafted with early kro.run research values before the design
system was finalized.

**Discrepancies found (light mode only)**:

| Token | Spec 006 value | tokens.css value | Action |
|-------|---------------|------------------|--------|
| `--hl-cel-expression` | `#5b7fc9` | `#3b6fd4` | Use `#3b6fd4` (tokens.css) |
| `--hl-schema-value` | `#5b7fc9` | `#7c5caa` | Use `#7c5caa` (tokens.css) |

Dark mode values are identical between spec 006 and tokens.css. No action needed.

**Alternatives considered**: Updating tokens.css to match spec 006 — rejected
because design spec 000 explicitly defines these values with contrast ratio
verification and `tokens.css` is already deployed and tested.

---

### 2. Tokenizer Architecture

**Decision**: Line-by-line processing with intra-line character scanning.
Single-pass, left-to-right, greedy matching.

**Rationale**: kro YAML has a line-oriented structure. Comments are line-scoped.
CEL expressions (`${...}`) can span within a line but the spec says multi-line
CEL is rare and the first `}` closes. SimpleSchema constraints
(`type | key=value`) are always single-line values. Line-by-line processing
gives us natural boundaries for comments and keeps the algorithm simple.

**Algorithm sketch**:

```
for each line:
  1. Check if line starts with (optional whitespace +) `#` → comment token
  2. Scan left-to-right within line:
     a. If `${` found → scan forward to matching `}` → celExpression token
     b. If at line start / after whitespace, check for `word:` pattern:
        - If word is in KRO_KEYWORDS set → kroKeyword token
        - Otherwise → yamlKey token
     c. After a `:` (value position), check for SimpleSchema pattern:
        - If word matches SCHEMA_TYPES set → schemaType token
        - If ` | ` found → schemaPipe token
        - If word after `|` matches SCHEMA_KEYWORDS set → schemaKeyword token
        - If `=` found after a schemaKeyword → schemaValue token (value after =)
     d. Everything else → plain text token (no type)
```

**Alternatives considered**:
- **Full YAML parser (yaml library)**: Rejected — NFR-003 prohibits external deps,
  and a full parse is overkill for line-level tokenization
- **Character-by-character state machine**: More complex, no real benefit since
  kro YAML doesn't have deeply nested syntax within a single line
- **Regex-only approach**: Rejected — regex for `${...}` with proper nesting
  handling is fragile and harder to maintain

---

### 3. SimpleSchema Grammar

**Decision**: Parse SimpleSchema values as a sequence of pipe-separated segments
where each segment is either a type name, a keyword, or a keyword=value pair.

**Rationale**: SimpleSchema appears in kro RGD `spec.schema.spec` and
`spec.schema.status` fields. The grammar is:

```
value := type ( " | " constraint )*
type := "string" | "integer" | "boolean" | "number" | "object" | "array"
constraint := keyword [ "=" value_text ]
keyword := "default" | "required" | "min" | "max" | "pattern" | "enum"
value_text := everything until next " | " or end-of-line
```

SimpleSchema is only tokenized when we detect a schema type at the start of a
YAML value position. This prevents false-positive highlighting of the word
"string" in an arbitrary YAML value.

**Context detection**: A line like `appName: string | default=primary` is
tokenized as SimpleSchema because:
1. `appName:` is a yamlKey
2. After the `:`, the first word is `string` (a schema type)
3. Once a schema type is detected, the rest of the value is parsed as SimpleSchema

A line like `version: "string"` is NOT SimpleSchema because `"string"` is quoted.

**Alternatives considered**: Requiring structural YAML context (knowing we're
inside `spec.schema`) — rejected because this would require YAML path tracking,
adding significant complexity. Heuristic detection (schema type word at value
start) is accurate enough for real-world kro YAML.

---

### 4. CEL Expression Handling

**Decision**: `${` opens a CEL span, first unmatched `}` closes it. No nesting
support. Unclosed `${` treats everything to end-of-line as plain text.

**Rationale**: The spec explicitly states:
- "Nested `${...}` → outer `${` opens, first `}` closes; inner not specially
  handled" (Edge Cases section)
- "Unclosed `${` → treat everything to end-of-line as plain text; do not crash"

This matches real-world kro usage where CEL expressions are simple field
references like `${schema.spec.appName}` or boolean comparisons like
`${appNamespace.status.phase == "Active"}`. Nested `${}` is theoretically
possible but practically never appears.

**Alternatives considered**: Brace-depth counting for nesting — rejected per
spec directive. Character-by-character tracking of string literals inside CEL
for accurate `}` matching — overengineered for the use case.

---

### 5. Vitest Configuration

**Decision**: Add Vitest as a dev dependency in `web/package.json`. Configure
via the existing `vite.config.ts` test block (Vitest integrates natively with
Vite). Add a `test` script.

**Rationale**: Vitest is the test runner mandated by the constitution (§VII) and
spec 006. Since the project already uses Vite 8, Vitest integrates seamlessly —
it reuses the Vite config for transforms and resolution. No additional babel or
ts-jest configuration needed.

**Changes needed**:
1. `bun add -d vitest` in `web/`
2. Add `"test": "vitest run"` and `"test:watch": "vitest"` to package.json scripts
3. Add `test` block to `vite.config.ts` (or create `vitest.config.ts` — prefer
   inline since the config is minimal)

**Alternatives considered**:
- **Jest**: Heavier setup, needs separate TS transform config. Not aligned with
  Vite toolchain
- **Separate vitest.config.ts**: Possible but unnecessary — the test config is
  simple enough to inline in `vite.config.ts`

---

### 6. KroCodeBlock Component Design

**Decision**: Single React component with three props (`code`, `language?`,
`title?`). Internal state limited to "copied" feedback. Uses CSS module or plain
CSS file for styles.

**Rationale**: The component is intentionally simple per spec FR-005:
- Renders `<pre>` with tokenized spans
- Each token span gets a CSS class like `token-cel-expression` that maps to the
  corresponding `--hl-*` variable
- Copy-to-clipboard button uses `navigator.clipboard.writeText`
- Optional title bar above the code block
- No React state management library (constitution §V)

**CSS approach**: Plain CSS file (`KroCodeBlock.css`) imported by the component.
This is consistent with how `tokens.css` is used globally. Token classes map to
CSS variables:

```css
.token-cel-expression { color: var(--hl-cel-expression); }
.token-kro-keyword    { color: var(--hl-kro-keyword); }
/* ... etc for all 8 types */
```

The code block background uses `var(--color-surface-3)` per design spec 000
(line 64: "Code block backgrounds").

**Alternatives considered**:
- **CSS Modules**: Would work but adds unnecessary isolation for a component
  that uses global CSS variables anyway
- **Inline styles with computed hex values**: Explicitly prohibited by
  constitution §IX and spec FR-004
- **Styled components**: Prohibited (no CSS framework libraries)

---

### 7. Plain Text Token Handling

**Decision**: Non-highlighted text segments are emitted as `Token` objects with
`type: "plain"` (or no type). They are rendered as unstyled `<span>` elements.

**Rationale**: The spec defines `Token` as `{ type: TokenType; text: string }`.
We need a way to represent the text between highlighted tokens. Options:

1. Add `"plain"` to the `TokenType` union — simplest, consistent
2. Use `null` or `undefined` type — requires optional typing, more complex
3. Don't emit plain text tokens, compute gaps at render time — complex

Option 1 is cleanest. The `KroCodeBlock` renders plain tokens as unstyled spans
(inheriting the default code text color from `--color-text`).

---

## Summary

All unknowns have been resolved. No external research needed — the decisions
are based on the spec requirements, constitution constraints, existing codebase
conventions, and standard TypeScript/React practices. The implementation can
proceed directly to design.
