// Copyright 2026 The Kubernetes Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// RGDDiffView — merged DAG renderer with diff status overlays.
//
// Spec: .specify/specs/009-rgd-graph-diff/ Phase 2 (T009–T012).
// Takes two GraphRevision objects, builds their DAGs, diffs them, and renders
// a single merged SVG where each node/edge is color-coded by DiffStatus.
//
// Node diff badges: + (added), - (removed), ~ (modified).
// Removed nodes render with a dashed border.
// Clicking a modified node shows a before/after CEL panel (FR-006).
//
// Layout: removed nodes use their graphA coordinates; all others use graphB.
// The SVG viewBox is fitted to the union of all node bounding boxes.

import { useState, useRef } from 'react'
import type { K8sObject } from '@/lib/api'
import { buildDAGGraph, nodeBadge, forEachLabel } from '@/lib/dag'
import type { DAGNode } from '@/lib/dag'
import { diffDAGGraphs } from '@/lib/dag-diff'
import type { DiffNode, DiffEdge, DiffGraph } from '@/lib/dag-diff'
import KroCodeBlock from './KroCodeBlock'
import DAGTooltip from './DAGTooltip'
import type { DAGTooltipTarget } from './DAGTooltip'
import './RGDDiffView.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract spec.snapshot from a GraphRevision K8sObject. */
function extractSnapshot(rev: K8sObject): Record<string, unknown> | null {
  const spec = rev.spec
  if (typeof spec !== 'object' || spec === null) return null
  const snapshot = (spec as Record<string, unknown>).snapshot
  if (typeof snapshot !== 'object' || snapshot === null) return null
  return snapshot as Record<string, unknown>
}

/** CSS class suffix for a diff status. */
function diffClass(status: DiffNode['diffStatus']): string {
  switch (status) {
    case 'added':     return 'diff-added'
    case 'removed':   return 'diff-removed'
    case 'modified':  return 'diff-modified'
    case 'unchanged': return 'diff-unchanged'
  }
}

/** Badge character for a diff node. */
function diffBadgeChar(status: DiffNode['diffStatus']): string | null {
  switch (status) {
    case 'added':    return '+'
    case 'removed':  return '−'
    case 'modified': return '~'
    default:         return null
  }
}

