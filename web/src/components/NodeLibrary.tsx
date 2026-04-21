// Copyright 2025 The kro Authors
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

// NodeLibrary.tsx — Designer node library panel.
//
// A collapsible panel showing common Kubernetes resource templates organized by
// category. Clicking a template adds it as a new resource in the authoring form.
//
// Design ref: docs/design/31-rgd-designer.md §Future → ✅
// Spec: issue-543

import { useState } from 'react'
import type { AuthoringResource, ForEachIterator } from '@/lib/generator'
import './NodeLibrary.css'

// ── Template definitions ──────────────────────────────────────────────────

/** A resource template shown in the node library. */
export interface NodeTemplate {
  /** Display name shown in the library. */
  label: string
  /** Short description shown on hover. */
  description: string
  /** apiVersion of the resource. */
  apiVersion: string
  /** kind of the resource. */
  kind: string
  /**
   * Starter template YAML body (everything that goes inside `template:`).
   * CEL expressions use ${...} syntax.
   */
  templateYaml: string
}

/** A category grouping templates in the library. */
export interface NodeCategory {
  /** Category display label. */
  label: string
  /** Templates in this category, ordered by familiarity. */
  templates: NodeTemplate[]
}

const DEPLOYMENT_TEMPLATE = `metadata:
  name: \${schema.spec.name}
  labels:
    app: \${schema.spec.name}
spec:
  replicas: \${schema.spec.replicas}
  selector:
    matchLabels:
      app: \${schema.spec.name}
  template:
    metadata:
      labels:
        app: \${schema.spec.name}
    spec:
      containers:
        - name: app
          image: \${schema.spec.image}`

const SERVICE_TEMPLATE = `metadata:
  name: \${schema.spec.name}
spec:
  selector:
    app: \${schema.spec.name}
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP`

const CONFIGMAP_TEMPLATE = `metadata:
  name: \${schema.spec.name}-config
data:
  key: value`

const SECRET_TEMPLATE = `metadata:
  name: \${schema.spec.name}-secret
type: Opaque
stringData:
  password: \${schema.spec.password}`

const SERVICEACCOUNT_TEMPLATE = `metadata:
  name: \${schema.spec.name}-sa`

const INGRESS_TEMPLATE = `metadata:
  name: \${schema.spec.name}-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
    - host: \${schema.spec.hostname}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: \${schema.spec.name}
                port:
                  number: 80`

const HPA_TEMPLATE = `metadata:
  name: \${schema.spec.name}-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: \${schema.spec.name}
  minReplicas: 1
  maxReplicas: \${schema.spec.maxReplicas}
  targetCPUUtilizationPercentage: 80`

const PDB_TEMPLATE = `metadata:
  name: \${schema.spec.name}-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: \${schema.spec.name}`

const CLUSTERROLE_TEMPLATE = `metadata:
  name: \${schema.spec.name}-role
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]`

const CLUSTERROLEBINDING_TEMPLATE = `metadata:
  name: \${schema.spec.name}-binding
subjects:
  - kind: ServiceAccount
    name: \${schema.spec.name}-sa
    namespace: \${schema.metadata.namespace}
roleRef:
  kind: ClusterRole
  name: \${schema.spec.name}-role
  apiGroup: rbac.authorization.k8s.io`

const STATEFULSET_TEMPLATE = `metadata:
  name: \${schema.spec.name}
  labels:
    app: \${schema.spec.name}
spec:
  replicas: \${schema.spec.replicas}
  selector:
    matchLabels:
      app: \${schema.spec.name}
  serviceName: \${schema.spec.name}
  template:
    metadata:
      labels:
        app: \${schema.spec.name}
    spec:
      containers:
        - name: app
          image: \${schema.spec.image}`

/** All categories shown in the node library, ordered by usefulness. */
export const NODE_LIBRARY_CATEGORIES: NodeCategory[] = [
  {
    label: 'Workloads',
    templates: [
      {
        label: 'Deployment',
        description: 'Stateless application workload with replicas and rolling updates.',
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        templateYaml: DEPLOYMENT_TEMPLATE,
      },
      {
        label: 'StatefulSet',
        description: 'Stateful application workload with stable network identity and storage.',
        apiVersion: 'apps/v1',
        kind: 'StatefulSet',
        templateYaml: STATEFULSET_TEMPLATE,
      },
    ],
  },
  {
    label: 'Networking',
    templates: [
      {
        label: 'Service',
        description: 'Expose a set of pods as a network service inside the cluster.',
        apiVersion: 'v1',
        kind: 'Service',
        templateYaml: SERVICE_TEMPLATE,
      },
      {
        label: 'Ingress',
        description: 'HTTP/S routing from outside the cluster to services.',
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        templateYaml: INGRESS_TEMPLATE,
      },
    ],
  },
  {
    label: 'Config & Secrets',
    templates: [
      {
        label: 'ConfigMap',
        description: 'Store non-sensitive key-value configuration data.',
        apiVersion: 'v1',
        kind: 'ConfigMap',
        templateYaml: CONFIGMAP_TEMPLATE,
      },
      {
        label: 'Secret',
        description: 'Store sensitive data such as passwords and tokens.',
        apiVersion: 'v1',
        kind: 'Secret',
        templateYaml: SECRET_TEMPLATE,
      },
    ],
  },
  {
    label: 'Scaling & Availability',
    templates: [
      {
        label: 'HorizontalPodAutoscaler',
        description: 'Automatically scale pods based on CPU or custom metrics.',
        apiVersion: 'autoscaling/v2',
        kind: 'HorizontalPodAutoscaler',
        templateYaml: HPA_TEMPLATE,
      },
      {
        label: 'PodDisruptionBudget',
        description: 'Ensure minimum pod availability during voluntary disruptions.',
        apiVersion: 'policy/v1',
        kind: 'PodDisruptionBudget',
        templateYaml: PDB_TEMPLATE,
      },
    ],
  },
  {
    label: 'Identity & Access',
    templates: [
      {
        label: 'ServiceAccount',
        description: 'Identity for processes running in a pod.',
        apiVersion: 'v1',
        kind: 'ServiceAccount',
        templateYaml: SERVICEACCOUNT_TEMPLATE,
      },
      {
        label: 'ClusterRole',
        description: 'Cluster-wide RBAC permission set.',
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRole',
        templateYaml: CLUSTERROLE_TEMPLATE,
      },
      {
        label: 'ClusterRoleBinding',
        description: 'Bind a ClusterRole to a subject (user, group, or ServiceAccount).',
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRoleBinding',
        templateYaml: CLUSTERROLEBINDING_TEMPLATE,
      },
    ],
  },
]

