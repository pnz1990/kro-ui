// DeepDAG.tsx — Deep graph with recursive RGD instance expansion.
//
// Wraps LiveDAG to detect kro-managed CRD nodes and allow recursive expansion.
// Expansion state is held in this component and survives poll refreshes (FR-007).
//
// Architecture:
//   - Renders the top-level graph as a custom SVG (like LiveDAG but with ExpandableNode
//     for kro-managed CRD nodes)
//   - On expand: fetches child RGD spec + child instance + children, then builds
//     a nested DeepDAG recursively
//   - Max recursion depth = 4 (FR-006)
//
// Spec: .specify/specs/012-rgd-chaining-deep-graph/

import { useState, useMemo, useCallback, useRef } from 'react'
import type { DAGGraph, DAGNode } from '@/lib/dag'
import { buildDAGGraph, detectKroInstance, nodeBadge, liveStateClass, forEachLabel } from '@/lib/dag'
import type { NodeStateMap, NodeLiveState } from '@/lib/instanceNodeState'
import { buildNodeStateMap } from '@/lib/instanceNodeState'
import type { K8sObject } from '@/lib/api'
import { getRGD, getInstance, getInstanceChildren, listInstances } from '@/lib/api'
import CollectionBadge from './CollectionBadge'
import ExpandableNode from './ExpandableNode'
import type { ExpandedNodeData } from './ExpandableNode'
import DAGTooltip from './DAGTooltip'
import type { DAGTooltipTarget } from './DAGTooltip'
import './LiveDAG.css'
import './DeepDAG.css'

// ── Types ───────────────────────────────────────────────────────────────────

interface ChildInstanceData {
  childGraph: DAGGraph
  childStateMap: NodeStateMap
  childChildren: K8sObject[]
}

