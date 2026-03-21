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

	"github.com/rs/zerolog"

	"github.com/pnz1990/kro-ui/internal/api/types"
	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// contextManager is the interface used by context handlers.
// Defined at the consumption site per constitution §VI.
type contextManager interface {
	ListContexts() ([]k8sclient.Context, string, error)
	SwitchContext(ctx string) error
	ActiveContext() string
}

// ListContexts returns all kubeconfig contexts and the active one.
func (h *Handler) ListContexts(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())

	contexts, _, err := h.ctxMgr.ListContexts()
	if err != nil {
		log.Error().Err(err).Msg("failed to list contexts")
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, types.ContextsResponse{
		Contexts: contexts,
		Active:   h.ctxMgr.ActiveContext(),
	})
}

// SwitchContext switches the active kubeconfig context.
func (h *Handler) SwitchContext(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())

	var body types.SwitchContextRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.Context == "" {
		respondError(w, http.StatusBadRequest, "context name must not be empty")
		return
	}
	if err := h.ctxMgr.SwitchContext(body.Context); err != nil {
		log.Error().Err(err).Str("context", body.Context).Msg("failed to switch context")
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	log.Info().Str("context", body.Context).Msg("switched context")
	respond(w, http.StatusOK, types.SwitchContextResponse{Active: body.Context})
}
