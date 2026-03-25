// dag.ts — DAG graph builder for kro ResourceGraphDefinitions.
//
// This is the ONLY file that knows about kro field paths
// (spec.resources[].id, spec.resources[].template, etc.).
// The DAGGraph component is purely data-driven and has zero kro knowledge.

import type { K8sObject } from '@/lib/api'
import type { NodeLiveState, NodeStateMap } from '@/lib/instanceNodeState'

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * The five upstream kro node types from pkg/graph/node.go, plus one
 * kro-ui-specific type for kro's `state:` field feature.
 *
 * 'state' — kro state store node: has `state:` block, no `template:`, no
 * `externalRef:`. Produces no Kubernetes objects; mutates kro's internal
 * state store via kstate(). Upstream kro does not yet define NodeTypeState
 * in pkg/graph/node.go — this is a kro-ui rendering decision until upstream
 * formalises it. Detection: presence of `state:` key and absence of `template:`
 * in the resource entry.
 */
export type NodeType =
  | 'instance'           // Root CR — synthesized from spec.schema, id = 'schema'
  | 'resource'           // Managed resource — has template, no forEach
  | 'collection'         // forEach fan-out — has template + forEach
  | 'external'           // External ref by name — externalRef.metadata.name
  | 'externalCollection' // External ref by selector — externalRef.metadata.selector
  | 'state'              // kro state store — has state:, no template: (kro-ui extension)

/**
 * nodeTypeLabel — human-readable label for a kro upstream node type.
 *
 * Defined once here so all components (NodeDetailPanel, LiveNodeDetailPanel,
 * DAGTooltip) share a single source of truth. Never copy-paste this map.
 */
export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  instance:           'Root CR',
  resource:           'Managed Resource',
  collection:         'forEach Collection',
  external:           'External Ref',
  externalCollection: 'External Ref Collection',
  state:              'State Store',
}

/**
 * nodeTypeLabel — returns the display label for a NodeType, falling back to
 * the raw type string if the type is unrecognized (graceful degradation).
 */
export function nodeTypeLabel(type: NodeType): string {
  return NODE_TYPE_LABEL[type] ?? String(type)
}

/** A single node in the dependency graph, with layout coordinates. */
export interface DAGNode {
  // Identity
  id: string
  label: string
  nodeType: NodeType
  kind: string

  // Modifiers (not separate node types)
  isConditional: boolean // true if includeWhen is present and non-empty
  hasReadyWhen: boolean  // true if readyWhen is present and non-empty

  // CEL data (for NodeDetailPanel display)
  celExpressions: string[]
  includeWhen: string[]
  readyWhen: string[]
  forEach?: string

  // Raw data (for advanced inspection)
  template?: Record<string, unknown>
  externalRef?: Record<string, unknown>
  schemaSpec?: Record<string, unknown>   // root node only
  schemaStatus?: Record<string, unknown> // root node only

  // Static chaining fields (spec 025)
  // Set by buildDAGGraph when rgds list is provided.
  isChainable: boolean          // true when kind matches another RGD's spec.schema.kind
  chainedRgdName?: string       // present iff isChainable=true — the metadata.name of the chained RGD

  // Layout coordinates (assigned by layout algorithm)
  x: number
  y: number
  width: number
  height: number
}

/** A directed edge from dependency → dependent. */
export interface DAGEdge {
  from: string // source node ID (the dependency)
  to: string   // target node ID (the dependent)
}

/** Complete graph ready for SVG rendering. */
export interface DAGGraph {
  nodes: DAGNode[]
  edges: DAGEdge[]
  width: number
  height: number
}

/**
 * A group of sibling NodeTypeResource nodes that share the same apiVersion/kind
 * and have structurally similar templates — candidates for forEach collapse.
 * Produced by detectCollapseGroups().
 */
