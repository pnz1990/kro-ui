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

// instanceNodeState.test.ts — unit tests for buildNodeStateMap.
// Maps child resources + instance conditions → per-node live state.

import { describe, it, expect } from 'vitest'
import { buildNodeStateMap } from './instanceNodeState'
import type { K8sObject } from './api'
import type { DAGNode } from './dag'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeChild(kind: string, name: string, namespace = 'default'): K8sObject {
  return {
    apiVersion: 'v1',
    kind,
    metadata: { name, namespace },
  }
}

function makeInstance(conditions: Array<{ type: string; status: string }>): K8sObject {
  return {
    metadata: { name: 'my-instance', namespace: 'default' },
    spec: {},
    status: {
      conditions: conditions.map((c) => ({
        type: c.type,
        status: c.status,
        reason: 'SomeReason',
        message: '',
        lastTransitionTime: '2026-03-21T00:00:00Z',
      })),
    },
  }
}

function makeNode(id: string, kind: string, nodeType: DAGNode['nodeType'] = 'resource'): DAGNode {
  return {
    id,
    label: id,
    nodeType,
    kind,
    isConditional: false,
    hasReadyWhen: false,
    celExpressions: [],
    includeWhen: [],
    readyWhen: [],
    isChainable: false,
    x: 0,
    y: 0,
    width: 180,
    height: 48,
  }
}

