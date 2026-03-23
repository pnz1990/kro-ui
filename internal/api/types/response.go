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

// Package types defines shared API response types used by handlers.
package types

import k8sclient "github.com/pnz1990/kro-ui/internal/k8s"

// ContextsResponse is the response payload for GET /api/v1/contexts.
type ContextsResponse struct {
	Contexts []k8sclient.Context `json:"contexts"`
	Active   string              `json:"active"`
}

// SwitchContextRequest is the request payload for POST /api/v1/contexts/switch.
type SwitchContextRequest struct {
	Context string `json:"context"`
}

// SwitchContextResponse is the response payload for a successful context switch.
type SwitchContextResponse struct {
	Active string `json:"active"`
}

// ErrorResponse is the standard error response payload.
type ErrorResponse struct {
	Error string `json:"error"`
}

// ChildrenResponse is the response payload for instance children.
type ChildrenResponse struct {
	Items []map[string]any `json:"items"`
}

// GVRPermission holds required vs granted permissions for a single GVR managed by an RGD.
type GVRPermission struct {
	Group    string          `json:"group"`
	Version  string          `json:"version"`
	Resource string          `json:"resource"`
	Kind     string          `json:"kind"`
	Required []string        `json:"required"`
	Granted  map[string]bool `json:"granted"`
}

// AccessResponse is the response payload for GET /api/v1/rgds/{name}/access.
type AccessResponse struct {
	ServiceAccount      string `json:"serviceAccount"`
	ServiceAccountFound bool   `json:"serviceAccountFound"`
	// ClusterRole is the name of the primary ClusterRole bound to kro's service account.
	// Empty string means it could not be determined — the frontend should fall back to a placeholder.
	ClusterRole string          `json:"clusterRole"`
	HasGaps     bool            `json:"hasGaps"`
	Permissions []GVRPermission `json:"permissions"`
}

// ClusterHealth represents the aggregated health status of a single cluster context.
// Values: "healthy", "degraded", "unreachable", "kro-not-installed", "auth-failed"
type ClusterHealth string

const (
	ClusterHealthy         ClusterHealth = "healthy"
	ClusterDegraded        ClusterHealth = "degraded"
	ClusterUnreachable     ClusterHealth = "unreachable"
	ClusterKroNotInstalled ClusterHealth = "kro-not-installed"
	ClusterAuthFailed      ClusterHealth = "auth-failed"
)

// ClusterSummary is the per-context summary returned by GET /api/v1/fleet/summary.
type ClusterSummary struct {
	Context           string        `json:"context"`
	Cluster           string        `json:"cluster"`
	Health            ClusterHealth `json:"health"`
	RGDCount          int           `json:"rgdCount"`
	InstanceCount     int           `json:"instanceCount"`
	DegradedInstances int           `json:"degradedInstances"`
	KroVersion        string        `json:"kroVersion"`
	// RGDKinds lists spec.schema.kind values for each RGD present in this cluster.
	// Used by the Fleet compare matrix (FR-005).
	RGDKinds []string `json:"rgdKinds"`
	Error    string   `json:"error,omitempty"`
}

// FleetSummaryResponse is the response payload for GET /api/v1/fleet/summary.
type FleetSummaryResponse struct {
	Clusters []ClusterSummary `json:"clusters"`
}

// ControllerMetricsResponse is the response payload for GET /api/v1/kro/metrics.
// Pointer fields encode as JSON null when the metric was absent in the upstream scrape.
// A null value means "not reported" — never interpret null as zero.
type ControllerMetricsResponse struct {
	// WatchCount is the number of active informers managed by the WatchManager
	// (dynamic_controller_watch_count).
	WatchCount *int64 `json:"watchCount"`
	// GVRCount is the number of instance GVRs currently managed by the dynamic controller
	// (dynamic_controller_gvr_count).
	GVRCount *int64 `json:"gvrCount"`
	// QueueDepth is the current length of the kro dynamic controller workqueue
	// (dynamic_controller_queue_length).
	QueueDepth *int64 `json:"queueDepth"`
	// WorkqueueDepth is the current depth of the underlying client-go workqueue
	// (workqueue_depth{name="dynamic-controller-queue"}). STABLE metric.
	WorkqueueDepth *int64 `json:"workqueueDepth"`
	// ScrapedAt is the RFC3339 timestamp when the upstream endpoint responded.
	ScrapedAt string `json:"scrapedAt"`
}
