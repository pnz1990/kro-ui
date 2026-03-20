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