describe('buildNodeStateMap', () => {
  // ── T010: alive when child exists + no error condition ─────────────────

  it('T010: returns alive when child resource exists and Ready=True', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])
    const children = [makeChild('ConfigMap', 'my-instance-configmap')]

    const stateMap = buildNodeStateMap(instance, children, [])

    const configmapEntry = Object.entries(stateMap).find(([, v]) => v.kind === 'ConfigMap')
    expect(configmapEntry).toBeDefined()
    expect(configmapEntry![1].state).toBe('alive')
  })

  // ── T011: reconciling when Progressing=True ────────────────────────────

  it('T011: returns reconciling for all nodes when Progressing=True', () => {
    const instance = makeInstance([{ type: 'Progressing', status: 'True' }])
    const children = [makeChild('ConfigMap', 'my-instance-configmap')]

    const stateMap = buildNodeStateMap(instance, children, [])

    const configmapEntry = Object.entries(stateMap).find(([, v]) => v.kind === 'ConfigMap')
    expect(configmapEntry![1].state).toBe('reconciling')
  })

  // ── T012: map is empty when children and rgdNodes are empty ───────────

  it('T012: map is empty when both children and rgdNodes are empty', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])

    const stateMap = buildNodeStateMap(instance, [], [])

    expect(Object.keys(stateMap)).toHaveLength(0)
  })

  it('T012b: child present maps to alive; absent node in rgdNodes maps to not-found', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])
    const children = [makeChild('ConfigMap', 'my-instance-configmap')]
    const nodes = [
      makeNode('schema', 'WebApp', 'instance'),
      makeNode('configmap', 'ConfigMap'),
      makeNode('namespace', 'Namespace'),
    ]

    const stateMap = buildNodeStateMap(instance, children, nodes)

    expect(stateMap['configmap']?.state).toBe('alive')
    // Namespace was NOT in children → not-found (GH #165 fix)
    expect(stateMap['namespace']?.state).toBe('not-found')
  })

  // ── T013: error when Ready=False ──────────────────────────────────────

  it('T013: returns error when Ready=False', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'False' }])
    const children = [makeChild('ConfigMap', 'my-instance-configmap')]

    const stateMap = buildNodeStateMap(instance, children, [])

    const configmapEntry = Object.entries(stateMap).find(([, v]) => v.kind === 'ConfigMap')
    expect(configmapEntry![1].state).toBe('error')
  })

  // ── T014: handles absent conditions gracefully ─────────────────────────

  it('T014: handles instance with no conditions without crashing', () => {
    const instance: K8sObject = {
      metadata: { name: 'my-instance', namespace: 'default' },
      spec: {},
      status: {},
    }
    const children = [makeChild('ConfigMap', 'my-instance-configmap')]

    expect(() => buildNodeStateMap(instance, children, [])).not.toThrow()

    const stateMap = buildNodeStateMap(instance, children, [])
    const configmapEntry = Object.entries(stateMap).find(([, v]) => v.kind === 'ConfigMap')
    expect(configmapEntry![1].state).toBe('alive')
  })

  // ── T015: Progressing takes precedence over Ready ─────────────────────

  it('T015: reconciling takes precedence when both Progressing=True and Ready=True', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'True' },
      { type: 'Progressing', status: 'True' },
    ])
    const children = [makeChild('ConfigMap', 'my-instance-configmap')]

    const stateMap = buildNodeStateMap(instance, children, [])

    const configmapEntry = Object.entries(stateMap).find(([, v]) => v.kind === 'ConfigMap')
    expect(configmapEntry![1].state).toBe('reconciling')
  })

  // ── AC-019: multi-resource RGD, 6 nodes, 2 present → all 6 entries ────
  // Spec 029 AC-019 — GH #165 fix verification.

  describe('AC-019 — multi-resource RGD: all node entries present, absent nodes are not-found', () => {
    const rgdNodes: DAGNode[] = [
      makeNode('schema', 'WebApp', 'instance'),
      makeNode('deployment', 'Deployment'),
      makeNode('service', 'Service'),
      makeNode('configmap', 'ConfigMap'),
      makeNode('secret', 'Secret'),
      makeNode('ingress', 'Ingress'),
      makeNode('hpa', 'HorizontalPodAutoscaler'),
    ]

    it('emits an entry for every non-state non-instance RGD node', () => {
      const instance = makeInstance([{ type: 'Ready', status: 'True' }])
      const children = [makeChild('Deployment', 'app-dep'), makeChild('Service', 'app-svc')]

      const map = buildNodeStateMap(instance, children, rgdNodes)

      expect(map).toHaveProperty('deployment')
      expect(map).toHaveProperty('service')
      expect(map).toHaveProperty('configmap')
      expect(map).toHaveProperty('secret')
      expect(map).toHaveProperty('ingress')
      expect(map).toHaveProperty('horizontalpodautoscaler')
    })

    it('2 present children are alive, 4 absent nodes are not-found', () => {
      const instance = makeInstance([{ type: 'Ready', status: 'True' }])
      const children = [makeChild('Deployment', 'app-dep'), makeChild('Service', 'app-svc')]

      const map = buildNodeStateMap(instance, children, rgdNodes)

      expect(map['deployment'].state).toBe('alive')
      expect(map['service'].state).toBe('alive')
      expect(map['configmap'].state).toBe('not-found')
      expect(map['secret'].state).toBe('not-found')
      expect(map['ingress'].state).toBe('not-found')
      expect(map['horizontalpodautoscaler'].state).toBe('not-found')
    })

    it('empty children list → all 6 resource nodes are not-found', () => {
      const instance = makeInstance([{ type: 'Ready', status: 'True' }])

      const map = buildNodeStateMap(instance, [], rgdNodes)

      const resourceNodes = rgdNodes.filter(
        (n) => n.nodeType !== 'instance' && n.nodeType !== 'state',
      )
      expect(Object.keys(map)).toHaveLength(resourceNodes.length)
      for (const node of resourceNodes) {
        const key = (node.kind || node.label).toLowerCase()
        expect(map[key]?.state).toBe('not-found')
      }
    })

    it('state-type nodes are not emitted in the map', () => {
      const nodesWithState: DAGNode[] = [
        ...rgdNodes,
        makeNode('state-node', 'State', 'state'),
      ]
      const instance = makeInstance([])
      const map = buildNodeStateMap(instance, [], nodesWithState)
      expect(map['state']).toBeUndefined()
    })
  })

  // ── kind fallback from kro.run/resource-id label ───────────────────────

  it('uses resource-id label when .kind is absent on child resource', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])
    const childWithoutKind: K8sObject = {
      apiVersion: 'apps/v1',
      metadata: {
        name: 'dep',
        namespace: 'default',
        labels: { 'kro.run/resource-id': 'Deployment' },
      },
    } as unknown as K8sObject
    const nodes = [makeNode('deployment', 'Deployment')]

    const map = buildNodeStateMap(instance, [childWithoutKind], nodes)
    expect(map['deployment'].state).toBe('alive')
  })
})