export interface CollapseGroup {
  /** Shared apiVersion across all nodes in the group (empty string if absent in template). */
  apiVersion: string
  /** Shared kind across all nodes in the group. Never empty. */
  kind: string
  /** IDs of the qualifying NodeTypeResource nodes. Always length ≥ 2. */
  nodeIds: string[]
}

// ── Layout constants ──────────────────────────────────────────────────────

const NODE_WIDTH = 180
const NODE_HEIGHT = 48
/** Collection (forEach) nodes are taller to accommodate the forEach annotation row. */
export const COLLECTION_NODE_HEIGHT = 60
const ROOT_WIDTH = 200
const ROOT_HEIGHT = 52
const H_GAP = 40
const V_GAP = 80
const PADDING = 32

// ── CEL expression extraction ─────────────────────────────────────────────

interface ExprMatch {
  expr: string
}

/**
 * Bracket-counting scanner — port of kro's pkg/graph/parser/cel.go:59-116.
 * Handles nested braces (e.g. map literals ${{key: val}}) and string literals.
 */
function extractExpressions(str: string): ExprMatch[] {
  const matches: ExprMatch[] = []
  let start = 0

  while (start < str.length) {
    const startIdx = str.indexOf('${', start)
    if (startIdx === -1) break

    let bracketCount = 1
    let endIdx = startIdx + 2
    let inStringLiteral = false
    let escapeNext = false

    while (endIdx < str.length) {
      const c = str[endIdx]
      if (escapeNext) { escapeNext = false; endIdx++; continue }
      if (inStringLiteral && c === '\\') { escapeNext = true; endIdx++; continue }
      if (c === '"') {
        inStringLiteral = !inStringLiteral
      } else if (!inStringLiteral) {
        if (c === '{') bracketCount++
        else if (c === '}') {
          bracketCount--
          if (bracketCount === 0) break
        }
      }
      endIdx++
    }

    if (bracketCount !== 0) { start++; continue } // incomplete — skip

    matches.push({ expr: str.slice(startIdx + 2, endIdx) })
    start = endIdx + 1
  }
  return matches
}

/** Recursively walk any JSON value and collect all CEL expression strings. */
function walkTemplate(value: unknown, results: string[]): void {
  if (typeof value === 'string') {
    for (const m of extractExpressions(value)) {
      results.push('${' + m.expr + '}')
    }
  } else if (Array.isArray(value)) {
    for (const item of value) walkTemplate(item, results)
  } else if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      walkTemplate(v, results)
    }
  }
}

/**
 * Find all resource IDs referenced in a set of CEL expressions.
 * Checks against the known ID set; ignores forEach iterator variable names.
 */
function extractReferencedIds(
  expressions: string[],
  knownIds: Set<string>,
  excludeVars?: Set<string>,
): string[] {
  const found = new Set<string>()
  const identPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g
  for (const expr of expressions) {
    // Strip outer ${ } if present
    const inner = expr.startsWith('${') && expr.endsWith('}')
      ? expr.slice(2, -1)
      : expr
    let m: RegExpExecArray | null
    identPattern.lastIndex = 0
    while ((m = identPattern.exec(inner)) !== null) {
      const id = m[1]
      if (excludeVars?.has(id)) continue
      if (knownIds.has(id)) found.add(id)
    }
  }
  return [...found]
}

// ── Safe field accessors ──────────────────────────────────────────────────

