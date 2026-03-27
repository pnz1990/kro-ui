// resolveResourceName.test.ts — unit tests for resolveResourceName and resolveChildResourceInfo.
// Covers children-list lookup, CR suffix stripping, kro.run/node-id matching (fix #210).

import { describe, it, expect } from 'vitest'
import { resolveResourceName, resolveChildResourceInfo } from './resolveResourceName'
import type { K8sObject } from './api'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeChild(kind: string, name: string, namespace = 'default'): K8sObject {
  return {
    apiVersion: 'v1',
    kind,
    metadata: { name, namespace },
  }
}

/** Make a child with kro.run/node-id label (kro ≥ 0.8.0). */
function makeChildWithNodeId(
  kind: string,
  name: string,
  nodeId: string,
  namespace = 'default',
  apiVersion = 'v1',
): K8sObject {
  return {
    apiVersion,
    kind,
    metadata: {
      name,
      namespace,
      labels: { 'kro.run/node-id': nodeId },
    },
  }
}

describe('resolveResourceName', () => {
  // ── T020: returns name from children list when present ─────────────────

  it('T020: returns name from children list when a matching kind is found', () => {
    const children = [
      makeChild('Database', 'prod-01-database', 'prod-01'),
      makeChild('ConfigMap', 'prod-01-config', 'prod-01'),
    ]

    const result = resolveResourceName('databaseCR', 'prod-01', children)
    expect(result).toBe('prod-01-database')
  })

  // ── T021: infers name by stripping CR suffix when not in children ───────

  it('T021: infers name by stripping CR suffix when not in children list', () => {
    const children: K8sObject[] = []

    const result = resolveResourceName('databaseCR', 'prod-01', children)
    expect(result).toBe('prod-01-database')
  })

  // ── T022: infers name by stripping CRs suffix ─────────────────────────

  it('T022: infers name by stripping CRs suffix', () => {
    const children: K8sObject[] = []

    const result = resolveResourceName('databaseCRs', 'prod-01', children)
    expect(result).toBe('prod-01-database')
  })

  // ── T023: works when no CR suffix present ────────────────────────────────

  it('T023: uses label as-is when no CR/CRs suffix and not in children list', () => {
    const children: K8sObject[] = []

    const result = resolveResourceName('configmap', 'my-app', children)
    expect(result).toBe('my-app-configmap')
  })

  // ── T024: case-insensitive kind matching in children list ───────────────

  it('T024: matches kind case-insensitively in children list', () => {
    // Node label "databaseCR" → kind hint "database" (after strip)
    // Children contain "Database" (capitalised)
    const children = [
      makeChild('Database', 'prod-01-database', 'prod-01'),
    ]

    const result = resolveResourceName('databaseCR', 'prod-01', children)
    expect(result).toBe('prod-01-database')
  })

  // ── T025: returns instance-name only if label matches instance ──────────

  it('T025: handles schema/root node by returning instance name', () => {
    const children: K8sObject[] = []

    const result = resolveResourceName('schema', 'prod-01', children)
    // schema node → prepend instance name → "prod-01-schema" (or just instance name)
    // The spec says prepend instance name, so: prod-01-schema
    expect(result).toBe('prod-01-schema')
  })

  // ── T026: prefers first child match when multiple same-kind children ────

  it('T026: returns first matching child when multiple children of same kind', () => {
    const children = [
      makeChild('ConfigMap', 'my-app-cm-1', 'default'),
      makeChild('ConfigMap', 'my-app-cm-2', 'default'),
    ]

    const result = resolveResourceName('configmapCR', 'my-app', children)
    // Should return the first match
    expect(result).toBe('my-app-cm-1')
  })
})

// ── resolveChildResourceInfo (fix #210) ───────────────────────────────────
//
// Regression suite for issue #210: Live YAML always showed "CRD not provisioned"
// because resolveChildResourceInfo matched by kindHint derived from the node label
// (resource ID), which almost never equals the child kind in real RGDs.
// Fix: primary match on kro.run/node-id label, fallback to kind, then nodeKind param.

