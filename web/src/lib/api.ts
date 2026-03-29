// Typed API client — all calls go through here.
// Base URL is empty in production (same origin), proxied in dev via vite.config.ts.

const BASE = '/api/v1'

async function get<T>(path: string, options?: { signal?: AbortSignal }): Promise<T> {
  const res = await fetch(BASE + path, { signal: options?.signal })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // Issue #250: guard against non-string body.error (object/number/false)
    // which would produce "[object Object]" via new Error(non-string).
    const msg = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return res.json()
}

async function post<T>(path: string, body: unknown, options?: { signal?: AbortSignal }): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options?.signal,
  })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    // Issue #250: same non-string guard for the POST path
    const msg = typeof b.error === 'string' ? b.error : `HTTP ${res.status}`
    throw new Error(msg)
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
// Issue #256: accept AbortSignal so ContextSwitcher can cancel a zombie request
// when its 10s timeout fires before the server responds.
export const switchContext = (context: string, options?: { signal?: AbortSignal }) =>
  post<{ active: string }>('/contexts/switch', { context }, options)

// ── RGDs ─────────────────────────────────────────────────────────────

// Unstructured k8s object — we keep it generic so the frontend adapts to
// any kro version without code changes.
export type K8sObject = Record<string, unknown>
// items may be null when the Kubernetes API server returns an empty UnstructuredList
// (some kro versions serialise an absent items array as JSON null rather than []).
// All callers must use `list.items ?? []` for safe iteration.
export type K8sList = { items: K8sObject[] | null; metadata: Record<string, unknown> }

export const listRGDs = () => get<K8sList>('/rgds')
export const getRGD = (name: string) => get<K8sObject>(`/rgds/${name}`)
export const listInstances = (rgdName: string, namespace?: string, options?: { signal?: AbortSignal }) => {
  const qs = namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''
  return get<K8sList>(`/rgds/${encodeURIComponent(rgdName)}/instances${qs}`, options)
}

// ── Global instance search (spec 058) ────────────────────────────────────────

/** Compact instance summary returned by GET /api/v1/instances */
export interface InstanceSummary {
  name: string
  namespace: string
  kind: string
  rgdName: string
  state: string
  ready: string
  /** Ready condition message — non-empty only when Ready≠True. Shown as tooltip on status indicator. */
  message?: string
  creationTimestamp: string
}

export interface AllInstancesResponse {
  items: InstanceSummary[]
  total: number
}

/**
 * List all live CR instances across ALL RGDs.
 * Fan-out on the backend: each RGD has a 2s deadline, results merged.
 * Spec: .specify/specs/058-global-instance-search/spec.md
 */
export const listAllInstances = (options?: { signal?: AbortSignal }) =>
  get<AllInstancesResponse>('/instances', options)

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
    hasGraphRevisions: boolean
  }
  /**
   * True when the connected kro version is >= the minimum supported version
   * (v0.8.0). When false, the UI shows a version warning banner.
   * Spec: .specify/specs/053-multi-version-kro/spec.md
   */
  isSupported: boolean
}

export const getCapabilities = () => get<KroCapabilities>('/kro/capabilities')

// ── GraphRevisions (kro v0.9.0+) ─────────────────────────────────────

/** List GraphRevision objects for a given RGD name, sorted descending by spec.revision. */
export const listGraphRevisions = (rgdName: string) =>
  get<K8sList>(`/kro/graph-revisions?rgd=${encodeURIComponent(rgdName)}`)

/** Fetch a single GraphRevision by its Kubernetes resource name. */
export const getGraphRevision = (name: string) =>
  get<K8sObject>(`/kro/graph-revisions/${encodeURIComponent(name)}`)

// ── Events ───────────────────────────────────────────────────────────

export const listEvents = (namespace?: string, rgd?: string) => {
  const params = new URLSearchParams()
  if (namespace) params.set('namespace', namespace)
  if (rgd) params.set('rgd', rgd)
  const qs = params.toString() ? '?' + params.toString() : ''
  return get<K8sList>(`/events${qs}`)
}

// ── Raw resource ─────────────────────────────────────────────────────

// Cluster-scoped resources (Namespace, ClusterRole, PV, etc.) have no
// metadata.namespace. Use "_" as a sentinel — parallel to the group sentinel —
// so chi can route the request without a double-slash in the URL path.
// The backend decodes "_" back to "" and uses the non-namespaced client-go GET.
export const getResource = (namespace: string, group: string, version: string, kind: string, name: string) =>
  get<K8sObject>(`/resources/${namespace || '_'}/${group || '_'}/${version}/${kind}/${name}`)