function asObject(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

// ── Layout algorithm ──────────────────────────────────────────────────────

/** Reorder currentLayer in place using barycenter heuristic. */
function reorderByBarycenter(
  currentLayer: string[],
  fixedLayer: string[],
  getNeighbors: Map<string, string[]>,
): void {
  const posOf = new Map<string, number>()
  for (let i = 0; i < fixedLayer.length; i++) posOf.set(fixedLayer[i], i)

  const bary: Array<{ id: string; value: number; origIdx: number }> = []
  for (let i = 0; i < currentLayer.length; i++) {
    const id = currentLayer[i]
    const neighbors = (getNeighbors.get(id) ?? []).filter((n) => posOf.has(n))
    const value =
      neighbors.length > 0
        ? neighbors.reduce((sum, n) => sum + posOf.get(n)!, 0) / neighbors.length
        : i
    bary.push({ id, value, origIdx: i })
  }

  bary.sort(
    (a, b) => a.value - b.value || a.origIdx - b.origIdx || a.id.localeCompare(b.id),
  )
  for (let i = 0; i < bary.length; i++) currentLayer[i] = bary[i].id
}

interface LayoutResult {
  positions: Map<string, { x: number; y: number; width: number; height: number }>
  width: number
  height: number
}

/** BFS-layered layout algorithm. Returns coordinates per node ID. */
function layoutDAG(
  nodeIds: string[],
  edges: Array<{ from: string; to: string }>,
  rootId: string,
  nodeHeights?: Map<string, number>,
): LayoutResult {
  // Build adjacency maps
  const children = new Map<string, string[]>()
  const parents = new Map<string, string[]>()
  for (const id of nodeIds) { children.set(id, []); parents.set(id, []) }
  for (const e of edges) {
    children.get(e.from)?.push(e.to)
    parents.get(e.to)?.push(e.from)
  }

  // Topological sort (Kahn's algorithm) — alphabetical for determinism
  const inDegree = new Map<string, number>()
  for (const id of nodeIds) inDegree.set(id, 0)
  for (const e of edges) inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1)

  const queue: string[] = [rootId]
  const topoOrder: string[] = []
  const visited = new Set<string>([rootId])

  while (queue.length > 0) {
    queue.sort()
    const node = queue.shift()!
    topoOrder.push(node)
    const sortedChildren = [...(children.get(node) ?? [])].sort()
    for (const child of sortedChildren) {
      const deg = (inDegree.get(child) ?? 1) - 1
      inDegree.set(child, deg)
      if (deg === 0 && !visited.has(child)) {
        visited.add(child)
        queue.push(child)
      }
    }
  }

  // Add any nodes not reached (shouldn't happen with implicit root edges, but safe)
  for (const id of nodeIds) {
    if (!visited.has(id)) topoOrder.push(id)
  }

  // Layer assignment — longest path from root
  const layer = new Map<string, number>()
  layer.set(rootId, 0)
  for (const node of topoOrder) {
    const nodeLayer = layer.get(node) ?? 0
    for (const child of children.get(node) ?? []) {
      layer.set(child, Math.max(layer.get(child) ?? 0, nodeLayer + 1))
    }
  }

  // Group nodes into layers; sort alphabetically for deterministic baseline
  const numLayers = topoOrder.length > 0
    ? Math.max(...topoOrder.map((id) => layer.get(id) ?? 0)) + 1
    : 1
  const layers: string[][] = Array.from({ length: numLayers }, () => [])
  for (const id of topoOrder) layers[layer.get(id) ?? 0].push(id)
  for (const l of layers) l.sort()

  // Crossing reduction — 4 barycenter sweeps
  for (let sweep = 0; sweep < 4; sweep++) {
    if (sweep % 2 === 0) {
      for (let i = 1; i < layers.length; i++) {
        reorderByBarycenter(layers[i], layers[i - 1], parents)
      }
    } else {
      for (let i = layers.length - 2; i >= 0; i--) {
        reorderByBarycenter(layers[i], layers[i + 1], children)
      }
    }
  }

  // Node dimensions
  function dims(id: string) {
    if (id === rootId) return { w: ROOT_WIDTH, h: ROOT_HEIGHT }
    return { w: NODE_WIDTH, h: nodeHeights?.get(id) ?? NODE_HEIGHT }
  }

  // Find widest layer
  let maxLayerWidth = 0
  for (const l of layers) {
    const w = l.reduce((sum, id) => sum + dims(id).w, 0) +
      Math.max(0, l.length - 1) * H_GAP
    if (w > maxLayerWidth) maxLayerWidth = w
  }

  // Assign coordinates
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>()
  let currentY = PADDING

  for (const l of layers) {
    const layerPxWidth = l.reduce((sum, id) => sum + dims(id).w, 0) +
      Math.max(0, l.length - 1) * H_GAP
    const layerHeight = Math.max(...l.map((id) => dims(id).h))
    const startX = PADDING + (maxLayerWidth - layerPxWidth) / 2

    let currentX = startX
    for (const id of l) {
      const { w, h } = dims(id)
      positions.set(id, {
        x: currentX,
        y: currentY + (layerHeight - h) / 2,
        width: w,
        height: h,
      })
      currentX += w + H_GAP
    }
    currentY += layerHeight + V_GAP
  }

  const totalWidth = PADDING * 2 + maxLayerWidth
  const totalHeight = currentY - V_GAP + PADDING

  return { positions, width: totalWidth, height: totalHeight }
}

