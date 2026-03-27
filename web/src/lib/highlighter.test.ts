/**
 * Unit tests for the kro CEL / Schema / YAML tokenizer.
 *
 * Spec: .specify/specs/006-cel-highlighter/spec.md
 * Contract: .specify/specs/006-cel-highlighter/contracts/tokenizer.md
 */

import { describe, it, expect } from "vitest"
import { tokenize } from "./highlighter"
import type { Token } from "./highlighter"

// ── Helpers ────────────────────────────────────────────────────────────

/** Assert that the concatenation of all token texts equals the input. */
function assertCompleteness(input: string, tokens: Token[]): void {
  expect(tokens.map((t) => t.text).join("")).toBe(input)
}

/** Find all tokens of a given type. */
function tokensOfType(tokens: Token[], type: string): Token[] {
  return tokens.filter((t) => t.type === type)
}

/** Generate a realistic kro YAML fixture of the given line count. */
function generateLargeYaml(lines: number): string {
  const header = [
    "apiVersion: kro.run/v1alpha1",
    "kind: ResourceGraphDefinition",
    "metadata:",
    "  name: perf-test",
    "spec:",
    "  schema:",
    "    apiVersion: v1alpha1",
    "    kind: PerfApp",
    "    spec:",
    "      appName: string | default=perf-app",
    "      replicas: integer | min=1 | max=100",
    "      enableFeature: boolean | default=true",
    "    status:",
    "      phase: ${appNamespace.status.phase}",
    "  resources:",
  ]

  const resourceBlock = (i: number): string[] => [
    `    - id: resource${i}`,
    "      template:",
    "        apiVersion: v1",
    "        kind: ConfigMap",
    "        metadata:",
    `          name: \${schema.spec.appName}-cfg-${i}`,
    `          namespace: \${appNamespace.metadata.name}`,
    `        # Resource ${i} configuration`,
    "      readyWhen:",
    `        - \${resource${i}.metadata.name != ""}`,
  ]

  const result: string[] = [...header]
  let lineCount = header.length

  let i = 0
  while (lineCount < lines) {
    const block = resourceBlock(i)
    result.push(...block)
    lineCount += block.length
    i++
  }

  return result.slice(0, lines).join("\n")
}

// ── T005: CEL Expression Tests ─────────────────────────────────────────

describe("tokenize — celExpression", () => {
  it("tokenizes simple ${expr}", () => {
    const tokens = tokenize("name: ${foo.bar}")
    expect(tokens).toContainEqual({
      type: "celExpression",
      text: "${foo.bar}",
    })
  })

  it("tokenizes ${expr} with nested dots and comparison operators", () => {
    const input = '  - ${appNamespace.status.phase == "Active"}'
    const tokens = tokenize(input)
    expect(tokens).toContainEqual({
      type: "celExpression",
      text: '${appNamespace.status.phase == "Active"}',
    })
    assertCompleteness(input, tokens)
  })

  it("tokenizes multiple CEL expressions on one line", () => {
    const input = "name: ${schema.spec.appName}-${schema.spec.suffix}"
    const tokens = tokenize(input)
    const celTokens = tokensOfType(tokens, "celExpression")
    expect(celTokens).toHaveLength(2)
    expect(celTokens[0].text).toBe("${schema.spec.appName}")
    expect(celTokens[1].text).toBe("${schema.spec.suffix}")
    assertCompleteness(input, tokens)
  })

  it("does NOT tokenize unclosed ${", () => {
    const input = "${unclosed"
    const tokens = tokenize(input)
    // Unclosed ${ should be plain text, not a celExpression
    const celTokens = tokensOfType(tokens, "celExpression")
    expect(celTokens).toHaveLength(0)
    assertCompleteness(input, tokens)
  })

  it("does NOT tokenize ${ inside a comment", () => {
    const input = "# this is ${not.cel}"
    const tokens = tokenize(input)
    const celTokens = tokensOfType(tokens, "celExpression")
    expect(celTokens).toHaveLength(0)
    // The entire line should be a comment
    expect(tokens).toContainEqual({
      type: "comment",
      text: "# this is ${not.cel}",
    })
  })
})

// ── T006: kro Keyword Tests ────────────────────────────────────────────

