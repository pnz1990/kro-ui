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
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

// makeEventObj constructs a minimal Kubernetes Event unstructured object.
func makeEventObj(name, ns, involvedUID, reason, eventType string) unstructured.Unstructured {
	return unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "v1",
		"kind":       "Event",
		"metadata": map[string]any{
			"name":      name,
			"namespace": ns,
			"uid":       name + "-uid",
		},
		"involvedObject": map[string]any{
			"uid": involvedUID,
		},
		"reason":        reason,
		"type":          eventType,
		"lastTimestamp": "2026-03-21T10:00:00Z",
	}}
}

func TestListEvents(t *testing.T) {
	// GVRs used across tests.
	testEventsGVR := schema.GroupVersionResource{Group: "", Version: "v1", Resource: "events"}
	testAppGVR := schema.GroupVersionResource{
		Group: "kro.run", Version: "v1alpha1", Resource: "testapps",
	}

	kroInstanceUID := types.UID("instance-uid-abc")
	rgdUID := types.UID("rgd-uid-xyz")
	unrelatedUID := "unrelated-uid-123"

	// Shared event fixtures.
	kroInstanceEvent := makeEventObj("evt-instance", "default", string(kroInstanceUID), "Reconciling", "Normal")
	rgdEvent := makeEventObj("evt-rgd", "default", string(rgdUID), "Accepted", "Normal")
	unrelatedEvent := makeEventObj("evt-unrelated", "default", unrelatedUID, "Scheduled", "Normal")

	tests := []struct {
		name  string
		url   string
		build func(t *testing.T) *Handler
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name: "returns only kro instance events filtered by UID",
			url:  "/api/v1/events?namespace=default",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("test-app", "TestApp", "", "")
				rgdObj.SetUID(rgdUID)

				instance := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "kro.run/v1alpha1",
					"kind":       "TestApp",
					"metadata":   map[string]any{"name": "my-app", "namespace": "default", "uid": string(kroInstanceUID)},
				}}

				dyn := newStubDynamic()
				// RGD list (cluster-scoped).
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items:    []unstructured.Unstructured{*rgdObj},
					getItems: map[string]*unstructured.Unstructured{"test-app": rgdObj},
				}
				// TestApp instances in default namespace.
				dyn.resources[testAppGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"default": {items: []unstructured.Unstructured{*instance}},
					},
				}
				// Events in default namespace.
				dyn.resources[testEventsGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"default": {
							items: []unstructured.Unstructured{
								kroInstanceEvent,
								unrelatedEvent,
							},
						},
					},
				}

				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "testapps", Kind: "TestApp", Verbs: metav1.Verbs{"get", "list"}},
					},
				}
				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"Reconciling"`)
				assert.NotContains(t, body, `"Scheduled"`) // unrelated event excluded
				assert.NotContains(t, body, `"error"`)
			},
		},
		{
			name: "includes events directly on RGD objects",
			url:  "/api/v1/events?namespace=default",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("test-app", "TestApp", "", "")
				rgdObj.SetUID(rgdUID)

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items:    []unstructured.Unstructured{*rgdObj},
					getItems: map[string]*unstructured.Unstructured{"test-app": rgdObj},
				}
				// No testapp instances.
				dyn.resources[testAppGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"default": {items: []unstructured.Unstructured{}},
					},
				}
				dyn.resources[testEventsGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"default": {items: []unstructured.Unstructured{rgdEvent, unrelatedEvent}},
					},
				}

				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "testapps", Kind: "TestApp", Verbs: metav1.Verbs{"get", "list"}},
					},
				}
				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"Accepted"`)
				assert.NotContains(t, body, `"Scheduled"`)
			},
		},
		{
			name: "returns empty items when no kro events",
			url:  "/api/v1/events?namespace=default",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("test-app", "TestApp", "", "")
				rgdObj.SetUID(rgdUID)

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items:    []unstructured.Unstructured{*rgdObj},
					getItems: map[string]*unstructured.Unstructured{"test-app": rgdObj},
				}
				dyn.resources[testAppGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"default": {items: []unstructured.Unstructured{}},
					},
				}
				dyn.resources[testEventsGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"default": {items: []unstructured.Unstructured{unrelatedEvent}},
					},
				}

				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "testapps", Kind: "TestApp", Verbs: metav1.Verbs{"get", "list"}},
					},
				}
				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				assert.NotContains(t, body, `"Scheduled"`)
				assert.NotContains(t, body, `"error"`)
			},
		},
		{
			name: "filters to specific RGD when rgd param provided",
			url:  "/api/v1/events?namespace=default&rgd=test-app",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("test-app", "TestApp", "", "")
				rgdObj.SetUID(rgdUID)
				otherRGD := makeRGDObject("other-app", "OtherApp", "", "")
				otherRGD.SetUID("other-rgd-uid")

				instance := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "kro.run/v1alpha1",
					"kind":       "TestApp",
					"metadata":   map[string]any{"name": "my-app", "namespace": "default", "uid": string(kroInstanceUID)},
				}}

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*rgdObj, *otherRGD},
					getItems: map[string]*unstructured.Unstructured{
						"test-app":  rgdObj,
						"other-app": otherRGD,
					},
				}
				dyn.resources[testAppGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"default": {items: []unstructured.Unstructured{*instance}},
					},
				}
				dyn.resources[testEventsGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"default": {
							items: []unstructured.Unstructured{kroInstanceEvent, unrelatedEvent},
						},
					},
				}

				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "testapps", Kind: "TestApp", Verbs: metav1.Verbs{"get", "list"}},
					},
				}
				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"Reconciling"`)
				assert.NotContains(t, body, `"Scheduled"`)
			},
		},
		{
			name: "returns 500 when event list fails",
			url:  "/api/v1/events?namespace=default",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("test-app", "TestApp", "", "")
				rgdObj.SetUID(rgdUID)

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items:    []unstructured.Unstructured{*rgdObj},
					getItems: map[string]*unstructured.Unstructured{"test-app": rgdObj},
				}
				dyn.resources[testAppGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"default": {items: []unstructured.Unstructured{}},
					},
				}
				// Events GVR returns error.
				dyn.resources[testEventsGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"default": {listErr: errCluster},
					},
				}

				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "testapps", Kind: "TestApp", Verbs: metav1.Verbs{"get", "list"}},
					},
				}
				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusInternalServerError, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"error"`)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := tt.build(t)
			req := httptest.NewRequest(http.MethodGet, tt.url, nil)
			rr := httptest.NewRecorder()
			h.ListEvents(rr, req)
			tt.check(t, rr)
		})
	}
}

// errCluster is a sentinel error returned by stubs to simulate cluster failures.
var errCluster = fmt.Errorf("cluster unreachable")
