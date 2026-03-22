// dag.ts — DAG graph builder for kro ResourceGraphDefinitions.
//
// This is the ONLY file that knows about kro field paths
// (spec.resources[].id, spec.resources[].template, etc.).
// The DAGGraph component is purely data-driven and has zero kro knowledge.

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * Exactly the five upstream kro node types from pkg/graph/node.go.
 * No other values are valid.
 */
export type NodeType =
  | 'instance'           // Root CR — synthesized from spec.schema, id = 'schema'
  | 'resource'           // Managed resource — has template, no forEach
  | 'collection'         // forEach fan-out — has template + forEach
  | 'external'           // External ref by name — externalRef.metadata.name
  | 'externalCollection' // External ref by selector — externalRef.metadata.selector

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

// ── Layout constants ──────────────────────────────────────────────────────

const NODE_WIDTH = 180
const NODE_HEIGHT = 48
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
    return id === rootId
      ? { w: ROOT_WIDTH, h: ROOT_HEIGHT }
      : { w: NODE_WIDTH, h: NODE_HEIGHT }
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
export function detectKroInstance(kind: string, rgds: Array<Record<string, unknown>>): boolean {
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

// ── Main export ───────────────────────────────────────────────────────────

/**
 * buildDAGGraph — converts a kro RGD spec into a renderable DAGGraph.
 *
 * This is the ONLY place that knows kro field paths. The DAGGraph component
 * accepts the output and renders it without any kro knowledge.
 *
 * @param spec - The `spec` property of a kro RGD object (rgd.spec)
 */
export function buildDAGGraph(spec: Record<string, unknown>): DAGGraph {
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
    const forEach = typeof res.forEach === 'string' ? res.forEach : undefined
    const includeWhen = asStringArray(res.includeWhen)
    const readyWhen = asStringArray(res.readyWhen)

    // ── Classify node type ───────────────────────────────────────────────
    let nodeType: NodeType
    if (externalRef) {
      const meta = asObject(externalRef.metadata)
      if (meta?.selector !== undefined) {
        nodeType = 'externalCollection'
      } else {
        nodeType = 'external'
      }
    } else if (template && forEach !== undefined) {
      nodeType = 'collection'
    } else {
      // Both "has template" and "no template/externalRef" (fallback) → 'resource'
      nodeType = 'resource'
    }

    // ── Extract kind ─────────────────────────────────────────────────────
    let kind = ''
    if (template) {
      kind = asString(template.kind)
    } else if (externalRef) {
      kind = asString(externalRef.kind)
    }

    // ── Collect CEL expressions for display ──────────────────────────────
    const celExpressions: string[] = []
    if (template) walkTemplate(template, celExpressions)
    else if (externalRef) walkTemplate(externalRef, celExpressions)

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
      x: 0,
      y: 0,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
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
  const { positions, width, height } = layoutDAG(nodeIds, edges, 'schema')

  for (const node of nodes) {
    const pos = positions.get(node.id)
    if (pos) {
      node.x = pos.x
      node.y = pos.y
      node.width = pos.width
      node.height = pos.height
    }
  }

  return { nodes, edges, width, height }
}