// ── Shared node-type classifier ───────────────────────────────────────────

/**
 * extractForEachDisplay — extracts a human-readable display string from the
 * kro forEach field, handling both current and legacy formats.
 *
 * kro v0.8.5+ array-of-objects format: [{region: "${schema.spec.regions}"}]
 * → "region: ${schema.spec.regions}"
 *
 * Legacy string format (pre-v0.8.5): "${schema.spec.regions}"
 * → "${schema.spec.regions}"
 *
 * Returns undefined when the field is absent or in an unrecognised format.
 */
function extractForEachDisplay(raw: unknown): string | undefined {
  if (Array.isArray(raw) && raw.length > 0) {
    const parts: string[] = []
    for (const entry of raw) {
      if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
        for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
          if (typeof v === 'string') parts.push(`${k}: ${v}`)
        }
      }
    }
    return parts.length > 0 ? parts.join(', ') : undefined
  }
  if (typeof raw === 'string' && raw.length > 0) return raw
  return undefined
}

/**
 * classifyResource — classify a single raw resource entry into a NodeType.
 *
 * Returns null for the synthetic root ('schema') or any entry that doesn't
 * match a known resource shape.
 *
 * This is the SINGLE source of truth for node-type classification. Both
 * buildDAGGraph and detectCollapseGroups call this function — never inline
 * the classification rules elsewhere.
 *
 * Classification order (checked top-to-bottom):
 *   1. externalRef present → external or externalCollection
 *   2. template + forEach  → collection
 *   3. template only       → resource
 *   4. state: present (no template, no externalRef) → state (kro-ui extension)
 *   5. fallback            → resource
 */
function classifyResource(r: unknown): NodeType | null {
  const res = asObject(r)
  if (!res) return null

  const externalRef = asObject(res.externalRef)
  const template = asObject(res.template)
  const forEach = extractForEachDisplay(res.forEach)

  if (externalRef) {
    const meta = asObject(externalRef.metadata)
    return meta?.selector !== undefined ? 'externalCollection' : 'external'
  }
  if (template && forEach !== undefined) return 'collection'
  if (template) return 'resource'
  // kro state: block — no template, no externalRef.
  // Produces no Kubernetes objects; mutates kro's internal state store.
  if (res.state !== undefined) return 'state'
  return 'resource'
}

// ── Collapse detection ────────────────────────────────────────────────────

/**
 * Compute Jaccard similarity between two sets of string keys.
 * Returns a value in [0, 1].
 */
function jaccardKeys(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const key of a) { if (b.has(key)) intersection++ }
  const union = a.size + b.size - intersection
  return union === 0 ? 1 : intersection / union
}

/**
 * detectCollapseGroups — static analysis of a kro RGD spec to identify
 * sibling NodeTypeResource nodes that share the same apiVersion/kind and
 * have structurally similar templates.
 *
 * These groups are candidates for collapsing into a forEach collection.
 *
 * Returns an empty array for any invalid/absent input (never throws).
 *
 * Spec: .specify/specs/023-rgd-optimization-advisor/
 */
