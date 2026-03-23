// dagTooltip.ts — shared helpers for DAG node hover tooltips.
//
// Used by both DAGGraph.tsx and LiveDAG.tsx to avoid duplicating
// nodeTypeLabel and tokenClass logic across the two components.

import type { NodeType } from '@/lib/dag'
import type { TokenType } from '@/lib/highlighter'

/** Human-readable label for a kro node type. */
export function nodeTypeLabel(nodeType: NodeType): string {
  switch (nodeType) {
    case 'instance':           return 'Root CR'
    case 'resource':           return 'Managed resource'
    case 'collection':         return 'forEach collection'
    case 'external':           return 'External ref'
    case 'externalCollection': return 'External ref collection'
  }
}

/** Map a highlighter TokenType to its tooltip CSS class. */
export function tokenClass(type: TokenType): string {
  switch (type) {
    case 'celExpression':  return 'dag-tooltip-token--cel'
    case 'kroKeyword':     return 'dag-tooltip-token--kw'
    case 'yamlKey':        return 'dag-tooltip-token--key'
    case 'schemaType':     return 'dag-tooltip-token--type'
    case 'schemaPipe':     return 'dag-tooltip-token--pipe'
    case 'schemaKeyword':  return 'dag-tooltip-token--skw'
    case 'schemaValue':    return 'dag-tooltip-token--val'
    case 'comment':        return 'dag-tooltip-token--comment'
    case 'plain':          return ''
  }
}
