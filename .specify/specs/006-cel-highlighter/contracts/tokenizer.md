# Contract: tokenize() Function

**Module**: `web/src/lib/highlighter.ts`  
**Type**: Pure function (library export)

---

## Signature

```typescript
export function tokenize(yaml: string): Token[]
```

## Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `yaml` | `string` | Yes | Raw YAML/text to tokenize. May contain kro CEL expressions, SimpleSchema annotations, and standard YAML. |

## Output

`Token[]` — ordered array of tokens whose `text` values concatenate to the
original input string.

## Invariants

1. **Completeness**: `tokens.map(t => t.text).join("") === yaml` — no text is lost
2. **No empty tokens**: Every token has `text.length > 0`
3. **Deterministic**: Same input always produces same output
4. **No side effects**: Function does not read or write any external state
5. **No exceptions**: Function never throws — malformed input produces best-effort
   plain text tokens

## Token Type Priority (precedence)

When a text segment could match multiple token types, the following precedence
applies (highest first):

1. `comment` — `#` to end-of-line (unless inside `${...}`)
2. `celExpression` — `${...}` spans consume everything inside, including text
   that would otherwise match other types
3. `kroKeyword` — checked before `yamlKey` for `word:` patterns
4. `yamlKey` — any remaining `word:` pattern at key position
5. `schemaType` → `schemaPipe` → `schemaKeyword` → `schemaValue` — only in
   value position after a detected schema type
6. `plain` — everything else

## Behavior by Input

| Input | Expected output | Notes |
|-------|----------------|-------|
| `""` (empty) | `[]` | Empty array |
| `"hello"` | `[{ type: "plain", text: "hello" }]` | No YAML structure |
| `"# comment"` | `[{ type: "comment", text: "# comment" }]` | Full line comment |
| `"apiVersion: v1"` | `[yamlKey("apiVersion:"), plain(" v1")]` | Standard YAML key |
| `"readyWhen:"` | `[kroKeyword("readyWhen:")]` | kro keyword |
| `"  - ${foo.bar}"` | `[plain("  - "), celExpression("${foo.bar}")]` | CEL expression |
| `"name: string \| default=x"` | `[yamlKey("name:"), plain(" "), schemaType("string"), plain(" "), schemaPipe("\|"), plain(" "), schemaKeyword("default"), plain("="), schemaValue("x")]` | SimpleSchema |
| `"${unclosed"` | `[plain("${unclosed")]` | Unclosed CEL → plain |
| `null` / `undefined` | N/A — TypeScript prevents this | Strict mode enforced |

## Performance

- MUST process 500 lines of typical kro YAML in under 10ms
- Measured via `performance.now()` in unit tests
- No pre-compilation or caching required at this scale

## Test Requirements

Test file: `web/src/lib/highlighter.test.ts`

| Test Category | Min Cases | Priority |
|---------------|-----------|----------|
| CEL expression basics | 3 | P1 |
| CEL edge cases (unclosed, nested) | 3 | P1 |
| kro keyword recognition | 4 | P1 |
| kro keyword vs yamlKey distinction | 2 | P1 |
| SimpleSchema full parse | 3 | P1 |
| Comment handling | 2 | P1 |
| Empty / plain text input | 2 | P1 |
| Completeness invariant | 1 | P1 |
| Performance (500 lines < 10ms) | 1 | P1 |
| Multi-line input with mixed tokens | 2 | P2 |
