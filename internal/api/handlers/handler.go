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
