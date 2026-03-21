# Contract: KroCodeBlock Component

**Module**: `web/src/components/KroCodeBlock.tsx`  
**Type**: React component

---

## Signature

```typescript
export default function KroCodeBlock(props: KroCodeBlockProps): JSX.Element
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `code` | `string` | Yes | — | Raw YAML/text to highlight and render |
| `language` | `"yaml"` | No | `"yaml"` | Language hint (currently only yaml supported) |
| `title` | `string` | No | — | Title bar text rendered above the code block |

## Rendered Structure

```html
<div data-testid="kro-code-block" class="kro-code-block">
  <!-- Optional: only rendered when title prop is provided -->
  <div class="kro-code-block-header">
    <span class="kro-code-block-title">{title}</span>
    <button data-testid="code-block-copy-btn" class="kro-code-block-copy">
      <!-- copy or check SVG icon -->
    </button>
  </div>
  
  <!-- When no title: copy button floats inside the pre -->
  <pre class="kro-code-block-pre">
    <code>
      <span class="token-cel-expression">${foo.bar}</span>
      <span class="token-yaml-key">apiVersion:</span>
      <span class="token-plain"> v1</span>
      <!-- ... one span per token -->
    </code>
    <!-- Copy button here if no title bar -->
    <button data-testid="code-block-copy-btn" class="kro-code-block-copy">
      ...
    </button>
  </pre>
</div>
```

## CSS Classes → Token Variables

| CSS Class | CSS Variable | Purpose |
|-----------|-------------|---------|
| `.token-cel-expression` | `var(--hl-cel-expression)` | CEL `${...}` spans |
| `.token-kro-keyword` | `var(--hl-kro-keyword)` | kro orchestration keywords |
| `.token-yaml-key` | `var(--hl-yaml-key)` | Standard YAML keys |
| `.token-schema-type` | `var(--hl-schema-type)` | SimpleSchema type names |
| `.token-schema-pipe` | `var(--hl-schema-pipe)` | SimpleSchema `\|` separator |
| `.token-schema-keyword` | `var(--hl-schema-keyword)` | SimpleSchema constraint keywords |
| `.token-schema-value` | `var(--hl-schema-value)` | SimpleSchema constraint values |
| `.token-comment` | `var(--hl-comment)` | YAML `#` comments |
| `.token-plain` | (inherits `--color-text`) | Non-highlighted text |

## Behavior

### Copy to Clipboard
1. User clicks copy button (`data-testid="code-block-copy-btn"`)
2. `navigator.clipboard.writeText(code)` is called with the **raw** `code` prop
   (not the rendered HTML)
3. On success: button icon changes from copy → check for 2 seconds
4. On failure: no visual change (silent fail — clipboard API may be unavailable)

### Theme Switching
- Token colors update automatically via CSS variable resolution
- No re-tokenization or re-render needed when theme changes
- Component does not subscribe to theme state

### Overflow
- `<pre>` is horizontally scrollable for long lines
- No line wrapping — preserves YAML indentation fidelity
- Vertical scrolling handled by parent container

## Data Attributes (for E2E testing)

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="kro-code-block"` | Root `<div>` | E2E: locate the code block |
| `data-testid="code-block-copy-btn"` | Copy `<button>` | E2E: click to test clipboard |

## CSS Token Classes (for E2E testing)

E2E tests locate token spans by CSS class:
- `span.token-cel-expression` (alias: `span.token-cel`)
- `span.token-kro-keyword`
- `span.token-yaml-key`

## Accessibility

- Copy button has `aria-label="Copy code"` (or `"Copied!"` when in copied state)
- `<pre>` has `tabindex="0"` for keyboard scrolling
- Focus ring via `:focus-visible` (global style from `tokens.css`)

## Style File

`web/src/components/KroCodeBlock.css` — imported by the component. Uses
`var(--*)` tokens from `tokens.css` exclusively. No hardcoded colors.
