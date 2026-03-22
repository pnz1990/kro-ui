// Typed API client — all calls go through here.
// Base URL is empty in production (same origin), proxied in dev via vite.config.ts.

const BASE = '/api/v1'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error(b.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Contexts ─────────────────────────────────────────────────────────

export interface KubeContext {
  name: string
  cluster: string
  user: string
}

export interface ContextsResponse {
  contexts: KubeContext[]
  active: string
}

export const listContexts = () => get<ContextsResponse>('/contexts')
export const switchContext = (context: string) => post<{ active: string }>('/contexts/switch', { context })

// ── RGDs ─────────────────────────────────────────────────────────────

// Unstructured k8s object — we keep it generic so the frontend adapts to
// any kro version without code changes.
export type K8sObject = Record<string, unknown>
export type K8sList = { items: K8sObject[]; metadata: Record<string, unknown> }

export const listRGDs = () => get<K8sList>('/rgds')
export const getRGD = (name: string) => get<K8sObject>(`/rgds/${name}`)
export const listInstances = (rgdName: string, namespace?: string) => {
  const qs = namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''
  return get<K8sList>(`/rgds/${encodeURIComponent(rgdName)}/instances${qs}`)
}

// ── Instances ────────────────────────────────────────────────────────

export const getInstance = (namespace: string, name: string, rgd: string) =>
  get<K8sObject>(`/instances/${namespace}/${name}?rgd=${encodeURIComponent(rgd)}`)

export const getInstanceEvents = (namespace: string, name: string) =>
  get<K8sList>(`/instances/${namespace}/${name}/events`)

export const getInstanceChildren = (namespace: string, name: string, rgd: string) =>
  get<{ items: K8sObject[] }>(`/instances/${namespace}/${name}/children?rgd=${encodeURIComponent(rgd)}`)

// ── Capabilities ─────────────────────────────────────────────────────

export interface KroCapabilities {
  version: string
  apiVersion: string
  featureGates: Record<string, boolean>
  knownResources: string[]
  schema: {
    hasForEach: boolean
    hasExternalRef: boolean
    hasExternalRefSelector: boolean
    hasScope: boolean
    hasTypes: boolean
  }
}

export const getCapabilities = () => get<KroCapabilities>('/kro/capabilities')

// ── Events ───────────────────────────────────────────────────────────

export const listEvents = (namespace?: string, rgd?: string) => {
  const params = new URLSearchParams()
  if (namespace) params.set('namespace', namespace)
  if (rgd) params.set('rgd', rgd)
  const qs = params.toString() ? '?' + params.toString() : ''
  return get<K8sList>(`/events${qs}`)
}

// ── Raw resource ─────────────────────────────────────────────────────

export const getResource = (namespace: string, group: string, version: string, kind: string, name: string) =>
  get<K8sObject>(`/resources/${namespace}/${group || '_'}/${version}/${kind}/${name}`)
