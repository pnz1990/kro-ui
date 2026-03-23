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
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/pnz1990/kro-ui/internal/api/types"
	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// GetInstance returns a single CR instance detail.
// The RGD name is passed as a query param so we can resolve the correct GVR.
func (h *Handler) GetInstance(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")
	rgdName := r.URL.Query().Get("rgd")

	gvr, err := h.resolveInstanceGVR(r.Context(), rgdName)
	if err != nil {
		log.Error().Err(err).Str("rgd", rgdName).Msg("failed to resolve instance GVR")
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	obj, err := h.factory.Dynamic().Resource(gvr).Namespace(namespace).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		log.Error().Err(err).Str("namespace", namespace).Str("name", name).Msg("failed to get instance")
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	log.Debug().Str("namespace", namespace).Str("name", name).Msg("fetched instance")
	respond(w, http.StatusOK, obj)
}

// GetInstanceEvents returns Kubernetes events for a given instance.
func (h *Handler) GetInstanceEvents(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")

	eventsGVR := schema.GroupVersionResource{Group: "", Version: "v1", Resource: "events"}
	fieldSelector := "involvedObject.name=" + name + ",involvedObject.namespace=" + namespace
	list, err := h.factory.Dynamic().Resource(eventsGVR).Namespace(namespace).List(
		r.Context(), metav1.ListOptions{FieldSelector: fieldSelector},
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	log.Debug().Int("count", len(list.Items)).Str("namespace", namespace).Str("name", name).Msg("listed instance events")
	respond(w, http.StatusOK, list)
}

// GetInstanceChildren returns child resources owned by the instance.
// Uses the kro.run/instance-name label to find all child resources across any kind.
func (h *Handler) GetInstanceChildren(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")

	children, err := h.listChildResources(r.Context(), namespace, name)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	log.Debug().Int("count", len(children)).Str("namespace", namespace).Str("name", name).Msg("listed instance children")
	respond(w, http.StatusOK, types.ChildrenResponse{Items: children})
}

// GetResource returns the raw unstructured YAML/JSON for any resource.
// This is used by the frontend for node YAML inspection — works for any k8s kind.
// The {group} path segment uses "_" to represent the core (empty) API group,
// since chi cannot route an empty path segment.
func (h *Handler) GetResource(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	namespace := chi.URLParam(r, "namespace")
	group := chi.URLParam(r, "group")
	version := chi.URLParam(r, "version")
	kind := chi.URLParam(r, "kind")
	name := chi.URLParam(r, "name")

	// Treat "_" as the core (empty) API group — chi cannot route empty segments.
	if group == "_" {
		group = ""
	}

	plural, err := k8sclient.DiscoverPlural(h.factory, group, version, kind)
	if err != nil {
		plural = strings.ToLower(kind) + "s"
	}

	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: plural}
	obj, err := h.factory.Dynamic().Resource(gvr).Namespace(namespace).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		log.Error().Err(err).Str("gvr", gvr.String()).Str("name", name).Msg("resource not found")
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	log.Debug().Str("gvr", gvr.String()).Str("name", name).Msg("fetched resource")
	respond(w, http.StatusOK, obj)
}