/** Cubic bezier path from parent bottom-center to child top-center. */
function edgePath(
  from: DAGNode,
  to: DAGNode,
): string {
  const x1 = from.x + from.width / 2
  const y1 = from.y + from.height
  const x2 = to.x + to.width / 2
  const y2 = to.y
  const dy = Math.max((y2 - y1) * 0.4, 20)
  return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`
}

/** Compute fitted SVG dimensions from all node bounding boxes. */
function fittedDimensions(nodes: DiffNode[]) {
  if (nodes.length === 0) return { width: 400, height: 200 }
  const maxRight = Math.max(...nodes.map((n) => n.x + n.width)) + 32
  const maxBottom = Math.max(...nodes.map((n) => n.y + n.height)) + 32
  return { width: maxRight, height: maxBottom }
}

// ── CEL Diff Panel ────────────────────────────────────────────────────────────

interface CELDiffPanelProps {
  node: DiffNode
  onClose: () => void
}

function CELDiffPanel({ node, onClose }: CELDiffPanelProps) {
  const { prevCEL, nextCEL } = node
  if (!prevCEL || !nextCEL) return null

  const sections: Array<{ label: string; before: string[]; after: string[] }> = []

  if (prevCEL.includeWhen.length > 0 || nextCEL.includeWhen.length > 0) {
    sections.push({
      label: 'includeWhen',
      before: prevCEL.includeWhen,
      after: nextCEL.includeWhen,
    })
  }
  if (prevCEL.readyWhen.length > 0 || nextCEL.readyWhen.length > 0) {
    sections.push({
      label: 'readyWhen',
      before: prevCEL.readyWhen,
      after: nextCEL.readyWhen,
    })
  }
  if (prevCEL.forEach !== nextCEL.forEach) {
    sections.push({
      label: 'forEach',
      before: prevCEL.forEach ? [prevCEL.forEach] : [],
      after:  nextCEL.forEach ? [nextCEL.forEach] : [],
    })
  }

  return (
    <div className="dag-diff-cel-panel" data-testid="dag-diff-cel-panel">
      <div className="dag-diff-cel-panel__header">
        <span className="dag-diff-cel-panel__title">
          CEL changes — <code>{node.id}</code>
        </span>
        <button
          type="button"
          className="dag-diff-cel-panel__close"
          onClick={onClose}
          aria-label="Close CEL diff panel"
        >
          ✕
        </button>
      </div>
      <div className="dag-diff-cel-panel__body">
        {sections.map((s) => (
          <div key={s.label} className="dag-diff-cel-section">
            <div className="dag-diff-cel-section__label">{s.label}</div>
            <div className="dag-diff-cel-section__cols">
              <div className="dag-diff-cel-section__col dag-diff-cel-section__col--before">
                <div className="dag-diff-cel-section__col-header">Before</div>
                {s.before.length > 0 ? (
                  s.before.map((expr, i) => (
                    <KroCodeBlock key={i} code={expr} title={`${s.label} (before)`} />
                  ))
                ) : (
                  <span className="dag-diff-cel-section__empty">—</span>
                )}
              </div>
              <div className="dag-diff-cel-section__col dag-diff-cel-section__col--after">
                <div className="dag-diff-cel-section__col-header">After</div>
                {s.after.length > 0 ? (
                  s.after.map((expr, i) => (
                    <KroCodeBlock key={i} code={expr} title={`${s.label} (after)`} />
                  ))
                ) : (
                  <span className="dag-diff-cel-section__empty">—</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {sections.length === 0 && (
          <p className="dag-diff-cel-panel__no-cel">
            No CEL expression changes detected. Other structural differences may exist.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Diff Node SVG Group ───────────────────────────────────────────────────────

interface DiffNodeGroupProps {
  node: DiffNode
  isSelected: boolean
  onClick: (node: DiffNode) => void
  onHover: (target: DAGTooltipTarget | null) => void
  svgRef: React.RefObject<SVGSVGElement | null>
}

function DiffNodeGroup({ node, isSelected, onClick, onHover, svgRef }: DiffNodeGroupProps) {
  const status = node.diffStatus
  const diffBadge = diffBadgeChar(status)
  const nodeBadgeChar = nodeBadge(node)   // existing type badge (∀, ⬡, etc.)
  const cx = node.x + node.width / 2
  const labelY = node.y + 17
  const kindY = node.y + 32
  const forEachY = node.y + 45
  const badgeX = node.x + node.width - 10
  const badgeY = node.y + 10
  const diffBadgeX = node.x + 12
  const diffBadgeY = node.y + 10

  const className = [
    'dag-node',
    `dag-node--${node.nodeType}`,
    `dag-node--${diffClass(status)}`,
    node.isConditional ? 'node-conditional' : '',
    isSelected ? 'dag-node--selected' : '',
    status === 'removed' ? 'dag-node--removed' : '',
  ].filter(Boolean).join(' ')

  function handleMouseEnter() {
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return
    onHover({
      node,
      anchorX: svgRect.left + node.x,
      anchorY: svgRect.top + node.y,
      nodeWidth: node.width,
      nodeHeight: node.height,
    })
  }

  return (
    <g
      data-testid={`dag-diff-node-${node.id}`}
      data-diff-status={status}
      className={className}
      tabIndex={0}
      role="button"
      aria-label={`${node.label} (${node.nodeType}, ${status})`}
      aria-pressed={isSelected}
      onClick={() => onClick(node)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(node)
        }
      }}
    >
      <rect
        className={`dag-node-rect dag-node-rect--${diffClass(status)}`}
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={8}
        strokeDasharray={status === 'removed' ? '4 3' : undefined}
      />
      <text className="dag-node-label" x={cx} y={labelY}>
        {node.label}
      </text>
      {node.kind && node.kind !== node.id && (
        <text className="dag-node-kind" x={cx} y={kindY}>
          {node.kind}
        </text>
      )}
      {forEachLabel(node.forEach) && (
        <text
          className="dag-node-foreach"
          x={cx}
          y={forEachY}
          aria-label={`forEach: ${node.forEach}`}
        >
          <title>{node.forEach}</title>
          {forEachLabel(node.forEach)}
        </text>
      )}
      {/* Diff status badge: +, −, ~ — top-left corner */}
      {diffBadge && (
        <text
          className={`dag-diff-badge dag-diff-badge--${diffClass(status)}`}
          x={diffBadgeX}
          y={diffBadgeY}
          aria-label={status}
        >
          {diffBadge}
        </text>
      )}
      {/* Node-type badge (∀, ⬡, ?) — top-right corner (same as DAGGraph) */}
      {nodeBadgeChar && (
        <text
          className={`dag-node-badge dag-node-badge--${
            node.isConditional ? 'conditional'
            : node.nodeType === 'collection' ? 'collection'
            : 'external'
          }`}
          x={badgeX}
          y={badgeY}
        >
          {nodeBadgeChar}
        </text>
      )}
    </g>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

function DiffLegend() {
  return (
    <div className="dag-diff-legend" aria-label="Diff legend" data-testid="dag-diff-legend">
      <span className="dag-diff-legend__item dag-diff-legend__item--added">
        <span className="dag-diff-legend__badge">+</span> Added
      </span>
      <span className="dag-diff-legend__item dag-diff-legend__item--removed">
        <span className="dag-diff-legend__badge">−</span> Removed
      </span>
      <span className="dag-diff-legend__item dag-diff-legend__item--modified">
        <span className="dag-diff-legend__badge">~</span> Modified
      </span>
      <span className="dag-diff-legend__item dag-diff-legend__item--unchanged">
        Unchanged
      </span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface RGDDiffViewProps {
  /** The "before" GraphRevision (Rev A). */
  revA: K8sObject
  /** The "after" GraphRevision (Rev B). */
  revB: K8sObject
}

/**
 * RGDDiffView — merged DAG showing the diff between two GraphRevisions.
 *
 * Spec: .specify/specs/009-rgd-graph-diff/ FR-002 through FR-007.
 *
 * - Builds graphA and graphB from spec.snapshot.
 * - Calls diffDAGGraphs to get the merged diff.
 * - Renders a single SVG with color-coded overlays per DiffStatus.
 * - Clicking a modified node shows before/after CEL in a detail panel.
 */
export default function RGDDiffView({ revA, revB }: RGDDiffViewProps) {
  const [selectedNode, setSelectedNode] = useState<DiffNode | null>(null)
  const [hoveredTooltip, setHoveredTooltip] = useState<DAGTooltipTarget | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const snapA = extractSnapshot(revA)
  const snapB = extractSnapshot(revB)

  if (!snapA || !snapB) {
    return (
      <div className="rgd-diff-view rgd-diff-view--error" data-testid="rgd-diff-view-error">
        <p className="rgd-diff-view__error-msg">
          Could not read revision snapshot. The GraphRevision object may be malformed.
        </p>
      </div>
    )
  }

  const graphA = buildDAGGraph(snapA)
  const graphB = buildDAGGraph(snapB)
  const diff: DiffGraph = diffDAGGraphs(graphA, graphB)

  const nodeMap = new Map<string, DiffNode>(diff.nodes.map((n) => [n.id, n]))
  const { width: svgWidth, height: svgHeight } = fittedDimensions(diff.nodes)

  function handleNodeClick(node: DiffNode) {
    if (node.diffStatus === 'modified') {
      setSelectedNode((prev) => (prev?.id === node.id ? null : node))
    } else {
      setSelectedNode(null)
    }
  }

  // Edge color class: added = diff-added, removed = diff-removed, unchanged = neutral
  function edgeClass(edge: DiffEdge): string {
    switch (edge.diffStatus) {
      case 'added':     return 'dag-diff-edge--added'
      case 'removed':   return 'dag-diff-edge--removed'
      default:          return 'dag-edge'
    }
  }

  // Arrow marker IDs per diff status
  function arrowMarkerId(edge: DiffEdge): string {
    switch (edge.diffStatus) {
      case 'added':   return 'dag-arrowhead-added'
      case 'removed': return 'dag-arrowhead-removed'
      default:        return 'dag-arrowhead'
    }
  }

  return (
    <div className="rgd-diff-view" data-testid="rgd-diff-view">
      <DiffLegend />

      <div className="rgd-diff-view__canvas">
        <svg
          ref={svgRef}
          data-testid="dag-diff-svg"
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Resource graph revision diff"
          role="img"
          style={{ display: 'block' }}
        >
          <defs>
            {/* Arrow markers per diff status for color-coded edges */}
            <marker id="dag-arrowhead" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" style={{ fill: 'var(--color-border)' }} />
            </marker>
            <marker id="dag-arrowhead-added" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" style={{ fill: 'var(--color-diff-added)' }} />
            </marker>
            <marker id="dag-arrowhead-removed" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" style={{ fill: 'var(--color-diff-removed)' }} />
            </marker>
          </defs>

          {/* Edges — behind nodes */}
          <g aria-hidden="true">
            {diff.edges.map((edge) => {
              const fromNode = nodeMap.get(edge.from)
              const toNode = nodeMap.get(edge.to)
              if (!fromNode || !toNode) return null
              return (
                <path
                  key={`${edge.from}→${edge.to}`}
                  className={`dag-edge ${edgeClass(edge)}`}
                  d={edgePath(fromNode, toNode)}
                  markerEnd={`url(#${arrowMarkerId(edge)})`}
                  strokeDasharray={edge.diffStatus === 'removed' ? '5 4' : undefined}
                />
              )
            })}
          </g>

          {/* Nodes */}
          <g>
            {diff.nodes.map((node) => (
              <DiffNodeGroup
                key={node.id}
                node={node}
                isSelected={selectedNode?.id === node.id}
                onClick={handleNodeClick}
                onHover={setHoveredTooltip}
                svgRef={svgRef}
              />
            ))}
          </g>
        </svg>
      </div>

      {/* CEL diff detail panel — shown when a modified node is clicked */}
      {selectedNode && selectedNode.diffStatus === 'modified' && (
        <CELDiffPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}

      <DAGTooltip
        node={hoveredTooltip?.node ?? null}
        anchorX={hoveredTooltip?.anchorX ?? 0}
        anchorY={hoveredTooltip?.anchorY ?? 0}
        nodeWidth={hoveredTooltip?.nodeWidth ?? 0}
        nodeHeight={hoveredTooltip?.nodeHeight ?? 0}
      />
    </div>
  )
}