// ── RBAC Access ──────────────────────────────────────────────────────

export interface GVRPermission {
  group: string
  version: string
  resource: string
  kind: string
  required: string[]
  granted: Record<string, boolean>
}

export interface AccessResponse {
  serviceAccount: string
  serviceAccountFound: boolean
  /** The name of the primary ClusterRole bound to kro's SA. Empty if not found. */
  clusterRole: string
  hasGaps: boolean
  permissions: GVRPermission[]
}

export const getRGDAccess = (
  rgdName: string,
  opts?: { saNamespace?: string; saName?: string },
) => {
  const params = new URLSearchParams()
  if (opts?.saNamespace) params.set('saNamespace', opts.saNamespace)
  if (opts?.saName) params.set('saName', opts.saName)
  const query = params.toString() ? `?${params.toString()}` : ''
  return get<AccessResponse>(`/rgds/${encodeURIComponent(rgdName)}/access${query}`)
}

// ── Fleet ─────────────────────────────────────────────────────────────

export type ClusterHealth = 'healthy' | 'degraded' | 'unreachable' | 'kro-not-installed' | 'auth-failed'

export interface ClusterSummary {
  context: string
  cluster: string
  health: ClusterHealth
  rgdCount: number
  instanceCount: number
  degradedInstances: number
  /** Instances in the IN_PROGRESS (reconciling) state — not degraded but pending. Optional: absent on older kro-ui backends. */
  reconcilingInstances?: number
  kroVersion: string
  rgdKinds: string[]
  error?: string
}

export interface FleetSummaryResponse {
  clusters: ClusterSummary[]
}

export const getFleetSummary = () => get<FleetSummaryResponse>('/fleet/summary')

// ── Controller Metrics ────────────────────────────────────────────────

/**
 * Snapshot of kro controller operational counters.
 * Null fields mean the metric was absent in the upstream scrape —
 * they must be rendered as "Not reported", never as 0.
 */
export interface ControllerMetrics {
  watchCount: number | null
  gvrCount: number | null
  queueDepth: number | null
  workqueueDepth: number | null
  /** ISO 8601 timestamp of the last successful scrape */
  scrapedAt: string
}

export const getControllerMetrics = () => get<ControllerMetrics>('/kro/metrics')

/**
 * Fetches controller metrics for a specific kubeconfig context.
 * Use this for Fleet-page per-cluster fan-out. Returns null fields when the
 * kro pod is not found in that context (graceful degradation — not an error).
 */
export const getControllerMetricsForContext = (context: string): Promise<ControllerMetrics> =>
  get<ControllerMetrics>(`/kro/metrics?context=${encodeURIComponent(context)}`)

// ── Version ───────────────────────────────────────────────────────────

export interface VersionResponse {
  version: string
  commit: string
  buildDate: string
}

export const getVersion = () => get<VersionResponse>('/version')

// ── RGD Designer Validation (spec 045) ───────────────────────────────────

/**
 * Result of a dry-run cluster validation (POST /api/v1/rgds/validate).
 * Valid=true means kro's admission webhook accepted the object in dry-run mode.
 * Nothing is persisted to the cluster.
 */
export type DryRunResult =
  | { valid: true }
  | { valid: false; error: string }

/**
 * A single issue from offline kro-library static validation.
 * field: dot-path identifying the affected schema location.
 * message: kro's error text.
 */
export interface StaticIssue {
  field: string
  message: string
}

/** Response payload for POST /api/v1/rgds/validate/static. */
export interface StaticValidationResult {
  issues: StaticIssue[]
}

/**
 * Dry-run cluster validate — sends the YAML to the backend which performs a
 * dryRun=All apply via the dynamic client. Nothing is persisted.
 * Throws on non-OK HTTP responses.
 */
export async function validateRGD(yaml: string): Promise<DryRunResult> {
  const res = await fetch(BASE + '/rgds/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: yaml,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<DryRunResult>
}

/**
 * Offline static validate — uses kro's own Go libraries to check SimpleSchema
 * types, CEL syntax, and resource ID format without contacting the cluster.
 * Best-effort: never throws — returns { issues: [] } on any error.
 */
export async function validateRGDStatic(yaml: string): Promise<StaticValidationResult> {
  try {
    const res = await fetch(BASE + '/rgds/validate/static', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: yaml,
    })
    if (!res.ok) return { issues: [] }
    return res.json() as Promise<StaticValidationResult>
  } catch {
    // Silent degradation — static validation must not crash the form
    return { issues: [] }
  }
}
