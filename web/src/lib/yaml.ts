/**
 * Minimal JSON-to-YAML serializer for Kubernetes objects.
 *
 * Converts a parsed JSON object (from the K8s API) into YAML text that
 * the kro tokenizer can highlight. This is NOT a full YAML serializer —
 * it handles the subset of structures that appear in Kubernetes resources
 * (objects, arrays, strings, numbers, booleans, null).
 *
 * Zero dependencies. Constitution §V compliant.
 */

/**
 * Convert a JavaScript value to a YAML string.
 *
 * Handles objects, arrays, scalars. Produces clean, readable YAML that
 * the tokenizer can highlight (unquoted keys, proper indentation).
 */
export function toYaml(value: unknown, indent: number = 0): string {
  if (value === null || value === undefined) {
    return "null"
  }

  if (typeof value === "string") {
    return formatString(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (Array.isArray(value)) {
    return formatArray(value, indent)
  }

  if (typeof value === "object") {
    return formatObject(value as Record<string, unknown>, indent)
  }

  return String(value)
}

/** Format a string value, quoting if necessary. */
function formatString(s: string): string {
  if (s === "") return '""'

  // Values containing special chars or that look like other YAML types need quoting
  if (
    s.includes(": ") ||
    s.includes("#") ||
    s.includes("\n") ||
    s.startsWith("{") ||
    s.startsWith("[") ||
    s.startsWith("*") ||
    s.startsWith("&") ||
    s.startsWith("!") ||
    s.startsWith("%") ||
    s.startsWith("@") ||
    s.startsWith("`") ||
    s.startsWith('"') ||
    s.startsWith("'") ||
    s === "true" ||
    s === "false" ||
    s === "null" ||
    s === "~" ||
    /^[0-9.eE+-]+$/.test(s)
  ) {
    // Use double quotes, escaping internal quotes and backslashes
    return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"'
  }

  return s
}

/** Format an object as YAML key-value pairs. */
function formatObject(obj: Record<string, unknown>, indent: number): string {
  const keys = Object.keys(obj)
  if (keys.length === 0) return "{}"

  const prefix = "  ".repeat(indent)
  const lines: string[] = []

  for (const key of keys) {
    const val = obj[key]

    if (val === null || val === undefined) {
      lines.push(`${prefix}${key}: null`)
    } else if (typeof val === "object" && !Array.isArray(val)) {
      const nested = val as Record<string, unknown>
      if (Object.keys(nested).length === 0) {
        lines.push(`${prefix}${key}: {}`)
      } else {
        lines.push(`${prefix}${key}:`)
        lines.push(formatObject(nested, indent + 1))
      }
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${prefix}${key}: []`)
      } else {
        lines.push(`${prefix}${key}:`)
        lines.push(formatArray(val, indent + 1))
      }
    } else {
      lines.push(`${prefix}${key}: ${toYaml(val, indent + 1)}`)
    }
  }

  return lines.join("\n")
}

/** Format an array as YAML list items. */
function formatArray(arr: unknown[], indent: number): string {
  if (arr.length === 0) return "[]"

  const prefix = "  ".repeat(indent)
  const lines: string[] = []

  for (const item of arr) {
    if (item === null || item === undefined) {
      lines.push(`${prefix}- null`)
    } else if (typeof item === "object" && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>
      const keys = Object.keys(obj)
      if (keys.length === 0) {
        lines.push(`${prefix}- {}`)
      } else {
        // First key on the same line as the dash
        const firstKey = keys[0]
        const firstVal = obj[firstKey]
        if (typeof firstVal === "object" && firstVal !== null) {
          if (Array.isArray(firstVal)) {
            if ((firstVal as unknown[]).length === 0) {
              lines.push(`${prefix}- ${firstKey}: []`)
            } else {
              lines.push(`${prefix}- ${firstKey}:`)
              lines.push(formatArray(firstVal as unknown[], indent + 2))
            }
          } else {
            const nested = firstVal as Record<string, unknown>
            if (Object.keys(nested).length === 0) {
              lines.push(`${prefix}- ${firstKey}: {}`)
            } else {
              lines.push(`${prefix}- ${firstKey}:`)
              lines.push(formatObject(nested, indent + 2))
            }
          }
        } else {
          lines.push(`${prefix}- ${firstKey}: ${toYaml(firstVal, indent + 2)}`)
        }
        // Remaining keys at deeper indent
        for (let k = 1; k < keys.length; k++) {
          const key = keys[k]
          const val = obj[key]
          const deeper = "  ".repeat(indent + 1)
          if (val === null || val === undefined) {
            lines.push(`${deeper}${key}: null`)
          } else if (typeof val === "object" && !Array.isArray(val)) {
            const nested = val as Record<string, unknown>
            if (Object.keys(nested).length === 0) {
              lines.push(`${deeper}${key}: {}`)
            } else {
              lines.push(`${deeper}${key}:`)
              lines.push(formatObject(nested, indent + 2))
            }
          } else if (Array.isArray(val)) {
            if (val.length === 0) {
              lines.push(`${deeper}${key}: []`)
            } else {
              lines.push(`${deeper}${key}:`)
              lines.push(formatArray(val, indent + 2))
            }
          } else {
            lines.push(`${deeper}${key}: ${toYaml(val, indent + 2)}`)
          }
        }
      }
    } else {
      lines.push(`${prefix}- ${toYaml(item, indent + 1)}`)
    }
  }

  return lines.join("\n")
}