interface NodeExpansionState {
  isExpanded: boolean
  loading: boolean
  error: string | null
  data: ChildInstanceData | null
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface DeepDAGProps {
  /** The top-level DAG graph (built from the parent RGD spec). */
  graph: DAGGraph
  /** Live state map for the top-level instance. */
  nodeStateMap: NodeStateMap
  /** Called when any node (top-level or nested) is clicked for inspection. */
  onNodeClick?: (node: DAGNode) => void
  /** ID of the currently selected node. */
  selectedNodeId?: string
  /** Top-level instance children (for forEach badges). */
  children?: K8sObject[]
  /** All RGDs from the cluster — used to detect kro-managed CRD nodes (FR-001). */
  rgds: K8sObject[]
  /** Namespace of the top-level instance — used to fetch child instances. */
  namespace: string
  /**
   * Current recursion depth. 0 = top level.
   * DeepDAG will not show expand icons when depth >= 4 (FR-006).
   */
  depth?: number
}

// ── Helpers (shared helpers imported from @/lib/dag) ─────────────────────

function nodeState(node: DAGNode, stateMap: NodeStateMap): NodeLiveState | undefined {
  if (node.nodeType === 'instance') {
    const states = Object.values(stateMap).map((e) => e.state)
    if (states.includes('reconciling')) return 'reconciling'
    if (states.includes('error')) return 'error'
    if (states.length > 0) return 'alive'
    return undefined
  }
  const kindKey = (node.kind || node.label).toLowerCase()
  return stateMap[kindKey]?.state
}

function edgePath(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
): string {
  const x1 = from.x + from.width / 2
  const y1 = from.y + from.height
  const x2 = to.x + to.width / 2
  const y2 = to.y
  const dy = Math.max((y2 - y1) * 0.4, 20)
  return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`
}

function standardNodeClassName(
  node: DAGNode,
  state: NodeLiveState | undefined,
  isSelected: boolean,
): string {
  const parts = ['dag-node', `dag-node--${node.nodeType}`]
  if (node.isConditional) parts.push('node-conditional')
  if (state) parts.push(liveStateClass(state))
  if (isSelected) parts.push('dag-node--selected')
  return parts.join(' ')
}

// ── DeepDAG ──────────────────────────────────────────────────────────────────

/**
 * DeepDAG — renders a live DAG with recursive expansion of kro-managed CRD nodes.
 *
 * Expansion state is stored in this component and survives re-renders triggered
 * by the parent's 5s poll cycle (FR-007).
 *
 * Spec: .specify/specs/012-rgd-chaining-deep-graph/
 */
export default function DeepDAG({
  graph,
  nodeStateMap,
  onNodeClick,
  selectedNodeId,
  children,
  rgds,
  namespace,
  depth = 0,
}: DeepDAGProps) {
  // ── Expansion state ────────────────────────────────────────────────────────
  // Map from nodeId → NodeExpansionState
  // Using useState (not useRef) so that expansions trigger re-renders.
  const [expansionMap, setExpansionMap] = useState<Map<string, NodeExpansionState>>(
    () => new Map()
  )

  // ── Hover tooltip state ────────────────────────────────────────────────────
  const [hoveredTooltip, setHoveredTooltip] = useState<DAGTooltipTarget | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // ── Node → RGD name index ─────────────────────────────────────────────────
  // Build a kind → rgdName lookup from the RGD list (same logic as catalog.ts).
  const kindToRGDName = useMemo(() => {
    const map = new Map<string, string>()
    for (const rgd of rgds) {
      const spec = rgd.spec
      if (typeof spec !== 'object' || spec === null) continue
      const schema = (spec as Record<string, unknown>).schema
      if (typeof schema !== 'object' || schema === null) continue
      const schemaKind = (schema as Record<string, unknown>).kind
      const meta = rgd.metadata
      const rgdName = typeof meta === 'object' && meta !== null
        ? (meta as Record<string, unknown>).name
        : undefined
      if (typeof schemaKind === 'string' && typeof rgdName === 'string') {
        map.set(schemaKind, rgdName)
      }
    }
    return map
  }, [rgds])

  // ── Toggle expansion for a node ────────────────────────────────────────────
  const handleToggle = useCallback((node: DAGNode) => {
    const current = expansionMap.get(node.id)

    if (current?.isExpanded) {
      // Collapse: just flip the flag — keep cached data (FR-007)
      setExpansionMap((prev) => {
        const next = new Map(prev)
        next.set(node.id, { ...current, isExpanded: false })
        return next
      })
      return
    }

    if (current?.data) {
      // Already have data — just expand without fetching again
      setExpansionMap((prev) => {
        const next = new Map(prev)
        next.set(node.id, { ...current, isExpanded: true })
        return next
      })
      return
    }

    // Fetch child data
    const rgdName = kindToRGDName.get(node.kind)
    if (!rgdName) return

    // Set loading state
    setExpansionMap((prev) => {
      const next = new Map(prev)
      next.set(node.id, { isExpanded: true, loading: true, error: null, data: null })
      return next
    })

    // Find the child instance name via listInstances, then fetch details
    Promise.all([
      getRGD(rgdName),
      listInstances(rgdName, namespace),
    ])
      .then(([childRGD, instanceList]) => {
        // Find the instance whose kind matches and name can be found from children
        const instances = instanceList.items ?? []
        // The child instance name is typically in the parent children list
        // keyed by kind. We use the first matching instance found.
        const matchingInstance = instances.find((inst) => {
          const meta = inst.metadata as Record<string, unknown> | undefined
          return meta !== undefined
        })
        if (!matchingInstance) {
          throw new Error(`No ${node.kind} instance found in namespace ${namespace}`)
        }
        const meta = matchingInstance.metadata as Record<string, unknown>
        const instName = typeof meta.name === 'string' ? meta.name : ''
        const instNs = typeof meta.namespace === 'string' ? meta.namespace : namespace
        if (!instName) throw new Error('Instance has no name')

        return Promise.all([
          Promise.resolve(childRGD),
          getInstance(instNs, instName, rgdName),
          getInstanceChildren(instNs, instName, rgdName),
        ])
      })
      .then(([childRGD, childInstance, childrenResp]) => {
        const childSpec = childRGD.spec as Record<string, unknown> | undefined
        if (!childSpec) throw new Error('Child RGD has no spec')
        const childGraph = buildDAGGraph(childSpec)
        const childStateMap = buildNodeStateMap(childInstance, childrenResp.items ?? [])
        const childChildren = childrenResp.items ?? []

        setExpansionMap((prev) => {
          const next = new Map(prev)
          next.set(node.id, {
            isExpanded: true,
            loading: false,
            error: null,
            data: { childGraph, childStateMap, childChildren },
          })
          return next
        })
      })
      .catch((err: Error) => {
        setExpansionMap((prev) => {
          const next = new Map(prev)
          next.set(node.id, {
            isExpanded: true,
            loading: false,
            error: err.message || 'Failed to load child instance',
            data: null,
          })
          return next
        })
      })
  }, [expansionMap, kindToRGDName, namespace])

  // ── Build node map for edge rendering ─────────────────────────────────────
  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes],
  )

  // ── Compute expanded node heights (for SVG viewBox) ───────────────────────
  // We need to extend the SVG height to accommodate expanded subgraphs.
  // For each expanded node, add its nested height below it.
  const expandedHeightAdditions = useMemo(() => {
    let extra = 0
    for (const [nodeId, expState] of expansionMap) {
      if (!expState.isExpanded) continue
      const nestedHeight = expState.data
        ? expState.data.childGraph.height + 32 + 8 + 8  // header + padding
        : 60 + 32 + 8                                    // loading/error
      const node = nodeMap.get(nodeId)
      if (node) {
        // How much extra space below this node's bottom?
        const nodeBottom = node.y + node.height
        const graphBottom = graph.height
        const alreadyHas = Math.max(0, graphBottom - nodeBottom)
        extra = Math.max(extra, nestedHeight + 8 - alreadyHas)
      }
    }
    return extra
  }, [expansionMap, nodeMap, graph.height])

  const svgHeight = graph.height + Math.max(0, expandedHeightAdditions)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="dag-graph-container live-dag-container deep-dag-container">
      <svg
        ref={svgRef}
        data-testid="dag-svg"
        width={graph.width}
        height={svgHeight}
        viewBox={`0 0 ${graph.width} ${svgHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Live resource dependency graph"
        role="img"
      >
        <defs>
          <marker
            id={`deep-dag-arrowhead-${depth}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 1 L 9 5 L 0 9 z"
              style={{ fill: 'var(--color-border)' }}
            />
          </marker>
        </defs>

        {/* Edges */}
        <g aria-hidden="true">
          {graph.edges.map((edge) => {
            const fromNode = nodeMap.get(edge.from)
            const toNode = nodeMap.get(edge.to)
            if (!fromNode || !toNode) return null
            return (
              <path
                key={`${edge.from}→${edge.to}`}
                className="dag-edge"
                d={edgePath(fromNode, toNode)}
                markerEnd={`url(#deep-dag-arrowhead-${depth})`}
              />
            )
          })}
        </g>

