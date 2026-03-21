// instanceNodeState.test.ts — unit tests for buildNodeStateMap.
// Maps child resources + instance conditions → per-node live state.

import { describe, it, expect } from 'vitest'
import { buildNodeStateMap } from './instanceNodeState'
import type { K8sObject } from './api'

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

describe('buildNodeStateMap', () => {
  // ── T010: alive when child exists + no error condition ─────────────────

  it('T010: returns alive when child resource exists and Ready=True', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])
    const children = [makeChild('ConfigMap', 'my-instance-configmap')]

    const stateMap = buildNodeStateMap(instance, children)

    // configmap child → node with kind ConfigMap should map to alive
    // The state is per-node-id, not per-kind; we test by looking at the
    // result keys that correspond to the configmap node label "configmap"
    const configmapEntry = Object.entries(stateMap).find(
      ([, v]) => v.kind === 'ConfigMap',
    )
    expect(configmapEntry).toBeDefined()
    expect(configmapEntry![1].state).toBe('alive')
  })

  // ── T011: reconciling when Progressing=True ────────────────────────────

  it('T011: returns reconciling for all nodes when Progressing=True', () => {
    const instance = makeInstance([{ type: 'Progressing', status: 'True' }])
    const children = [makeChild('ConfigMap', 'my-instance-configmap')]

    const stateMap = buildNodeStateMap(instance, children)

    const configmapEntry = Object.entries(stateMap).find(
      ([, v]) => v.kind === 'ConfigMap',
    )
    expect(configmapEntry![1].state).toBe('reconciling')
  })

  // ── T012: map is empty when children list is empty ────────────────────

  it('T012: map is empty (no entries) when children list is empty', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])

    const stateMap = buildNodeStateMap(instance, [])

    // With no children, the map has no entries — the caller treats absent entries as not-found
    expect(Object.keys(stateMap)).toHaveLength(0)
  })

  it('T012b: child present in list maps to alive; child absent from list is not in map', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'True' }])
    const children = [makeChild('ConfigMap', 'my-instance-configmap')]

    const stateMap = buildNodeStateMap(instance, children)

    // ConfigMap is in the children list → appears in map as alive
    expect(stateMap['configmap']).toBeDefined()
    expect(stateMap['configmap'].state).toBe('alive')

    // Namespace was NOT in children → not in map at all
    expect(stateMap['namespace']).toBeUndefined()
  })

  // ── T013: error when Ready=False ──────────────────────────────────────

  it('T013: returns error when Ready=False', () => {
    const instance = makeInstance([{ type: 'Ready', status: 'False' }])
    const children = [makeChild('ConfigMap', 'my-instance-configmap')]

    const stateMap = buildNodeStateMap(instance, children)

    const configmapEntry = Object.entries(stateMap).find(
      ([, v]) => v.kind === 'ConfigMap',
    )
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

    // Should not throw
    expect(() => buildNodeStateMap(instance, children)).not.toThrow()

    const stateMap = buildNodeStateMap(instance, children)

    // Without conditions, children that exist map to 'alive' (found but no error)
    const configmapEntry = Object.entries(stateMap).find(
      ([, v]) => v.kind === 'ConfigMap',
    )
    expect(configmapEntry![1].state).toBe('alive')
  })

  // ── T015: Progressing takes precedence over Ready ─────────────────────

  it('T015: reconciling state takes precedence when both Progressing=True and Ready=True', () => {
    const instance = makeInstance([
      { type: 'Ready', status: 'True' },
      { type: 'Progressing', status: 'True' },
    ])
    const children = [makeChild('ConfigMap', 'my-instance-configmap')]

    const stateMap = buildNodeStateMap(instance, children)

    const configmapEntry = Object.entries(stateMap).find(
      ([, v]) => v.kind === 'ConfigMap',
    )
    expect(configmapEntry![1].state).toBe('reconciling')
  })
})
