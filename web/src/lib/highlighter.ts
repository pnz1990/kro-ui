/**
 * kro CEL / Schema / YAML syntax tokenizer.
 *
 * Pure function with zero dependencies. Produces an ordered token array
 * whose text values concatenate to the original input string.
 *
 * Spec: .specify/specs/006-cel-highlighter/spec.md
 * Contract: .specify/specs/006-cel-highlighter/contracts/tokenizer.md
 */

// ── Types ──────────────────────────────────────────────────────────────

export type TokenType =
  | "celExpression"
  | "kroKeyword"
  | "yamlKey"
  | "schemaType"
  | "schemaPipe"
  | "schemaKeyword"
  | "schemaValue"
  | "comment"
  | "plain"

export interface Token {
  type: TokenType
  text: string
}

// ── Constants ──────────────────────────────────────────────────────────

/** Upstream kro orchestration keywords (kubernetes-sigs/kro). */
export const KRO_KEYWORDS: ReadonlySet<string> = new Set([
  "id",
  "template",
  "readyWhen",
  "includeWhen",
  "forEach",
  "externalRef",
  "scope",
  "types",
])

/** SimpleSchema primitive type names. */
export const SCHEMA_TYPES: ReadonlySet<string> = new Set([
  "string",
  "integer",
  "boolean",
  "number",
  "object",
  "array",
])

/** SimpleSchema constraint keywords (appear after | separator). */
export const SCHEMA_KEYWORDS: ReadonlySet<string> = new Set([
  "default",
  "required",
  "min",
  "max",
  "pattern",
  "enum",
])

// ── Internal helpers ───────────────────────────────────────────────────

/** Push a token, merging with the previous if types match. */
function pushToken(tokens: Token[], type: TokenType, text: string): void {
  if (text === "") return
  const last = tokens[tokens.length - 1]
  if (last && last.type === type) {
    last.text += text
  } else {
    tokens.push({ type, text })
  }
}

/** Check if a character is a word character (letters, digits, underscore, hyphen, dot). */
function isWordChar(ch: string): boolean {
  return /[\w\-.]/u.test(ch)
}

// ── Line tokenizer ─────────────────────────────────────────────────────

/**
 * Tokenize a single line of kro YAML (without the newline).
 * Appends tokens directly to the given array.
 */
function tokenizeLine(line: string, tokens: Token[]): void {
  const len = line.length
  if (len === 0) return

  // Check for full-line or trailing-whitespace comment
  const trimmed = line.trimStart()
  if (trimmed.startsWith("#")) {
    const leadingWs = line.slice(0, len - trimmed.length)
    if (leadingWs.length > 0) {
      pushToken(tokens, "plain", leadingWs)
    }
    pushToken(tokens, "comment", trimmed)
    return
  }

  let pos = 0
  let inValuePosition = false
  let isSchemaValue = false

  while (pos < len) {
    // ── CEL expression: ${...} ───────────────────────────────────────
    if (line[pos] === "$" && pos + 1 < len && line[pos + 1] === "{") {
      const closeIdx = line.indexOf("}", pos + 2)
      if (closeIdx !== -1) {
        pushToken(tokens, "celExpression", line.slice(pos, closeIdx + 1))
        pos = closeIdx + 1
        continue
      }
      // Unclosed ${ → treat rest of line as plain
      pushToken(tokens, "plain", line.slice(pos))
      return
    }

    // ── Comment mid-line: # after whitespace ─────────────────────────
    if (line[pos] === "#" && (pos === 0 || line[pos - 1] === " " || line[pos - 1] === "\t")) {
      pushToken(tokens, "comment", line.slice(pos))
      return
    }

    // ── YAML key: word followed by colon ─────────────────────────────
    if (!inValuePosition && isKeyPosition(line, pos)) {
      const colonIdx = line.indexOf(":", pos)
      if (colonIdx !== -1) {
        const word = line.slice(pos, colonIdx)
        if (isValidKeyWord(word)) {
          const keyText = word + ":"
          const type: TokenType = KRO_KEYWORDS.has(word) ? "kroKeyword" : "yamlKey"
          pushToken(tokens, type, keyText)
          pos = colonIdx + 1
          inValuePosition = true
          continue
        }
      }
    }

    // ── SimpleSchema in value position ───────────────────────────────
    if (inValuePosition && !isSchemaValue) {
      // Skip whitespace
      if (line[pos] === " " || line[pos] === "\t") {
        pushToken(tokens, "plain", line[pos])
        pos++
        continue
      }

      // Check for schema type as first word in value
      const valueWord = extractWord(line, pos)
      if (valueWord && SCHEMA_TYPES.has(valueWord)) {
        // Check it's not quoted
        if (pos > 0 && (line[pos - 1] === '"' || line[pos - 1] === "'")) {
          pushToken(tokens, "plain", line[pos])
          pos++
          continue
        }
        pushToken(tokens, "schemaType", valueWord)
        pos += valueWord.length
        isSchemaValue = true
        continue
      }
    }

    // ── Schema mode: parse pipe-separated constraints ────────────────
    if (isSchemaValue) {
      if (line[pos] === " " || line[pos] === "\t") {
        pushToken(tokens, "plain", line[pos])
        pos++
        continue
      }

      if (line[pos] === "|") {
        pushToken(tokens, "schemaPipe", "|")
        pos++
        continue
      }

      if (line[pos] === "=") {
        pushToken(tokens, "plain", "=")
        pos++
        // Everything after = until next space+| or end is schemaValue
        const valueStart = pos
        while (pos < len && line[pos] !== " " && line[pos] !== "\t") {
          // Check for next | segment
          if (line[pos] === "|") break
          pos++
        }
        if (pos > valueStart) {
          pushToken(tokens, "schemaValue", line.slice(valueStart, pos))
        }
        continue
      }

      // Check for schema keyword
      const schemaWord = extractWord(line, pos)
      if (schemaWord && SCHEMA_KEYWORDS.has(schemaWord)) {
        pushToken(tokens, "schemaKeyword", schemaWord)
        pos += schemaWord.length
        continue
      }

      // Check for schema type (additional type after |)
      if (schemaWord && SCHEMA_TYPES.has(schemaWord)) {
        pushToken(tokens, "schemaType", schemaWord)
        pos += schemaWord.length
        continue
      }

      // Any other word in schema mode is plain
      if (schemaWord) {
        pushToken(tokens, "plain", schemaWord)
        pos += schemaWord.length
        continue
      }
    }

    // ── Default: plain text ──────────────────────────────────────────
    pushToken(tokens, "plain", line[pos])
    pos++
  }
}