        {/* Nodes */}
        <g>
          {graph.nodes.map((node) => {
            const state = nodeState(node, nodeStateMap)
            const isSelected = node.id === selectedNodeId
            const isKroNode = detectKroInstance(node.kind, rgds)
            const expState = expansionMap.get(node.id)

            // Kro-managed CRD nodes → ExpandableNode
            if (isKroNode) {
              const expandedNodeData: ExpandedNodeData | undefined =
                expState?.data
                  ? {
                      nestedWidth: expState.data.childGraph.width,
                      nestedHeight: expState.data.childGraph.height + 32 + 8,
                      content: (
                        <DeepDAG
                          graph={expState.data.childGraph}
                          nodeStateMap={expState.data.childStateMap}
                          children={expState.data.childChildren}
                          rgds={rgds}
                          namespace={namespace}
                          depth={depth + 1}
                          onNodeClick={onNodeClick}
                          selectedNodeId={selectedNodeId}
                        />
                      ),
                    }
                  : undefined

              return (
                <ExpandableNode
                  key={node.id}
                  node={node}
                  state={state}
                  isSelected={isSelected}
                  onNodeClick={onNodeClick}
                  onToggle={() => handleToggle(node)}
                  isExpanded={expState?.isExpanded ?? false}
                  depth={depth}
                  expandedData={expandedNodeData}
                  childLoading={expState?.loading}
                  childError={expState?.error ?? undefined}
                />
              )
            }

            // Standard nodes (identical to LiveDAG NodeGroup)
            const badge = nodeBadge(node)
            const cx = node.x + node.width / 2
            // Fixed pixel offsets — safe for both 48px (resource) and 60px (collection) nodes.
            const labelY = node.y + 17
            const kindY = node.y + 32
            const forEachY = node.y + 45
            const badgeX = node.x + node.width - 10
            const badgeY = node.y + 10

            return (
              <g
                key={node.id}
                data-testid={`dag-node-${node.id}`}
                className={standardNodeClassName(node, state, isSelected)}
                tabIndex={0}
                role="button"
                aria-label={`${node.label} (${node.nodeType})`}
                aria-pressed={isSelected}
                onClick={() => onNodeClick?.(node)}
                onMouseEnter={() => {
                  const svgRect = svgRef.current?.getBoundingClientRect()
                  if (!svgRect) return
                  setHoveredTooltip({
                    node,
                    anchorX: svgRect.left + node.x,
                    anchorY: svgRect.top + node.y,
                    nodeWidth: node.width,
                    nodeHeight: node.height,
                  })
                }}
                onMouseLeave={() => setHoveredTooltip(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onNodeClick?.(node)
                  }
                }}
              >
                <rect
                  className="dag-node-rect"
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={8}
                />
                <text className="dag-node-label" x={cx} y={labelY}>
                  {node.label}
                </text>
                {node.kind && (
                  <text className="dag-node-kind" x={cx} y={kindY}>
                    {node.kind}
                  </text>
                )}
                {forEachLabel(node.forEach) && (
                  <text
                    data-testid={`dag-node-foreach-${node.id}`}
                    className="dag-node-foreach"
                    x={cx}
                    y={forEachY}
                    aria-label={`forEach: ${node.forEach}`}
                  >
                    <title>{node.forEach}</title>
                    {forEachLabel(node.forEach)}
                  </text>
                )}
                {badge && (
                  <text
                    className={`dag-node-badge dag-node-badge--${
                      node.isConditional ? 'conditional'
                      : node.nodeType === 'collection' ? 'collection'
                      : 'external'
                    }`}
                    x={badgeX}
                    y={badgeY}
                  >
                    {badge}
                  </text>
                )}
                {node.hasReadyWhen && (
                  <text
                    className="dag-node-badge dag-node-badge--ready-when"
                    x={node.x + 10}
                    y={node.y + node.height - 8}
                    aria-label="has readyWhen condition"
                  >
                    ⧖
                  </text>
                )}
                {node.nodeType === 'collection' && children && children.length > 0 && (
                  <CollectionBadge
                    nodeId={node.id}
                    children={children}
                    nodeX={node.x}
                    nodeY={node.y}
                    nodeWidth={node.width}
                    nodeHeight={node.height}
                  />
                )}
              </g>
            )
          })}
        </g>
      </svg>

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