describe('resolveChildResourceInfo — kro.run/node-id matching (T210)', () => {
  // T210-01: primary match via kro.run/node-id
  it('T210-01: matches child by kro.run/node-id when label differs from kind', () => {
    // test-app RGD: resource ID "appNamespace", kind "Namespace"
    const children = [
      makeChildWithNodeId('Namespace', 'kro-ui-test', 'appNamespace', ''),
    ]
    const result = resolveChildResourceInfo('appNamespace', 'test-instance', children)
    expect(result).toEqual({
      kind: 'Namespace',
      name: 'kro-ui-test',
      namespace: '',
      group: '',
      version: 'v1',
    })
  })

  // T210-02: disambiguates two same-kind resources by node-id
  it('T210-02: returns the correct child when two share the same kind (e.g. two ConfigMaps)', () => {
    // test-app: appConfig and appStatus are both ConfigMap
    const children = [
      makeChildWithNodeId('ConfigMap', 'kro-ui-test-config', 'appConfig', 'kro-ui-test'),
      makeChildWithNodeId('ConfigMap', 'kro-ui-test-status', 'appStatus', 'kro-ui-test'),
    ]

    const config = resolveChildResourceInfo('appConfig', 'test-instance', children)
    expect(config?.name).toBe('kro-ui-test-config')

    const status = resolveChildResourceInfo('appStatus', 'test-instance', children)
    expect(status?.name).toBe('kro-ui-test-status')
  })

  // T210-03: cluster-scoped resource — namespace is '' (not undefined)
  it('T210-03: cluster-scoped resource returns namespace as empty string', () => {
    const children = [
      makeChildWithNodeId('Namespace', 'kro-ui-test', 'appNamespace', ''),
    ]
    const result = resolveChildResourceInfo('appNamespace', 'test-instance', children)
    expect(result?.namespace).toBe('')
  })

  // T210-04: non-core apiVersion — group and version parsed correctly
  it('T210-04: parses group and version from non-core apiVersion', () => {
    const child = makeChildWithNodeId(
      'Deployment', 'my-deploy', 'appDeployment', 'default', 'apps/v1',
    )
    const result = resolveChildResourceInfo('appDeployment', 'my-app', [child])
    expect(result?.group).toBe('apps')
    expect(result?.version).toBe('v1')
    expect(result?.kind).toBe('Deployment')
  })

  // T210-05: step-2 fallback — no node-id label, kindHint matches kind
  it('T210-05: falls back to kind match when no kro.run/node-id label (kro < 0.8.0)', () => {
    // Node label "database", kind "Database" — ID equals kind (older style)
    const children = [makeChild('Database', 'prod-01-database', 'prod-ns')]
    const result = resolveChildResourceInfo('database', 'prod-01', children)
    expect(result?.name).toBe('prod-01-database')
    expect(result?.kind).toBe('Database')
  })

  // T210-06: step-3 fallback — no node-id label, no kindHint match, nodeKind provided
  it('T210-06: uses nodeKind param when node label differs from kind and no node-id (kro < 0.8.0)', () => {
    // Label "appDeployment" → kindHint "appdeployment", child kind "Deployment"
    // Only step-3 (nodeKind) can match here
    const children = [makeChild('Deployment', 'my-deploy', 'default')]
    const result = resolveChildResourceInfo('appDeployment', 'my-app', children, 'Deployment')
    expect(result?.name).toBe('my-deploy')
    expect(result?.kind).toBe('Deployment')
  })

  // T210-07: inference fallback — no match at all
  it('T210-07: returns inferred info when no child matches', () => {
    const result = resolveChildResourceInfo('appNamespace', 'test-instance', [])
    // inferredKind = nodeKind (undefined) → kindHint = "appnamespace"
    expect(result?.kind).toBe('appnamespace')
    expect(result?.name).toBe('test-instance-appnamespace')
    expect(result?.namespace).toBe('')
  })

  // T210-08: inference fallback uses nodeKind for kind label when provided
  it('T210-08: inference fallback uses nodeKind for better kind label', () => {
    const result = resolveChildResourceInfo('appNamespace', 'test-instance', [], 'Namespace')
    expect(result?.kind).toBe('Namespace')
    expect(result?.name).toBe('test-instance-appnamespace')
  })

  // T210-09: node-id takes priority over kind match
  it('T210-09: kro.run/node-id match takes priority over kind match', () => {
    // Two ConfigMaps: one has matching node-id, one has matching kindHint
    const children = [
      // This one matches by kind hint ("configmap") but wrong node-id
      makeChildWithNodeId('ConfigMap', 'wrong-cm', 'otherNode', 'default'),
      // This one matches by node-id
      makeChildWithNodeId('ConfigMap', 'correct-cm', 'configmap', 'default'),
    ]
    const result = resolveChildResourceInfo('configmap', 'my-app', children)
    // Node-id match ("configmap") should win over kind-match (would also pick first)
    expect(result?.name).toBe('correct-cm')
  })

  // T210-10: resolveResourceName also prefers kro.run/node-id
  it('T210-10: resolveResourceName matches by kro.run/node-id first', () => {
    const children = [
      makeChildWithNodeId('Namespace', 'kro-ui-test', 'appNamespace', ''),
    ]
    const result = resolveResourceName('appNamespace', 'test-instance', children)
    expect(result).toBe('kro-ui-test')
  })

  // T211: Service + EndpointSlice share node-id — kind tie-break ─────────────

  it('T211-01: prefers Service over EndpointSlice when both share node-id and nodeKind=Service', () => {
    const children = [
      makeChildWithNodeId('EndpointSlice', 'demo-proxy-svc-f2hlq', 'appService', 'ns', 'discovery.k8s.io/v1'),
      makeChildWithNodeId('Service', 'demo-proxy-svc', 'appService', 'ns', 'v1'),
    ]
    const withHint = resolveChildResourceInfo('appService', 'autoscaled-proxy', children, 'Service')
    expect(withHint?.kind).toBe('Service')
    expect(withHint?.name).toBe('demo-proxy-svc')
  })

  it('T211-02: when only Service has node-id label, returns Service regardless', () => {
    const children = [
      makeChild('EndpointSlice', 'demo-proxy-svc-f2hlq', 'ns'),
      makeChildWithNodeId('Service', 'demo-proxy-svc', 'appService', 'ns', 'v1'),
    ]
    const result = resolveChildResourceInfo('appService', 'autoscaled-proxy', children, 'Service')
    expect(result?.kind).toBe('Service')
    expect(result?.name).toBe('demo-proxy-svc')
  })
})
