// DAGLegend.tsx — Compact legend explaining DAG node badge symbols.
//
// Rendered below the static chain DAG SVG on the RGD detail Graph tab
// (depth === 0 only — not shown inside nested subgraph renders).
//
// Badge symbols explained:
//   ?  — conditional resource (includeWhen CEL expression)
//   ∀  — forEach collection fan-out
//   ⬡  — external reference node
//
// Note: readyWhen CEL expressions are surfaced via the node tooltip and
// NodeDetailPanel, not as a standalone glyph badge from nodeBadge(). They
// are intentionally omitted from this legend — the legend only lists glyphs
// that appear directly on DAG node rects.
//
// Spec: .specify/specs/034-generate-form-polish/ FR-006, FR-007, FR-008
// Issue: #118

import './DAGLegend.css'

export default function DAGLegend() {
  return (
    <div className="dag-legend" aria-label="DAG node badge legend">
      <span className="dag-legend__entry">
        <span className="dag-legend__badge dag-legend__badge--conditional" aria-hidden="true">?</span>
        conditional (includeWhen)
      </span>
      <span className="dag-legend__entry">
        <span className="dag-legend__badge dag-legend__badge--collection" aria-hidden="true">∀</span>
        forEach collection
      </span>
      <span className="dag-legend__entry">
        <span className="dag-legend__badge dag-legend__badge--external" aria-hidden="true">⬡</span>
        external reference
      </span>
    </div>
  )
}
