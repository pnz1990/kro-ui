// DocsTab.tsx — Auto-generated API documentation for an RGD's schema.
//
// Reads spec.schema from the already-loaded RGD object (no additional API call).
// Displays spec fields with types and defaults, status fields with CEL source
// expressions, and a copyable example YAML manifest.
//
// Spec: .specify/specs/020-schema-doc-generator/

import type { K8sObject } from '@/lib/api'
import { buildSchemaDoc } from '@/lib/schema'
import FieldTable from '@/components/FieldTable'
import ExampleYAML from '@/components/ExampleYAML'
import './DocsTab.css'

// ── Component ─────────────────────────────────────────────────────────────

interface DocsTabProps {
  /** The already-loaded RGD object. FR-001: no additional API call made here. */
  rgd: K8sObject
}

/**
 * DocsTab — generates and displays API documentation from the RGD's spec.schema.
 *
 * Sections:
 *   - API Reference header: kind + apiVersion badges
 *   - Spec Fields: field name, type, required/optional indicator, default
 *   - Status Fields (if present): field name, inferred type, CEL expression
 *   - Example Manifest: generated YAML with copy button
 *
 * Spec: .specify/specs/020-schema-doc-generator/
 */
export default function DocsTab({ rgd }: DocsTabProps) {
  const schema = buildSchemaDoc(rgd)

  return (
    <div className="docs-tab" data-testid="docs-tab">
      {/* ── API Reference header ──────────────────────────────────────── */}
      <section className="docs-tab__section">
        <div className="docs-tab__header-row">
          <h2 className="docs-tab__kind">{schema.kind || 'Unknown Kind'}</h2>
          <div className="docs-tab__badges">
            <span className="docs-tab__badge docs-tab__badge--group">
              {schema.group}
            </span>
            <span className="docs-tab__badge docs-tab__badge--version">
              {schema.apiVersion}
            </span>
          </div>
        </div>
      </section>

      {/* ── Spec Fields ──────────────────────────────────────────────── */}
      <section className="docs-tab__section">
        <h3 className="docs-tab__section-title">Spec Fields</h3>

        {schema.specFields.length === 0 ? (
          <p className="docs-tab__empty-message" data-testid="no-spec-fields">
            This API has no configurable fields — all behavior is derived from
            status
          </p>
        ) : (
          <FieldTable fields={schema.specFields} variant="spec" />
        )}
      </section>

      {/* ── Status Fields (only when present) ────────────────────────── */}
      {schema.statusFields.length > 0 && (
        <section className="docs-tab__section">
          <h3 className="docs-tab__section-title">Status Fields</h3>
          <FieldTable fields={schema.statusFields} variant="status" />
        </section>
      )}

      {/* ── Example Manifest ─────────────────────────────────────────── */}
      <section className="docs-tab__section">
        <h3 className="docs-tab__section-title">Example Manifest</h3>
        <ExampleYAML schema={schema} />
      </section>
    </div>
  )
}
