# Quickstart: CEL / Schema Syntax Highlighter

**Feature**: `006-cel-highlighter`

---

## Integration Scenario 1: Render highlighted kro YAML

The most common use case — display an RGD YAML with syntax highlighting in any
kro-ui page.

```tsx
import KroCodeBlock from "@/components/KroCodeBlock"

function RGDYamlTab({ yaml }: { yaml: string }) {
  return (
    <KroCodeBlock
      code={yaml}
      title="ResourceGraphDefinition"
    />
  )
}
```

The component calls `tokenize()` internally. You never need to call the
tokenizer directly for rendering purposes.

---

## Integration Scenario 2: Use the tokenizer directly

For programmatic analysis (e.g., counting CEL expressions in an RGD):

```tsx
import { tokenize } from "@/lib/highlighter"
import type { Token } from "@/lib/highlighter"

const tokens: Token[] = tokenize(rgdYaml)
const celExpressions = tokens.filter(t => t.type === "celExpression")
console.log(`Found ${celExpressions.length} CEL expressions`)
```

---

## Integration Scenario 3: Node detail panel

When a user clicks a DAG node, show its YAML template with highlighting:

```tsx
import KroCodeBlock from "@/components/KroCodeBlock"

function NodeDetailPanel({ node }: { node: DAGNode }) {
  const yaml = JSON.stringify(node.template, null, 2) // or raw YAML string
  return (
    <div className="node-detail">
      <h3>{node.id}</h3>
      <KroCodeBlock code={yaml} title={`${node.kind} template`} />
    </div>
  )
}
```

---

## Integration Scenario 4: Test the tokenizer

Run unit tests with Vitest:

```bash
cd web && bun run test           # single run
cd web && bun run test:watch     # watch mode
```

Write a new test case:

```typescript
// web/src/lib/highlighter.test.ts
import { describe, it, expect } from "vitest"
import { tokenize } from "./highlighter"

describe("tokenize", () => {
  it("tokenizes a CEL expression", () => {
    const tokens = tokenize("name: ${foo.bar}")
    expect(tokens).toContainEqual({
      type: "celExpression",
      text: "${foo.bar}",
    })
  })
})
```

---

## File Locations

| File | Purpose |
|------|---------|
| `web/src/lib/highlighter.ts` | `tokenize()` function, `Token`/`TokenType` types |
| `web/src/lib/highlighter.test.ts` | Vitest unit tests |
| `web/src/components/KroCodeBlock.tsx` | React component |
| `web/src/components/KroCodeBlock.css` | Component styles |
| `web/src/tokens.css` | CSS custom properties (already exists — `--hl-*` vars) |

---

## CSS Variable Mapping

The token type names map to CSS classes and variables:

```
tokenize() output   →  CSS class               →  CSS variable
─────────────────────────────────────────────────────────────────
"celExpression"     →  .token-cel-expression    →  var(--hl-cel-expression)
"kroKeyword"        →  .token-kro-keyword       →  var(--hl-kro-keyword)
"yamlKey"           →  .token-yaml-key          →  var(--hl-yaml-key)
"schemaType"        →  .token-schema-type       →  var(--hl-schema-type)
"schemaPipe"        →  .token-schema-pipe       →  var(--hl-schema-pipe)
"schemaKeyword"     →  .token-schema-keyword    →  var(--hl-schema-keyword)
"schemaValue"       →  .token-schema-value      →  var(--hl-schema-value)
"comment"           →  .token-comment           →  var(--hl-comment)
"plain"             →  .token-plain             →  (inherits --color-text)
```

Dark/light mode is handled automatically — the CSS variables resolve to
different hex values based on `[data-theme]` on `<html>`.
