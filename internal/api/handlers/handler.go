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

// Package handlers wires HTTP handlers for all API routes.
// All handlers are thin: they call the k8s package, marshal to JSON, and return.
package handlers

import (
	"encoding/json"
	"net/http"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// Handler holds shared dependencies for all route handlers.
type Handler struct {
	factory *k8sclient.ClientFactory
}

// New creates a Handler with the given ClientFactory.
func New(factory *k8sclient.ClientFactory) *Handler {
	return &Handler{factory: factory}
}

// respond encodes v as JSON and writes it to w with the given status.
func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// respondError writes a JSON error response.
func respondError(w http.ResponseWriter, status int, msg string) {
	respond(w, status, map[string]string{"error": msg})
}
