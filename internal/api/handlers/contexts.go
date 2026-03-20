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
