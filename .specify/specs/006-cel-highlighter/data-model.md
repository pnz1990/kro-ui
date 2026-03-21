# Data Model: CEL / Schema Syntax Highlighter

**Feature**: `006-cel-highlighter` | **Date**: 2026-03-20

---

## Entities

### TokenType (string union)

The 9 token types produced by the tokenizer. 8 highlighted types plus `plain`
for non-highlighted text.

```typescript
type TokenType =
  | "celExpression"   // ${...} spans
  | "kroKeyword"      // kro-specific YAML keys (readyWhen, forEach, etc.)
  | "yamlKey"         // Standard YAML keys (apiVersion, kind, etc.)
  | "schemaType"      // SimpleSchema types (string, integer, boolean, etc.)
  | "schemaPipe"      // SimpleSchema | separator
  | "schemaKeyword"   // SimpleSchema constraint keywords (default, required, etc.)
  | "schemaValue"     // Value after = in SimpleSchema constraints
  | "comment"         // # to end-of-line
  | "plain"           // Non-highlighted text (whitespace, punctuation, values)
```

**Validation**: Type is a compile-time constraint — no runtime validation needed.

### Token

A single span of text with its semantic type.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `TokenType` | Yes | Semantic classification of the text span |
| `text` | `string` | Yes | The literal text content of the span |

```typescript
interface Token {
  type: TokenType
  text: string
}
```

**Invariants**:
- `text` is never empty (empty strings are not emitted as tokens)
- Adjacent tokens of the same type are merged (no fragmentation)
- The concatenation of all `token.text` values equals the original input string
- Token array is ordered — tokens appear in the same sequence as the input text

### KroCodeBlockProps

Props for the `KroCodeBlock` React component.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `code` | `string` | Yes | — | Raw YAML/text to tokenize and render |
| `language` | `"yaml"` | No | `"yaml"` | Language hint (reserved for future extension) |
| `title` | `string` | No | — | Optional title bar text above the code block |

```typescript
interface KroCodeBlockProps {
  code: string
  language?: "yaml"
  title?: string
}
```

---

## Constants

### KRO_KEYWORDS

The set of upstream kro-specific YAML keys that receive `kroKeyword` highlighting.
These are the orchestration-layer keys from `kubernetes-sigs/kro`.

```typescript
const KRO_KEYWORDS: ReadonlySet<string> = new Set([
  "id",
  "template",
  "readyWhen",
  "includeWhen",
  "forEach",
  "externalRef",
  "scope",
  "types",
])
```

**Note**: `specPatch` is explicitly excluded — it is a fork-only concept
(constitution §II).

### SCHEMA_TYPES

SimpleSchema type names that trigger schema-mode parsing in value position.

```typescript
const SCHEMA_TYPES: ReadonlySet<string> = new Set([
  "string",
  "integer",
  "boolean",
  "number",
  "object",
  "array",
])
```

### SCHEMA_KEYWORDS

Constraint keywords that appear after `|` in SimpleSchema values.

```typescript
const SCHEMA_KEYWORDS: ReadonlySet<string> = new Set([
  "default",
  "required",
  "min",
  "max",
  "pattern",
  "enum",
])
```

---

## Relationships

```
tokenize(input: string) → Token[]
    ↓
KroCodeBlock receives Token[] internally (calls tokenize on props.code)
    ↓
Each Token maps to a <span> with CSS class `token-{type}`
    ↓
CSS class maps to var(--hl-{type}) from tokens.css
```

The tokenizer is decoupled from the component. `KroCodeBlock` calls `tokenize()`
internally but the function is exported for direct use in tests and other
contexts.

---

## State Transitions

No state transitions. The tokenizer is a pure function. The `KroCodeBlock`
component has one piece of internal state:

| State | Type | Initial | Transition |
|-------|------|---------|------------|
| `copied` | `boolean` | `false` | `false → true` on clipboard write success; `true → false` after 2s timeout |

This state controls the copy button icon (copy icon → check icon → copy icon).
