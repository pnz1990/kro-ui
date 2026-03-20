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

package handlers

import (
	"encoding/json"
	"net/http"
)

// ListContexts returns all kubeconfig contexts and the active one.
func (h *Handler) ListContexts(w http.ResponseWriter, r *http.Request) {
	contexts, active, err := h.factory.ListContexts()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, map[string]any{
		"contexts": contexts,
		"active":   active,
	})
}

// SwitchContext switches the active kubeconfig context.
func (h *Handler) SwitchContext(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Context string `json:"context"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Context == "" {
		respondError(w, http.StatusBadRequest, "body must contain {\"context\": \"name\"}")
		return
	}
	if err := h.factory.SwitchContext(body.Context); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respond(w, http.StatusOK, map[string]string{"active": body.Context})
}
