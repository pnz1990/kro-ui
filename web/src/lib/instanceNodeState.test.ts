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
// State map is keyed by kro.run/node-id label (not by kind).

import { describe, it, expect } from 'vitest'
import { buildNodeStateMap } from './instanceNodeState'
import type { K8sObject } from './api'
import type { DAGNode } from './dag'

// ── Helpers ───────────────────────────────────────────────────────────────

/** Child WITH kro.run/node-id label (kro ≥ 0.8.0 — the normal case). */
function makeChild(
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

/** Child WITHOUT kro.run/node-id (kube-generated or kro < 0.8.0). */
function makeChildNoLabel(kind: string, name: string, namespace = 'default'): K8sObject {
  return {
    apiVersion: 'v1',
    kind,
    metadata: { name, namespace },
  }
}

/** Instance with kro status.state set (kro v0.8.5 field). */
function makeInstanceWithKroState(
  kroState: string,
  conditions: Array<{ type: string; status: string }>,
): K8sObject {
  return {
    metadata: { name: 'my-instance', namespace: 'default' },
    spec: {},
    status: {
      state: kroState,
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

function makeNode(
  id: string,
  kind: string,
  nodeType: DAGNode['nodeType'] = 'resource',
  includeWhen: string[] = [],
): DAGNode {
  return {
    id,
    label: id,
    nodeType,
    kind,
    isConditional: includeWhen.length > 0,
    hasReadyWhen: false,
    celExpressions: [],
    includeWhen,
    readyWhen: [],
    isChainable: false,
    x: 0,
    y: 0,
    width: 180,
    height: 48,
  }
}

describe('buildNodeStateMap', () => {
  // ── T010: alive when child has node-id + no error condition ───────────────

  it('T010: returns alive for a child keyed by kro.run/node-id', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])
    const children = [makeChild('ConfigMap', 'my-configmap', 'appConfig')]

    const stateMap = buildNodeStateMap(instance, children, [])

    expect(stateMap['appConfig']?.state).toBe('alive')
    expect(stateMap['appConfig']?.kind).toBe('ConfigMap')
  })

  // ── T010b: children WITHOUT node-id are silently skipped ─────────────────

  it('T010b: children without kro.run/node-id (kube-generated) are silently skipped', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])
    const children = [
      makeChild('Service', 'my-svc', 'appService'),
      makeChildNoLabel('EndpointSlice', 'my-svc-abc12'),
    ]

    const stateMap = buildNodeStateMap(instance, children, [])

    expect(Object.keys(stateMap)).toHaveLength(1)
    expect(stateMap['appService']?.state).toBe('alive')
    expect(stateMap['endpointslice']).toBeUndefined()
  })

  // ── T011: reconciling when Progressing=True ────────────────────────────

  it('T011: returns reconciling for all nodes when Progressing=True', () => {
    const instance = makeInstance([{ type: 'Progressing', status: 'True' }])
    const children = [makeChild('ConfigMap', 'my-configmap', 'appConfig')]

    const stateMap = buildNodeStateMap(instance, children, [])

    expect(stateMap['appConfig']?.state).toBe('reconciling')
  })

  // ── T011b: GraphProgressing=True (kro v0.8.x compat) ────────────────────

  it('T011b: returns reconciling when GraphProgressing=True (kro v0.8.x compat)', () => {
    const instance = makeInstance([{ type: 'GraphProgressing', status: 'True' }])
    const children = [makeChild('ConfigMap', 'my-configmap', 'appConfig')]

    const stateMap = buildNodeStateMap(instance, children, [])

    expect(stateMap['appConfig']?.state).toBe('reconciling')
  })

  // ── T011c: GraphProgressing takes precedence over Ready=False ───────────

  it('T011c: GraphProgressing=True wins over Ready=False (reconciling > error)', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'False' },
      { type: 'GraphProgressing', status: 'True' },
    ])
    const children = [makeChild('ConfigMap', 'my-configmap', 'appConfig')]

    const stateMap = buildNodeStateMap(instance, children, [])

    expect(stateMap['appConfig']?.state).toBe('reconciling')
  })

  // ── T011d: kro status.state === 'IN_PROGRESS' → reconciling ─────────────

  it('T011d: returns reconciling when kro status.state is IN_PROGRESS', () => {
    const instance = makeInstanceWithKroState('IN_PROGRESS', [
      { type: 'InstanceManaged', status: 'True' },
      { type: 'GraphResolved', status: 'True' },
      { type: 'ResourcesReady', status: 'False' },
      { type: 'Ready', status: 'False' },
    ])
    const children = [makeChild('ConfigMap', 'my-configmap', 'appConfig')]

    const stateMap = buildNodeStateMap(instance, children, [])

    expect(stateMap['appConfig']?.state).toBe('reconciling')
  })

  it('T011e: IN_PROGRESS wins over Ready=False (reconciling > error)', () => {
    const instance = makeInstanceWithKroState('IN_PROGRESS', [
      { type: 'Ready', status: 'False' },
    ])
    const children = [makeChild('ConfigMap', 'my-configmap', 'appConfig')]

    const stateMap = buildNodeStateMap(instance, children, [])

    expect(stateMap['appConfig']?.state).toBe('reconciling')
  })

  it('T011f: ACTIVE kro state with Ready=True stays alive', () => {
    const instance = makeInstanceWithKroState('ACTIVE', [
      { type: 'Ready', status: 'True' },
    ])
    const children = [makeChild('ConfigMap', 'my-configmap', 'appConfig')]

    const stateMap = buildNodeStateMap(instance, children, [])

    expect(stateMap['appConfig']?.state).toBe('alive')
  })

  // ── T012: empty inputs ────────────────────────────────────────────────────

  it('T012: map is empty when both children and rgdNodes are empty', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])

    const stateMap = buildNodeStateMap(instance, [], [])

    expect(Object.keys(stateMap)).toHaveLength(0)
  })

  it('T012b: child present maps to alive; absent node in rgdNodes maps to not-found', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])
    const children = [makeChild('ConfigMap', 'my-configmap', 'appConfig')]
    const nodes = [
      makeNode('schema', 'WebApp', 'instance'),
      makeNode('appConfig', 'ConfigMap'),
      makeNode('appNamespace', 'Namespace'),
    ]

    const stateMap = buildNodeStateMap(instance, children, nodes)

    expect(stateMap['appConfig']?.state).toBe('alive')
    expect(stateMap['appNamespace']?.state).toBe('not-found')
  })

  // ── T013: error when Ready=False ──────────────────────────────────────

  it('T013: returns error when Ready=False', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'False' }])
    const children = [makeChild('ConfigMap', 'my-configmap', 'appConfig')]

    const stateMap = buildNodeStateMap(instance, children, [])

    expect(stateMap['appConfig']?.state).toBe('error')
  })

  // ── T014: handles absent conditions gracefully ─────────────────────────

  it('T014: handles instance with no conditions without crashing', () => {
    const instance: K8sObject = {
      metadata: { name: 'my-instance', namespace: 'default' },
      spec: {},
      status: {},
    }
    const children = [makeChild('ConfigMap', 'my-configmap', 'appConfig')]

    expect(() => buildNodeStateMap(instance, children, [])).not.toThrow()

    const stateMap = buildNodeStateMap(instance, children, [])
    expect(stateMap['appConfig']?.state).toBe('alive')
  })

  // ── T015: Progressing takes precedence over Ready ─────────────────────

  it('T015: reconciling takes precedence when both Progressing=True and Ready=True', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'True' },
      { type: 'Progressing', status: 'True' },
    ])
    const children = [makeChild('ConfigMap', 'my-configmap', 'appConfig')]

    const stateMap = buildNodeStateMap(instance, children, [])

    expect(stateMap['appConfig']?.state).toBe('reconciling')
  })

  // ── T016: two ConfigMaps with different node-ids (the core bug) ───────────

  it('T016: two ConfigMaps with different node-ids both get correct independent state', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])
    const children = [
      makeChild('ConfigMap', 'my-app-config', 'appConfig'),
      makeChild('ConfigMap', 'my-app-status', 'appStatus'),
    ]

    const stateMap = buildNodeStateMap(instance, children, [])

    expect(stateMap['appConfig']?.name).toBe('my-app-config')
    expect(stateMap['appStatus']?.name).toBe('my-app-status')
    expect(stateMap['appConfig']?.state).toBe('alive')
    expect(stateMap['appStatus']?.state).toBe('alive')
  })

  // ── T017: EndpointSlice does not corrupt appService node state ────────────

  it('T017: EndpointSlice without node-id does not affect Service state lookup', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])
    const children = [
      makeChild('Service', 'demo-proxy-svc', 'appService'),
      makeChildNoLabel('EndpointSlice', 'demo-proxy-svc-f2hlq'),
    ]
    const nodes = [makeNode('appService', 'Service')]

    const stateMap = buildNodeStateMap(instance, children, nodes)

    expect(stateMap['appService']?.state).toBe('alive')
    expect(stateMap['appService']?.kind).toBe('Service')
    expect(stateMap['endpointslice']).toBeUndefined()
  })

  // ── T018: includeWhen absent node → 'pending' ─────────────────────────────

  it('T018: absent node with includeWhen gets pending state (violet on DAG)', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])
    const nodes = [
      makeNode('appConfig', 'ConfigMap', 'resource', ['${schema.spec.enableConfig}']),
    ]

    const map = buildNodeStateMap(instance, [], nodes)

    expect(map['appConfig']?.state).toBe('pending')
  })

  // ── T019: id="appNamespace", kind="Namespace" — id ≠ kind ────────────────

  it('T019: node where id differs from kind is correctly keyed by id not kind', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])
    const children = [makeChild('Namespace', 'kro-ui-test', 'appNamespace', '')]
    const nodes = [makeNode('appNamespace', 'Namespace')]

    const map = buildNodeStateMap(instance, children, nodes)

    expect(map['appNamespace']?.state).toBe('alive')
    expect(map['appNamespace']?.kind).toBe('Namespace')
    expect(map['namespace']).toBeUndefined()
  })

  // ── AC-019: crashloop-app — two Deployments, different states ─────────────

  describe('AC-019 — two same-kind nodes with different states (crashloop-app scenario)', () => {
    it('goodDeploy=reconciling, badDeploy=error when conditions differ', () => {
      const instance = makeInstance([{ type: 'Ready', status: 'True' }])
      const badDeploy = {
        apiVersion: 'apps/v1', kind: 'Deployment',
        metadata: { name: 'bad', namespace: 'ns', labels: { 'kro.run/node-id': 'badDeploy' } },
        status: { conditions: [{ type: 'Available', status: 'False' }, { type: 'Progressing', status: 'False' }] },
      } as K8sObject
      const goodDeploy = {
        apiVersion: 'apps/v1', kind: 'Deployment',
        metadata: { name: 'good', namespace: 'ns', labels: { 'kro.run/node-id': 'goodDeploy' } },
        status: { conditions: [{ type: 'Available', status: 'True' }, { type: 'Progressing', status: 'True' }] },
      } as K8sObject

      const map = buildNodeStateMap(instance, [badDeploy, goodDeploy], [
        makeNode('badDeploy', 'Deployment'),
        makeNode('goodDeploy', 'Deployment'),
      ])

      expect(map['badDeploy']?.state).toBe('error')
      expect(map['goodDeploy']?.state).toBe('reconciling')
    })

    it('state-type nodes are never emitted in the map', () => {
      const instance = makeInstance([])
      const map = buildNodeStateMap(instance, [], [
        makeNode('appConfig', 'ConfigMap'),
        makeNode('state-node', 'State', 'state'),
      ])
      expect(map['state-node']).toBeUndefined()
    })
  })
})
