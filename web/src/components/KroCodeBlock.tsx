import { useState, useCallback } from "react"
import { tokenize, tokenClass } from "@/lib/highlighter"
import { useCapabilities } from "@/lib/features"
import "./KroCodeBlock.css"

interface KroCodeBlockProps {
  code: string
  /** Reserved for future multi-language support. Currently only "yaml". */
  language?: "yaml"
  title?: string
}

/** Inline SVG: copy icon (16x16). */
function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V3.5a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5h2" />
    </svg>
  )
}

/** Inline SVG: check icon (16x16). */
function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  )
}

/**
 * KroCodeBlock — syntax-highlighted code block for kro YAML.
 *
 * Renders tokenized YAML with CSS-variable-driven colors.
 * Supports copy-to-clipboard and an optional title bar.
 * CELOmitFunction feature gate controls whether omit() is highlighted as a kro keyword.
 *
 * Spec: .specify/specs/006-cel-highlighter/contracts/component.md
 */
export default function KroCodeBlock({ code, title }: KroCodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const { capabilities } = useCapabilities()

  // CELOmitFunction gate: when true, omit() is highlighted as a kro keyword.
  // When false, omit() appears as plain text in CEL expressions.
  const omitEnabled = capabilities.featureGates.CELOmitFunction

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }, () => {
      // Silent fail — clipboard API may be unavailable
    })
  }, [code])

  const tokens = tokenize(code)

  const copyButton = (
    <button
      data-testid="code-block-copy-btn"
      className="kro-code-block-copy"
      onClick={handleCopy}
      aria-label={copied ? "Copied!" : "Copy code"}
      type="button"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )

  return (
    <div
      data-testid="kro-code-block"
      className="kro-code-block"
      data-omit-enabled={omitEnabled ? "true" : undefined}
    >
      {title != null && (
        <div className="kro-code-block-header">
          <span className="kro-code-block-title">{title}</span>
          {copyButton}
        </div>
      )}
      <pre className="kro-code-block-pre" tabIndex={0}>
        <code>
          {tokens.map((token, i) => (
            <span key={i} className={tokenClass(token.type)}>
              {token.text}
            </span>
          ))}
        </code>
        {title == null && copyButton}
      </pre>
    </div>
  )
}