describe("tokenize — kroKeyword", () => {
  const kroKeywords = [
    "readyWhen",
    "forEach",
    "includeWhen",
    "template",
    "id",
    "externalRef",
    "scope",
    "types",
  ]

  for (const keyword of kroKeywords) {
    it(`tokenizes ${keyword}: as kroKeyword`, () => {
      const input = `    ${keyword}:`
      const tokens = tokenize(input)
      expect(tokens).toContainEqual({
        type: "kroKeyword",
        text: `${keyword}:`,
      })
      assertCompleteness(input, tokens)
    })
  }

  it("does NOT tokenize apiVersion: as kroKeyword", () => {
    const input = "apiVersion: v1"
    const tokens = tokenize(input)
    const kroTokens = tokensOfType(tokens, "kroKeyword")
    expect(kroTokens).toHaveLength(0)
    expect(tokens).toContainEqual({
      type: "yamlKey",
      text: "apiVersion:",
    })
  })

  it("does NOT tokenize kind: as kroKeyword", () => {
    const input = "kind: ConfigMap"
    const tokens = tokenize(input)
    const kroTokens = tokensOfType(tokens, "kroKeyword")
    expect(kroTokens).toHaveLength(0)
    expect(tokens).toContainEqual({
      type: "yamlKey",
      text: "kind:",
    })
  })

  it("tokenizes kro keyword after whitespace indentation", () => {
    const input = "      readyWhen:"
    const tokens = tokenize(input)
    expect(tokens).toContainEqual({
      type: "kroKeyword",
      text: "readyWhen:",
    })
    assertCompleteness(input, tokens)
  })
})

// ── T007: SimpleSchema Tests ───────────────────────────────────────────

describe("tokenize — SimpleSchema", () => {
  it("tokenizes string in value position as schemaType", () => {
    const input = "      appName: string"
    const tokens = tokenize(input)
    expect(tokens).toContainEqual({
      type: "schemaType",
      text: "string",
    })
    assertCompleteness(input, tokens)
  })

  it("tokenizes integer in value position as schemaType", () => {
    const input = "      replicas: integer"
    const tokens = tokenize(input)
    expect(tokens).toContainEqual({
      type: "schemaType",
      text: "integer",
    })
    assertCompleteness(input, tokens)
  })

  it("tokenizes 'string | default=primary' with all schema token types", () => {
    const input = "      appName: string | default=primary"
    const tokens = tokenize(input)

    expect(tokens).toContainEqual({ type: "schemaType", text: "string" })
    expect(tokens).toContainEqual({ type: "schemaPipe", text: "|" })
    expect(tokens).toContainEqual({ type: "schemaKeyword", text: "default" })
    expect(tokens).toContainEqual({ type: "schemaValue", text: "primary" })
    assertCompleteness(input, tokens)
  })

  it("tokenizes 'integer | min=1 | max=10' with multiple pipe segments", () => {
    const input = "      count: integer | min=1 | max=10"
    const tokens = tokenize(input)

    expect(tokens).toContainEqual({ type: "schemaType", text: "integer" })

    const pipes = tokensOfType(tokens, "schemaPipe")
    expect(pipes).toHaveLength(2)

    expect(tokens).toContainEqual({ type: "schemaKeyword", text: "min" })
    expect(tokens).toContainEqual({ type: "schemaKeyword", text: "max" })
    expect(tokens).toContainEqual({ type: "schemaValue", text: "1" })
    expect(tokens).toContainEqual({ type: "schemaValue", text: "10" })
    assertCompleteness(input, tokens)
  })

  it("does NOT tokenize quoted 'string' as schemaType", () => {
    const input = '      version: "string"'
    const tokens = tokenize(input)
    const schemaTypes = tokensOfType(tokens, "schemaType")
    expect(schemaTypes).toHaveLength(0)
    assertCompleteness(input, tokens)
  })
})

// ── T008: Comment and Edge Case Tests ──────────────────────────────────

