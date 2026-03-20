package handlers

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// GetInstance returns a single CR instance detail.
// The RGD name is passed as a query param so we can resolve the correct GVR.
func (h *Handler) GetInstance(w http.ResponseWriter, r *http.Request) {
	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")
	rgdName := r.URL.Query().Get("rgd")

	gvr, err := h.resolveInstanceGVR(rgdName)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	obj, err := h.factory.Dynamic().Resource(gvr).Namespace(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respond(w, http.StatusOK, obj)
}

// GetInstanceEvents returns Kubernetes events for a given instance.
func (h *Handler) GetInstanceEvents(w http.ResponseWriter, r *http.Request) {
	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")

	eventsGVR := schema.GroupVersionResource{Group: "", Version: "v1", Resource: "events"}
	fieldSelector := "involvedObject.name=" + name + ",involvedObject.namespace=" + namespace
	list, err := h.factory.Dynamic().Resource(eventsGVR).Namespace(namespace).List(
		context.Background(), metav1.ListOptions{FieldSelector: fieldSelector},
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, list)
}

// GetInstanceChildren returns child resources owned by the instance.
// Uses the kro.run/instance-name label to find all child resources across any kind.
func (h *Handler) GetInstanceChildren(w http.ResponseWriter, r *http.Request) {
	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")
	rgdName := r.URL.Query().Get("rgd")

	children, err := h.listChildResources(namespace, name, rgdName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, map[string]any{"items": children})
}

// GetResource returns the raw unstructured YAML/JSON for any resource.
// This is used by the frontend for node YAML inspection — works for any k8s kind.
func (h *Handler) GetResource(w http.ResponseWriter, r *http.Request) {
	namespace := chi.URLParam(r, "namespace")
	group := chi.URLParam(r, "group")
	version := chi.URLParam(r, "version")
	kind := chi.URLParam(r, "kind")
	name := chi.URLParam(r, "name")

	plural, err := discoverPlural(h.factory, group, version, kind)
	if err != nil {
		plural = strings.ToLower(kind) + "s"
	}

	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: plural}
	obj, err := h.factory.Dynamic().Resource(gvr).Namespace(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respond(w, http.StatusOK, obj)
}

// GetMetrics is a stub — returns 501 until phase 2 implements Prometheus integration.
func (h *Handler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	respondError(w, http.StatusNotImplemented, "metrics integration coming in phase 2")
}