// ── Helper ────────────────────────────────────────────────────────────────

function newResourceKey(): string {
  return `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function newForEachKey(): string {
  return `fe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Convert a NodeTemplate to a partial AuthoringResource with sensible defaults.
 * The caller is responsible for merging into the full AuthoringResource shape.
 */
export function templateToResource(tpl: NodeTemplate): AuthoringResource {
  const fek: ForEachIterator = {
    _key: newForEachKey(),
    variable: '',
    expression: '',
  }
  return {
    _key: newResourceKey(),
    id: tpl.kind.toLowerCase(),
    apiVersion: tpl.apiVersion,
    kind: tpl.kind,
    resourceType: 'managed',
    templateYaml: tpl.templateYaml,
    includeWhen: '',
    readyWhen: [],
    forEachIterators: [fek],
    externalRef: {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      namespace: '',
      name: '',
      selectorLabels: [],
    },
  }
}

// ── NodeLibrary component ─────────────────────────────────────────────────

export interface NodeLibraryProps {
  /** Called when the user clicks a template to add it to the authoring form. */
  onAddResource: (resource: AuthoringResource) => void
}

/**
 * NodeLibrary — collapsible panel showing common resource templates.
 *
 * Renders categories as collapsible sections. Each template is a clickable
 * chip that appends a pre-filled AuthoringResource to the form via onAddResource.
 *
 * Design ref: docs/design/31-rgd-designer.md §Future → ✅
 */
export default function NodeLibrary({ onAddResource }: NodeLibraryProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(NODE_LIBRARY_CATEGORIES.map((c) => c.label)),
  )
  const [addedKey, setAddedKey] = useState<string | null>(null)

  function toggleCategory(label: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function handleAdd(tpl: NodeTemplate) {
    const resource = templateToResource(tpl)
    onAddResource(resource)
    // Flash feedback
    const key = `${tpl.apiVersion}/${tpl.kind}`
    setAddedKey(key)
    setTimeout(() => setAddedKey(null), 900)
  }

  return (
    <div className="node-library" data-testid="node-library">
      <div className="node-library__header">
        <span className="node-library__title">Node Library</span>
        <button
          className="node-library__collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-controls="node-library-body"
          title={collapsed ? 'Expand node library' : 'Collapse node library'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div id="node-library-body" className="node-library__body" role="list">
          <p className="node-library__hint">
            Click a template to add it as a resource
          </p>
          {NODE_LIBRARY_CATEGORIES.map((cat) => {
            const isOpen = expandedCategories.has(cat.label)
            return (
              <div key={cat.label} className="node-library__category" role="listitem">
                <button
                  className="node-library__category-header"
                  onClick={() => toggleCategory(cat.label)}
                  aria-expanded={isOpen}
                >
                  <span className="node-library__category-chevron">{isOpen ? '▾' : '▸'}</span>
                  <span className="node-library__category-label">{cat.label}</span>
                  <span className="node-library__category-count">
                    {cat.templates.length}
                  </span>
                </button>
                {isOpen && (
                  <ul className="node-library__template-list" role="list">
                    {cat.templates.map((tpl) => {
                      const key = `${tpl.apiVersion}/${tpl.kind}`
                      const justAdded = addedKey === key
                      return (
                        <li key={key} className="node-library__template-item" role="listitem">
                          <button
                            className={
                              'node-library__template-btn' +
                              (justAdded ? ' node-library__template-btn--added' : '')
                            }
                            onClick={() => handleAdd(tpl)}
                            title={tpl.description}
                            aria-label={`Add ${tpl.kind} resource`}
                            data-testid={`node-library-add-${tpl.kind}`}
                          >
                            <span className="node-library__template-label">{tpl.label}</span>
                            <span className="node-library__template-add" aria-hidden="true">
                              {justAdded ? '✓' : '+'}
                            </span>
                          </button>
                          <p className="node-library__template-desc">{tpl.description}</p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
