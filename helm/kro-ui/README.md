# kro-ui

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 0.9.4](https://img.shields.io/badge/AppVersion-0.9.4-informational?style=flat-square)

A Helm chart for kro-ui - Kubernetes Resource Orchestrator UI

**Homepage:** <https://github.com/pnz1990/kro-ui>

## Installation

```bash
# Add the repository
helm repo add kro-ui https://pnz1990.github.io/kro-ui-chart
helm repo update

# Install the chart
helm install kro-ui kro-ui/kro-ui --namespace kro-system --create-namespace
```

## Kubeconfig Configuration

kro-ui connects to a Kubernetes cluster using one of two modes (mutually exclusive):

### In-cluster mode (default)

When `kubeconfig.secretName` is not set, kro-ui uses the ServiceAccount token mounted in the pod.
This connects to the cluster where kro-ui is installed.

### External kubeconfig mode

To connect to clusters other than where kro-ui runs, set `kubeconfig.secretName` to reference an existing Secret containing a kubeconfig:

```yaml
kubeconfig:
  secretName: my-kubeconfig   # Name of existing Secret containing kubeconfig
  context: prod-cluster     # Optional: pre-select this context
```

The Secret must contain a valid kubeconfig under the key specified by `kubeconfig.secretKey` (default: "config").

Example Secret:

```bash
kubectl create secret generic my-kubeconfig \
  --from-file=config=/path/to/kubeconfig.yaml \
  -n <namespace>
```

When `kubeconfig.secretName` is set, kro-ui uses the mounted kubeconfig and will NOT use the in-cluster ServiceAccount.

The RBAC for external clusters is handled by the kubeconfig credentials themselves - ensure the user/role in the kubeconfig has appropriate permissions on the target clusters.

## Getting Started

To access the UI, port-forward the service:

```bash
kubectl port-forward -n <namespace> svc/<release-name> 40107:40107
```

Replace `<namespace>` with your namespace and `<release-name>` with your helm release name.
Then open http://localhost:40107

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| namespace | string | `"kro-system"` | Namespace for all resources |
| nameOverride | string | `""` | Overrides the chart's name |
| fullnameOverride | string | `""` | Overrides the chart's computed fullname |
| image.repository | string | `"ghcr.io/pnz1990/kro-ui"` | Image repository |
| image.pullPolicy | string | `"IfNotPresent"` | Image pull policy |
| image.tag | string | `""` | Overrides the image tag (default is chart appVersion) |
| replicaCount | int | `1` | Number of replicas |
| imagePullSecrets | list | `[]` | Image pull secrets for private registries |
| serviceAccount.create | bool | `true` | If true, creates a ServiceAccount |
| serviceAccount.automount | bool | `true` | If true, mounts the ServiceAccount token into the pod |
| serviceAccount.annotations | object | `{}` | Annotations to add to the ServiceAccount |
| serviceAccount.name | string | `""` | Name of the ServiceAccount (defaults to release name if not specified) |
| rbac.create | bool | `true` | If true, creates ClusterRole and ClusterRoleBinding |
| rbac.rules | list | `[{"apiGroups":["kro.run"],"resources":["resourcegraphdefinitions","graphrevisions"],"verbs":["get","list","watch"]},{"apiGroups":["apiextensions.k8s.io"],"resources":["customresourcedefinitions"],"verbs":["get","list","watch"]},{"apiGroups":["*"],"resources":["*"],"verbs":["get","list","watch"]},{"apiGroups":[""],"resources":["events","namespaces"],"verbs":["get","list","watch"]},{"apiGroups":[""],"resources":["pods/proxy"],"verbs":["get"]}]` | RBAC rules for the ClusterRole |
| podAnnotations | object | `{}` | Annotations to add to the Pod |
| podLabels | object | `{}` | Labels to add to the Pod |
| podSecurityContext | object | `{"runAsGroup":65532,"runAsNonRoot":true,"runAsUser":65532,"seccompProfile":{"type":"RuntimeDefault"}}` | Pod security context |
| securityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true}` | Container security context |
| service.type | string | `"ClusterIP"` | Service type |
| service.port | int | `40107` | Service port |
| httproute.enabled | bool | `false` | If true, creates an HTTPRoute for the Gateway |
| httproute.gateway.name | string | `"ingress"` | Gateway name to reference |
| httproute.gateway.namespace | string | `"gateway"` | Gateway namespace |
| httproute.hostnames | list | `["kro.internal"]` | Hostnames to match |
| httproute.annotations | object | `{}` | Annotations to add to the HTTPRoute |
| ingress.enabled | bool | `false` | If true, creates an Ingress |
| ingress.className | string | `""` | Ingress class name |
| ingress.annotations | object | `{}` | Annotations to add to the Ingress |
| ingress.hosts | list | `[{"host":"kro.internal","paths":[{"path":"/","pathType":"ImplementationSpecific"}]}]` | Ingress host configuration |
| ingress.tls | list | `[]` | TLS configuration |
| livenessProbe | object | `{"httpGet":{"path":"/api/v1/healthz","port":"http"}}` | Liveness probe configuration |
| readinessProbe | object | `{"httpGet":{"path":"/api/v1/healthz","port":"http"}}` | Readiness probe configuration |
| resources | object | `{"limits":{"cpu":"200m","memory":"128Mi"},"requests":{"cpu":"50m","memory":"64Mi"}}` | Resource limits and requests |
| autoscaling.enabled | bool | `false` | If true, enables HorizontalPodAutoscaler |
| autoscaling.minReplicas | int | `1` | Minimum number of replicas |
| autoscaling.maxReplicas | int | `100` | Maximum number of replicas |
| autoscaling.targetCPUUtilizationPercentage | int | `80` | Target CPU utilization percentage |
| volumes | list | `[]` | Additional volumes to mount in the pod |
| volumeMounts | list | `[]` | Additional volume mounts for the container |
| kubeconfig | object | `{"context":"","secretKey":"config","secretName":""}` | Name of existing Secret containing kubeconfig. Mutually exclusive with in-cluster mode: when set, kro-ui uses this kubeconfig instead of the ServiceAccount token. Must be set to connect to clusters other than where kro-ui is installed. |
| kubeconfig.secretKey | string | `"config"` | Key in the Secret containing kubeconfig (default: config) |
| kubeconfig.context | string | `""` | Kubernetes context to pre-select from kubeconfig |
| nodeSelector | object | `{}` | Node selector labels |
| tolerations | list | `[]` | Tolerations for node taints |
| affinity | object | `{}` | Affinity rules |