describe("tokenize — comments and edge cases", () => {
  it("tokenizes # to end of line as comment", () => {
    const input = "# CRD Schema"
    const tokens = tokenize(input)
    expect(tokens).toEqual([{ type: "comment", text: "# CRD Schema" }])
  })

  it("tokenizes comment after leading whitespace", () => {
    const input = "  # indented comment"
    const tokens = tokenize(input)
    expect(tokens).toContainEqual({
      type: "comment",
      text: "# indented comment",
    })
    assertCompleteness(input, tokens)
  })

  it("returns empty array for empty string input", () => {
    expect(tokenize("")).toEqual([])
  })

  it("returns plain token for simple non-YAML text", () => {
    const tokens = tokenize("hello")
    expect(tokens).toEqual([{ type: "plain", text: "hello" }])
  })

  it("preserves completeness invariant on multi-line kro YAML", () => {
    const input = [
      "apiVersion: kro.run/v1alpha1",
      "kind: ResourceGraphDefinition",
      "metadata:",
      "  name: test-app",
      "spec:",
      "  schema:",
      "    apiVersion: v1alpha1",
      "    kind: WebApp",
      "    spec:",
      "      appName: string | default=kro-ui-test",
      "      enableConfig: boolean | default=true",
      "    status:",
      "      phase: ${appNamespace.status.phase}",
      "  resources:",
      "    - id: appNamespace",
      "      template:",
      "        apiVersion: v1",
      "        kind: Namespace",
      "        metadata:",
      "          name: ${schema.spec.appName}",
      "      readyWhen:",
      '        - ${appNamespace.status.phase == "Active"}',
      "",
      "    - id: appConfig",
      "      includeWhen:",
      "        - ${schema.spec.enableConfig}",
      "      template:",
      "        apiVersion: v1",
      "        kind: ConfigMap",
      "        metadata:",
      "          name: ${schema.spec.appName}-config",
      "          namespace: ${appNamespace.metadata.name}",
      "        data:",
      "          app: ${schema.spec.appName}",
      '          version: "v1"',
    ].join("\n")

    const tokens = tokenize(input)
    assertCompleteness(input, tokens)

    // Verify no empty tokens
    for (const token of tokens) {
      expect(token.text.length).toBeGreaterThan(0)
    }
  })

  it("handles line with only whitespace", () => {
    const input = "   "
    const tokens = tokenize(input)
    assertCompleteness(input, tokens)
  })

  it("handles YAML list item markers", () => {
    const input = "    - id: appNamespace"
    const tokens = tokenize(input)
    expect(tokens).toContainEqual({ type: "kroKeyword", text: "id:" })
    assertCompleteness(input, tokens)
  })
})

// ── T009: Performance Test ─────────────────────────────────────────────

describe("tokenize — performance", () => {
  it("tokenizes a 500-line YAML in under 10ms", () => {
    const yaml = generateLargeYaml(500)
    // Warm up
    tokenize(yaml)

    const start = performance.now()
    tokenize(yaml)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(10)
  })
})

// ── T028: CEL Comprehension Macros Regression Guard (spec 046) ─────────────
// These are regression tests — no code change to highlighter.ts was made.
// The existing ${...} pattern already produces celExpression tokens.
// This suite ensures future refactors do not accidentally break that behaviour.

describe("tokenize — CEL comprehension macros (kro v0.9.0 regression guard)", () => {
  const comprehensionCases = [
    {
      macro: "transformMap",
      input: '    result: ${schema.spec.items.transformMap(k, v, {k: string(v)})}',
    },
    {
      macro: "transformList",
      input: '    tagList: ${schema.spec.tags.transformList(i, v, v).join(",")}',
    },
    {
      macro: "transformMapEntry",
      input: '    tagIndex: ${schema.spec.tags.transformMapEntry(i, v, string(i), v)}',
    },
  ]

  for (const { macro, input } of comprehensionCases) {
    it(`tokenises ${macro}(...) inside \${...} as celExpression`, () => {
      const tokens = tokenize(input)
      const celTokens = tokens.filter((t) => t.type === "celExpression")
      expect(celTokens.length).toBeGreaterThan(0)
      const combined = celTokens.map((t) => t.text).join("")
      expect(combined).toContain(macro)
    })

    it(`tokenize(input) is complete for ${macro} case`, () => {
      const tokens = tokenize(input)
      const reconstructed = tokens.map((t: Token) => t.text).join("")
      expect(reconstructed).toBe(input)
    })
  }
})
