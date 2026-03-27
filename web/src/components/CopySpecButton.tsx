// CopySpecButton.tsx — Copy instance spec to clipboard as YAML.
//
// Placed in the instance detail header. Converts spec.* fields to YAML
// text and writes it to the clipboard using the Clipboard API with a
// graceful fallback. Shows a brief "Copied!" confirmation.
//
// F-6: Copy instance spec as YAML from instance detail page.

import { useState, useCallback } from 'react'
import type { K8sObject } from '@/lib/api'
import './CopySpecButton.css'

interface CopySpecButtonProps {
  instance: K8sObject
}

/**
 * Minimal YAML serialiser for spec fields — no external dependency.
 * Handles: strings, numbers, booleans, null, arrays of primitives, nested objects.
 * Output matches the hand-written YAML style used by kubectl.
 */
function specToYaml(instance: K8sObject): string {
  const meta = instance.metadata as Record<string, unknown> | undefined
  const spec = instance.spec as Record<string, unknown> | undefined

  const name = typeof meta?.name === 'string' ? meta.name : ''
  const namespace = typeof meta?.namespace === 'string' ? meta.namespace : ''
  const apiVersion = typeof instance.apiVersion === 'string' ? instance.apiVersion : ''
  const kind = typeof instance.kind === 'string' ? instance.kind : ''

  const lines: string[] = []
  if (apiVersion) lines.push(`apiVersion: ${apiVersion}`)
  if (kind) lines.push(`kind: ${kind}`)
  lines.push('metadata:')
  if (name) lines.push(`  name: ${name}`)
  if (namespace) lines.push(`  namespace: ${namespace}`)

  if (spec && Object.keys(spec).length > 0) {
    lines.push('spec:')
    appendObject(lines, spec, '  ')
  }

  return lines.join('\n') + '\n'
}

function appendValue(lines: string[], key: string, value: unknown, indent: string): void {
  if (value === null || value === undefined) {
    lines.push(`${indent}${key}: null`)
  } else if (typeof value === 'boolean' || typeof value === 'number') {
    lines.push(`${indent}${key}: ${value}`)
  } else if (typeof value === 'string') {
    // Quote strings that contain special chars or look like numbers/booleans
    const needsQuote = /[:{}\[\]|>&*!,#?@`"'\\]/.test(value) ||
      value === '' || value === 'true' || value === 'false' ||
      value === 'null' || /^\d/.test(value)
    lines.push(`${indent}${key}: ${needsQuote ? JSON.stringify(value) : value}`)
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${indent}${key}: []`)
    } else {
      lines.push(`${indent}${key}:`)
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          const entries = Object.entries(item as Record<string, unknown>)
          if (entries.length > 0) {
            const [firstKey, firstVal] = entries[0]
            lines.push(`${indent}  - ${firstKey}: ${firstVal}`)
            for (let i = 1; i < entries.length; i++) {
              lines.push(`${indent}    ${entries[i][0]}: ${entries[i][1]}`)
            }
          } else {
            lines.push(`${indent}  - {}`)
          }
        } else {
          lines.push(`${indent}  - ${item}`)
        }
      }
    }
  } else if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      lines.push(`${indent}${key}: {}`)
    } else {
      lines.push(`${indent}${key}:`)
      appendObject(lines, value as Record<string, unknown>, indent + '  ')
    }
  }
}

function appendObject(lines: string[], obj: Record<string, unknown>, indent: string): void {
  for (const [key, val] of Object.entries(obj)) {
    appendValue(lines, key, val, indent)
  }
}

/**
 * CopySpecButton — clipboard button that copies the full instance YAML.
 *
 * Renders a small icon button. On click, serialises the instance spec
 * to YAML and writes it to the clipboard. Shows "Copied!" for 2 seconds.
 * Falls back to a textarea select + execCommand when Clipboard API is
 * unavailable (HTTP context or older browsers).
 */
export default function CopySpecButton({ instance }: CopySpecButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const yaml = specToYaml(instance)
    try {
      await navigator.clipboard.writeText(yaml)
    } catch {
      // Fallback for HTTP or browsers without clipboard API
      const el = document.createElement('textarea')
      el.value = yaml
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [instance])

  return (
    <button
      type="button"
      className={`copy-spec-btn${copied ? ' copy-spec-btn--copied' : ''}`}
      onClick={handleCopy}
      aria-label="Copy instance YAML to clipboard"
      title="Copy instance YAML — copies apiVersion, kind, metadata and spec as YAML"
      data-testid="copy-spec-btn"
    >
      {copied ? '✓ Copied!' : '⎘ Copy YAML'}
    </button>
  )
}