/**
 * Determine if position is a valid key position:
 * - At line start (after optional whitespace and list markers)
 * - The character is a word character
 * - There is a colon ahead before the end of the key
 */
function isKeyPosition(line: string, pos: number): boolean {
  // Must be a word character
  if (!isWordChar(line[pos])) return false

  // Check everything before pos is whitespace, list markers (- ), or nothing
  const before = line.slice(0, pos)
  if (before.length > 0 && !/^[\s-]*$/.test(before)) return false

  // There must be a colon somewhere after pos within the key
  const colonIdx = line.indexOf(":", pos)
  if (colonIdx === -1) return false

  // Everything between pos and colon must be word chars
  const segment = line.slice(pos, colonIdx)
  return segment.length > 0 && /^[\w-]+$/.test(segment)
}

/** Check if a string is a valid YAML key word (letters, digits, hyphens). */
function isValidKeyWord(word: string): boolean {
  return word.length > 0 && /^[\w-]+$/.test(word)
}

/** Extract a word starting at pos (letters, digits, underscore, hyphen). */
function extractWord(line: string, pos: number): string {
  let end = pos
  while (end < line.length && /[\w-]/.test(line[end])) {
    end++
  }
  return line.slice(pos, end)
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * tokenClass — maps a TokenType to its CSS class name for the kro code block.
 *
 * Defined here (alongside TokenType) so every consumer imports from a single
 * source. Never duplicate this function in component files. (AGENTS.md anti-pattern #77)
 *
 * `KroCodeBlock` is the only consumer; all classes are in the `token-*` namespace.
 * If a future component needs different class names it should wrap or extend rather
 * than forking this function.
 */
export function tokenClass(type: TokenType): string {
  switch (type) {
    case "celExpression":
      return "token-cel-expression token-cel"
    case "kroKeyword":
      return "token-kro-keyword"
    case "yamlKey":
      return "token-yaml-key"
    case "schemaType":
      return "token-schema-type"
    case "schemaPipe":
      return "token-schema-pipe"
    case "schemaKeyword":
      return "token-schema-keyword"
    case "schemaValue":
      return "token-schema-value"
    case "comment":
      return "token-comment"
    case "plain":
      return ""
  }
}

/**
 * Tokenize kro-flavored YAML into an ordered array of typed tokens.
 *
 * Invariants:
 *   - tokens.map(t => t.text).join("") === yaml
 *   - Every token has text.length > 0
 *   - Never throws — malformed input produces best-effort plain tokens
 */
export function tokenize(yaml: string): Token[] {
  if (yaml === "") return []

  const tokens: Token[] = []
  const lines = yaml.split("\n")

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      pushToken(tokens, "plain", "\n")
    }
    tokenizeLine(lines[i], tokens)
  }

  return tokens
}