export function detectCollapseGroups(spec: unknown): CollapseGroup[] {
  const specObj = asObject(spec)
  if (!specObj) return []

  const resources = Array.isArray(specObj.resources) ? specObj.resources : []
  if (resources.length === 0) return []

  // Collect qualifying resources: NodeTypeResource only, with a resolvable kind
  interface Candidate {
    id: string
    apiVersion: string
    kind: string
    templateKeys: Set<string>
  }

  const candidates: Candidate[] = []
  for (const r of resources) {
    const res = asObject(r)
    if (!res) continue

    const nodeType = classifyResource(r)
    if (nodeType !== 'resource') continue

    // Must have a non-empty kind
    const template = asObject(res.template)
    const rawKind = template ? asString(template.kind) : ''
    if (!rawKind) continue

    const id = asString(res.id)
    if (!id) continue

    const apiVersion = template ? asString(template.apiVersion) : ''

    // Top-level template keys (excluding apiVersion + kind used for grouping)
    const templateKeys = new Set<string>(
      template
        ? Object.keys(template).filter((k) => k !== 'apiVersion' && k !== 'kind')
        : [],
    )

    candidates.push({ id, apiVersion, kind: rawKind, templateKeys })
  }

  // Group by "apiVersion/kind"
  const groups = new Map<string, Candidate[]>()
  for (const c of candidates) {
    const key = `${c.apiVersion}/${c.kind}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }

  // Filter to qualifying groups
  const result: CollapseGroup[] = []
  for (const [, members] of groups) {
    if (members.length < 2) continue

    // Groups of ≥ 3 always qualify
    if (members.length >= 3) {
      result.push({
        apiVersion: members[0].apiVersion,
        kind: members[0].kind,
        nodeIds: members.map((m) => m.id),
      })
      continue
    }

    // Groups of exactly 2: require ≥ 70% Jaccard similarity of template keys
    const [a, b] = members
    const sim = jaccardKeys(a.templateKeys, b.templateKeys)
    if (sim >= 0.70) {
      result.push({
        apiVersion: a.apiVersion,
        kind: a.kind,
        nodeIds: [a.id, b.id],
      })
    }
  }

  return result
}

// ── Shared DAG rendering helpers ──────────────────────────────────────────

/**
 * fittedWidth — returns the actual content width from node bounding boxes.
 *
 * Analogous to fittedHeight: measures the rightmost edge of any node
 * (node.x + node.width) and adds a small padding to ensure the SVG
 * viewBox is never narrower than the content. Fixes issue #149 where
 * the layout algorithm's totalWidth could be incorrect when nodes are
 * offset due to centering in narrow layers.
 *
 * Falls back to graph.width if the graph has no nodes.
 */
export function fittedWidth(graph: DAGGraph): number {
  if (graph.nodes.length === 0) return graph.width
  const maxRight = Math.max(...graph.nodes.map((n) => n.x + n.width))
  return maxRight + 32 // 32px right-padding (matches PADDING constant)
}

/**
 * Returns the badge character for a DAG node, or null if none applies.
 * The conditional modifier (?) overrides the node-type badge (∀, ⬡).
 * Defined here once; imported by DAGGraph, StaticChainDAG, LiveDAG, DeepDAG.
 * Constitution §IX: shared helpers must not be copy-pasted across components.
 */
export function nodeBadge(node: DAGNode): string | null {
  if (node.isConditional) return '?'
  switch (node.nodeType) {
    case 'collection':          return '∀'
    case 'external':
    case 'externalCollection':  return '⬡'
    case 'state':               return null  // distinguished by fill colour, not badge
    default:                    return null
  }
}

/**
 * Maximum visible character count for the forEach annotation on a DAG node.
 * Based on NODE_WIDTH=180 with 10px padding each side at 9px monospace (~5.4px/char).
 */
export const FOREACH_LABEL_MAX_CHARS = 28

/**
 * Returns a display string for the forEach CEL expression on a DAG node.
 * - Returns '' for absent or empty input (no annotation rendered).
 * - Truncates to 27 chars + '…' when longer than FOREACH_LABEL_MAX_CHARS.
 * Defined here once; imported by all DAG renderer components.
 */
export function forEachLabel(forEach: string | undefined): string {
  if (!forEach) return ''
  if (forEach.length <= FOREACH_LABEL_MAX_CHARS) return forEach
  return forEach.slice(0, FOREACH_LABEL_MAX_CHARS - 1) + '…'
}

/**
 * Maps a live node state to its CSS modifier class string.
 * Defined here once; imported by LiveDAG, StaticChainDAG, and DeepDAG.
 * Constitution §IX: shared helpers must not be copy-pasted across components.
 */
export function liveStateClass(state: NodeLiveState | undefined): string {
  if (!state) return 'dag-node-live--notfound'
  switch (state) {
    case 'alive':       return 'dag-node-live--alive'
    case 'reconciling': return 'dag-node-live--reconciling'
    case 'error':       return 'dag-node-live--error'
    case 'pending':     return 'dag-node-live--pending'
    case 'not-found':   return 'dag-node-live--notfound'
  }
}

/**
 * nodeStateForNode — derives the live state for a single DAG node from a
 * NodeStateMap produced by buildNodeStateMap().
 *
 * Rules:
 *   - Root CR (nodeType 'instance'): aggregate over all entries in stateMap.
 *     Precedence: reconciling > error > alive > undefined.
 *   - All other nodes: direct lookup by lowercase kind (node.kind || node.label).
 *     Returns undefined when no matching child resource was found.
 *
 * Extracted from LiveDAG.tsx and DeepDAG.tsx to a single source of truth.
 * Constitution §IX: shared graph helpers must live in @/lib/dag.ts — never
 * copy-pasted across component files.
 *
 * @param node     - The DAG node to resolve state for
 * @param stateMap - The NodeStateMap built from the live instance + children
 */
export function nodeStateForNode(
  node: DAGNode,
  stateMap: NodeStateMap,
): NodeLiveState | undefined {
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

// ── Chaining detection ────────────────────────────────────────────────────

/**
 * detectKroInstance — returns true when the given kind is managed by one of
 * the provided RGDs (i.e., a ResourceGraphDefinition exists whose
 * spec.schema.kind matches the given kind).
 *
 * FR-001: Used by DeepDAG to decide which nodes show an expand icon.
 *
 * @param kind - The Kubernetes kind string from a DAGNode (e.g. "Database")
 * @param rgds - The full list of RGD objects from the cluster
 */
export function detectKroInstance(kind: string, rgds: K8sObject[]): boolean {
  if (!kind) return false
  for (const rgd of rgds) {
    const spec = rgd.spec
    if (typeof spec !== 'object' || spec === null) continue
    const schema = (spec as Record<string, unknown>).schema
    if (typeof schema !== 'object' || schema === null) continue
    const schemaKind = (schema as Record<string, unknown>).kind
    if (typeof schemaKind === 'string' && schemaKind === kind) return true
  }
  return false
}

/**
 * findChainedRgdName — returns the metadata.name of the RGD whose
 * spec.schema.kind === kind.  Returns undefined when no match or kind is empty.
 *
 * Pure function — no side effects, never throws.
 *
 * Spec 025 FR-001, FR-013.
 */
export function findChainedRgdName(kind: string, rgds: K8sObject[]): string | undefined {
  if (!kind) return undefined
  for (const rgd of rgds) {
    const spec = rgd.spec
    if (typeof spec !== 'object' || spec === null) continue
    const schema = (spec as Record<string, unknown>).schema
    if (typeof schema !== 'object' || schema === null) continue
    const schemaKind = (schema as Record<string, unknown>).kind
    if (typeof schemaKind !== 'string' || schemaKind !== kind) continue
    const meta = rgd.metadata
    if (typeof meta !== 'object' || meta === null) continue
    const name = (meta as Record<string, unknown>).name
    if (typeof name === 'string' && name) return name
  }
  return undefined
}

/**
 * buildChainSubgraph — builds a DAGGraph for a chained RGD by name.
 *
 * Looks up the RGD in rgds by metadata.name, then calls buildDAGGraph on its
 * spec — passing rgds back so nested chains are also detected recursively.
 *
 * Returns null (not throws) when the named RGD is not found.
 *
 * Pure function — no side effects, never throws.
 *
 * Spec 025 FR-004.
 */
export function buildChainSubgraph(rgdName: string, rgds: K8sObject[]): DAGGraph | null {
  for (const rgd of rgds) {
    const meta = rgd.metadata
    if (typeof meta !== 'object' || meta === null) continue
    const name = (meta as Record<string, unknown>).name
    if (name !== rgdName) continue
    const spec = asObject(rgd.spec as unknown)
    if (!spec) return null
    return buildDAGGraph(spec, rgds)
  }
  return null
}

// ── Main export ───────────────────────────────────────────────────────────

/**
 * buildDAGGraph — converts a kro RGD spec into a renderable DAGGraph.
 *
 * This is the ONLY place that knows kro field paths. The DAGGraph component
 * accepts the output and renders it without any kro knowledge.
 *
 * @param spec - The `spec` property of a kro RGD object (rgd.spec)
 * @param rgds - Optional: all known RGDs from the cluster.
 *               When provided, detects chainable nodes and populates
 *               isChainable / chainedRgdName on each non-root node.
 *               When absent, all nodes have isChainable=false (backward compat).
 */
export function buildDAGGraph(spec: Record<string, unknown>, rgds?: K8sObject[]): DAGGraph {
  const schema = asObject(spec.schema)
  const resources = Array.isArray(spec.resources) ? spec.resources : []

  // ── Collect all known resource IDs for CEL reference matching ──────────
  const allIds = new Set<string>(['schema'])
  for (const r of resources) {
    const res = asObject(r)
    if (!res) continue
    const id = asString(res.id)
    if (id) allIds.add(id)
  }

  // ── Build root node (NodeTypeInstance) ────────────────────────────────
  const schemaStatus = asObject(schema?.status)
  const schemaStatusExprs: string[] = []
  if (schemaStatus) walkTemplate(schemaStatus, schemaStatusExprs)

  const rootNode: DAGNode = {
    id: 'schema',
    label: 'schema',
    nodeType: 'instance',
    kind: asString(schema?.kind) || 'Instance',
    isConditional: false,
    hasReadyWhen: false,
    celExpressions: schemaStatusExprs,
    includeWhen: [],
    readyWhen: [],
    schemaSpec: asObject(schema?.spec),
    schemaStatus: schemaStatus,
    isChainable: false,   // root node is never chainable (spec 025 FR-001)
    x: 0,
    y: 0,
    width: ROOT_WIDTH,
    height: ROOT_HEIGHT,
  }

  // ── Build resource nodes ───────────────────────────────────────────────
  const nodes: DAGNode[] = [rootNode]
  const rawEdges: Array<{ from: string; to: string }> = []

  for (const r of resources) {
    const res = asObject(r)
    if (!res) continue

    const id = asString(res.id)
    if (!id) continue

    const template = asObject(res.template)
    const externalRef = asObject(res.externalRef)
    const forEach = extractForEachDisplay(res.forEach)
    const includeWhen = asStringArray(res.includeWhen)
    const readyWhen = asStringArray(res.readyWhen)

    // ── Classify node type ───────────────────────────────────────────────
    const nodeType: NodeType = classifyResource(r) ?? 'resource'

    // ── Extract kind ─────────────────────────────────────────────────────
    // Fallback chain: template.kind → externalRef.kind → nodeId.
    // Never leave kind empty — a '?' kind label on a DAG node is always a bug.
    // A CEL expression like "${schema.spec.kind}" is accepted as-is (raw string).
    let kind = ''
    if (template) {
      kind = asString(template.kind)
    } else if (externalRef) {
      kind = asString(externalRef.kind)
    }
    // If kind is still empty (absent or non-string), fall back to the node ID.
    if (!kind) {
      kind = id
    }

    // ── Collect CEL expressions for display ──────────────────────────────
    const celExpressions: string[] = []
    if (template) walkTemplate(template, celExpressions)
    else if (externalRef) walkTemplate(externalRef, celExpressions)
    else if (asObject(res.state)) walkTemplate(asObject(res.state), celExpressions)

    // ── Extract forEach iterator variable names (to exclude from ID matching)
    const iteratorVars = new Set<string>()
    if (forEach) {
      // forEach is a string like "${schema.spec.regions}" — no iterator vars here
      // Iterator vars are implicit (e.g., "each") and are kro builtins, not resource IDs
    }

    // ── Build edges from CEL references ──────────────────────────────────
    const allExprs = [...celExpressions, ...includeWhen, ...readyWhen]
    const referencedIds = extractReferencedIds(allExprs, allIds, iteratorVars)
    for (const refId of referencedIds) {
      if (refId !== id) {
        rawEdges.push({ from: refId, to: id })
      }
    }

    // ── Static chain detection (spec 025) ────────────────────────────────
    // Only when rgds list is provided; root node is never chainable.
    const chainedRgdName = rgds ? findChainedRgdName(kind, rgds) : undefined
    const isChainable = chainedRgdName !== undefined

    const node: DAGNode = {
      id,
      label: id,
      nodeType,
      kind,
      isConditional: includeWhen.length > 0,
      hasReadyWhen: readyWhen.length > 0,
      celExpressions,
      includeWhen,
      readyWhen,
      forEach,
      template,
      externalRef,
      isChainable,
      chainedRgdName,
      x: 0,
      y: 0,
      width: NODE_WIDTH,
      height: nodeType === 'collection' ? COLLECTION_NODE_HEIGHT : NODE_HEIGHT,
    }
    nodes.push(node)
  }

  // ── Deduplicate edges ─────────────────────────────────────────────────
  const edgeSet = new Set<string>()
  const edges: DAGEdge[] = []
  for (const e of rawEdges) {
    const key = `${e.from}→${e.to}`
    if (!edgeSet.has(key)) {
      edgeSet.add(key)
      edges.push(e)
    }
  }

  // ── Ensure all non-root nodes are reachable from root ─────────────────
  // Build reachability set via BFS
  const toChildren = new Map<string, string[]>()
  for (const e of edges) {
    if (!toChildren.has(e.from)) toChildren.set(e.from, [])
    toChildren.get(e.from)!.push(e.to)
  }
  const reachable = new Set<string>(['schema'])
  const bfsQueue = ['schema']
  while (bfsQueue.length > 0) {
    const cur = bfsQueue.shift()!
    for (const child of toChildren.get(cur) ?? []) {
      if (!reachable.has(child)) {
        reachable.add(child)
        bfsQueue.push(child)
      }
    }
  }
  for (const node of nodes) {
    if (node.id !== 'schema' && !reachable.has(node.id)) {
      const key = `schema→${node.id}`
      if (!edgeSet.has(key)) {
        edgeSet.add(key)
        edges.push({ from: 'schema', to: node.id })
      }
    }
  }

  // ── Layout ────────────────────────────────────────────────────────────
  const nodeIds = nodes.map((n) => n.id)
  const nodeHeights = new Map(nodes.map((n) => [n.id, n.height]))
  const { positions, width, height } = layoutDAG(nodeIds, edges, 'schema', nodeHeights)

  for (const node of nodes) {
    const pos = positions.get(node.id)
    if (pos) {
      node.x = pos.x
      node.y = pos.y
      node.width = pos.width
      // Preserve the node's own height (COLLECTION_NODE_HEIGHT for collection nodes).
    }
  }

  return { nodes, edges, width, height }
}
