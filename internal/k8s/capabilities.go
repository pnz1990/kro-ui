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

package k8s

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/rs/zerolog"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
)

// KroCapabilities describes what the connected kro installation supports.
// Populated by introspecting the API server — never by version string parsing.
type KroCapabilities struct {
	Version        string             `json:"version"`
	APIVersion     string             `json:"apiVersion"`
	FeatureGates   map[string]bool    `json:"featureGates"`
	KnownResources []string           `json:"knownResources"`
	Schema         SchemaCapabilities `json:"schema"`
}

// SchemaCapabilities describes which optional fields exist in the RGD CRD schema.
type SchemaCapabilities struct {
	HasForEach             bool `json:"hasForEach"`
	HasExternalRef         bool `json:"hasExternalRef"`
	HasExternalRefSelector bool `json:"hasExternalRefSelector"`
	HasScope               bool `json:"hasScope"`
	HasTypes               bool `json:"hasTypes"`
	HasGraphRevisions      bool `json:"hasGraphRevisions"`
}

// forbiddenCapabilities are fork-only concepts that must never appear in feature gates.
// Per constitution §II and spec FR-004.
var forbiddenCapabilities = []string{"specPatch", "stateFields"}

// Baseline returns a conservative KroCapabilities that is safe for any kro v1alpha1
// installation. Used as fallback when detection fails.
func Baseline() *KroCapabilities {
	return &KroCapabilities{
		Version:    "unknown",
		APIVersion: "kro.run/v1alpha1",
		FeatureGates: map[string]bool{
			"CELOmitFunction":         false,
			"InstanceConditionEvents": false,
		},
		KnownResources: []string{"resourcegraphdefinitions"},
		Schema: SchemaCapabilities{
			HasForEach:             true,
			HasExternalRef:         true,
			HasExternalRefSelector: true,
			HasScope:               false,
			HasTypes:               false,
			HasGraphRevisions:      false,
		},
	}
}

// crdGVR is the GVR for CustomResourceDefinition objects.
var crdGVR = schema.GroupVersionResource{
	Group:    "apiextensions.k8s.io",
	Version:  "v1",
	Resource: "customresourcedefinitions",
}

// deployGVR is the GVR for Deployment objects.
var deployGVR = schema.GroupVersionResource{
	Group:    "apps",
	Version:  "v1",
	Resource: "deployments",
}

// GraphRevisionGVR is the GVR for GraphRevision objects (internal.kro.run/v1alpha1).
// Available in kro v0.9.0+. Used by ListGraphRevisions and GetGraphRevision handlers.
var GraphRevisionGVR = schema.GroupVersionResource{
	Group:    "internal.kro.run",
	Version:  "v1alpha1",
	Resource: "graphrevisions",
}

// internalKroAPIVersion is the internal kro API group/version for GraphRevision.
const internalKroAPIVersion = "internal.kro.run/v1alpha1"

// kroAPIVersion is the kro API group/version to query.
const kroAPIVersion = "kro.run/v1alpha1"

// rgdCRDName is the fully-qualified CRD name for RGDs.
const rgdCRDName = "resourcegraphdefinitions.kro.run"

// Well-known kro controller deployment identifiers.
// Probed in order — first match wins. The official Helm chart uses "kro";
// older or custom installations may use "kro-controller-manager".
// Constitution §XI: no hardcoded single name; probe multiple candidates.
const kroNamespace = "kro-system"

var kroDeploymentNames = []string{
	"kro",
	"kro-controller-manager",
	"kro-controller",
}

// DetectCapabilities probes the connected cluster and returns what the kro
// installation supports. Falls back to Baseline() on any error.
// All detection uses the dynamic client and discovery API — no typed clients.
func DetectCapabilities(ctx context.Context, dyn dynamic.Interface, disc discovery.DiscoveryInterface) *KroCapabilities {
	log := zerolog.Ctx(ctx)

	caps := Baseline()

	// Step 1: Enumerate known resources via discovery.
	// If kro.run is not registered, the cluster has no kro — return baseline.
	resourceList, err := disc.ServerResourcesForGroupVersion(kroAPIVersion)
	if err != nil {
		log.Debug().Err(err).Msg("kro API group not found, returning baseline")
		return caps
	}

	var knownResources []string
	for _, r := range resourceList.APIResources {
		// Skip subresources (e.g., "resourcegraphdefinitions/status").
		if !strings.Contains(r.Name, "/") {
			knownResources = append(knownResources, r.Name)
		}
	}
	if len(knownResources) > 0 {
		caps.KnownResources = knownResources
	}
	caps.APIVersion = kroAPIVersion

	// Steps 2 + 3 + 4 run concurrently: CRD schema introspection, Deployment args
	// parsing, and internal kro CRD detection (GraphRevision).
	var wg sync.WaitGroup
	var schemaCaps SchemaCapabilities
	var featureGates map[string]bool
	var version string
	var hasGraphRevisions bool

	wg.Add(3)

	// Step 2: CRD schema introspection for schema capabilities.
	go func() {
		defer wg.Done()
		schemaCaps = detectSchemaCapabilities(ctx, dyn)
	}()

	// Step 3: Parse feature gates and version from kro controller Deployment.
	go func() {
		defer wg.Done()
		featureGates, version = detectFeatureGatesAndVersion(ctx, dyn)
	}()

	// Step 4: Detect internal kro CRDs (GraphRevision, internal.kro.run/v1alpha1).
	go func() {
		defer wg.Done()
		hasGraphRevisions = detectInternalKroCRDs(ctx, disc)
	}()

	wg.Wait()

	caps.Schema = schemaCaps
	caps.Schema.HasGraphRevisions = hasGraphRevisions
	if featureGates != nil {
		caps.FeatureGates = featureGates
	}
	if version != "" {
		caps.Version = version
	}

	// Fork guard: remove any forbidden capabilities.
	enforceForkGuard(caps)

	return caps
}

// detectSchemaCapabilities fetches the RGD CRD and walks its OpenAPI schema
// to check which optional fields exist.
func detectSchemaCapabilities(ctx context.Context, dyn dynamic.Interface) SchemaCapabilities {
	log := zerolog.Ctx(ctx)
	baseline := Baseline().Schema

	crd, err := dyn.Resource(crdGVR).Get(ctx, rgdCRDName, metav1.GetOptions{})
	if err != nil {
		log.Debug().Err(err).Msg("failed to fetch RGD CRD, using baseline schema")
		return baseline
	}

	// Navigate: spec.versions[0].schema.openAPIV3Schema.properties.spec.properties
	versions, ok := nestedSlice(crd.Object, "spec", "versions")
	if !ok || len(versions) == 0 {
		log.Debug().Msg("CRD has no spec.versions, using baseline schema")
		return baseline
	}

	firstVersion, ok := versions[0].(map[string]any)
	if !ok {
		log.Debug().Msg("CRD spec.versions[0] is not a map, using baseline schema")
		return baseline
	}

	rootSchema, ok := nestedMap(firstVersion, "schema", "openAPIV3Schema")
	if !ok {
		log.Debug().Msg("CRD has no schema.openAPIV3Schema, using baseline schema")
		return baseline
	}

	specProps, ok := nestedMap(rootSchema, "properties", "spec", "properties")
	if !ok {
		log.Debug().Msg("CRD has no properties.spec.properties, using baseline schema")
		return baseline
	}

	// Resource-level fields: spec.resources.items.properties.<field>
	resourceItemProps := getResourceItemProperties(ctx, specProps)

	// Schema-level fields: spec.schema.properties.<field>
	schemaProps, _ := nestedMap(specProps, "schema", "properties")

	// If we couldn't navigate to resource item properties, return baseline
	// rather than reporting all capabilities as false (which would be a
	// downgrade from what kro v1alpha1 universally supports).
	if resourceItemProps == nil {
		log.Debug().Msg("CRD schema: could not introspect resource items, using baseline schema")
		return baseline
	}

	return SchemaCapabilities{
		HasForEach:             hasKey(resourceItemProps, "forEach"),
		HasExternalRef:         hasKey(resourceItemProps, "externalRef"),
		HasExternalRefSelector: hasExternalRefSelector(resourceItemProps),
		HasScope:               hasKey(schemaProps, "scope"),
		HasTypes:               hasKey(schemaProps, "types"),
	}
}

// getResourceItemProperties navigates spec.resources → items → properties.
// Handles both direct array items and wrapped structures.
func getResourceItemProperties(ctx context.Context, specProps map[string]any) map[string]any {
	log := zerolog.Ctx(ctx)

	resources, ok := nestedMap(specProps, "resources")
	if !ok {
		// Log available keys for debugging.
		keys := make([]string, 0, len(specProps))
		for k := range specProps {
			keys = append(keys, k)
		}
		log.Debug().Strs("available_keys", keys).Msg("CRD schema: no 'resources' key under spec.properties")
		return nil
	}

	// resources is an array type; items.properties holds the per-resource fields.
	items, ok := nestedMap(resources, "items", "properties")
	if ok {
		return items
	}

	// Log available keys under resources for debugging.
	rKeys := make([]string, 0, len(resources))
	for k := range resources {
		rKeys = append(rKeys, k)
	}
	log.Debug().Strs("resources_keys", rKeys).Msg("CRD schema: could not navigate resources.items.properties")
	return nil
}

// hasExternalRefSelector checks for externalRef.properties.metadata.properties.selector.
func hasExternalRefSelector(resourceItemProps map[string]any) bool {
	if resourceItemProps == nil {
		return false
	}
	_, ok := nestedMap(resourceItemProps, "externalRef", "properties", "metadata", "properties", "selector")
	return ok
}

// detectFeatureGatesAndVersion reads the kro controller Deployment and parses
// --feature-gates from its container args, and extracts the version from the image tag.
// Probes kroDeploymentNames in order; uses the first Deployment that resolves.
func detectFeatureGatesAndVersion(ctx context.Context, dyn dynamic.Interface) (map[string]bool, string) {
	log := zerolog.Ctx(ctx)

	var deploy *unstructured.Unstructured
	for _, name := range kroDeploymentNames {
		obj, err := dyn.Resource(deployGVR).Namespace(kroNamespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			deploy = obj
			break
		}
		log.Debug().Str("name", name).Err(err).Msg("kro deployment candidate not found, trying next")
	}
	if deploy == nil {
		log.Debug().Msg("kro controller deployment not found under any known name, feature gates default to false")
		return nil, ""
	}

	// Extract container args: spec.template.spec.containers[0].args
	containers, ok := nestedSlice(deploy.Object, "spec", "template", "spec", "containers")
	if !ok || len(containers) == 0 {
		return nil, ""
	}

	container, ok := containers[0].(map[string]any)
	if !ok {
		return nil, ""
	}

	// Parse feature gates from args.
	gates := parseFeatureGatesFromArgs(container)

	// Extract version from image tag.
	version := extractVersionFromImage(container)

	return gates, version
}

// parseFeatureGatesFromArgs extracts --feature-gates=Key=true,Key=false from container args.
func parseFeatureGatesFromArgs(container map[string]any) map[string]bool {
	argsRaw, ok := container["args"]
	if !ok {
		return nil
	}

	args, ok := argsRaw.([]any)
	if !ok {
		return nil
	}

	for _, arg := range args {
		s, ok := arg.(string)
		if !ok {
			continue
		}

		if strings.HasPrefix(s, "--feature-gates=") {
			return parseFeatureGateString(strings.TrimPrefix(s, "--feature-gates="))
		}
	}

	return nil
}

// parseFeatureGateString parses "Key1=true,Key2=false" into a map.
func parseFeatureGateString(s string) map[string]bool {
	gates := make(map[string]bool)
	for _, pair := range strings.Split(s, ",") {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}
		parts := strings.SplitN(pair, "=", 2)
		if len(parts) != 2 {
			continue
		}
		gates[parts[0]] = parts[1] == "true"
	}
	return gates
}

// extractVersionFromImage extracts a version tag from the container image.
// e.g., "ghcr.io/kro/controller:v0.9.1" → "v0.9.1"
func extractVersionFromImage(container map[string]any) string {
	image, ok := container["image"].(string)
	if !ok || image == "" {
		return ""
	}

	// Split on ":" to get the tag. Handle digest format (sha256:...) by checking for "v" prefix.
	if idx := strings.LastIndex(image, ":"); idx >= 0 {
		tag := image[idx+1:]
		if strings.HasPrefix(tag, "v") || strings.HasPrefix(tag, "0") || strings.HasPrefix(tag, "1") {
			return tag
		}
	}
	return ""
}

// enforceForkGuard removes forbidden capabilities from the detection result.
func enforceForkGuard(caps *KroCapabilities) {
	for _, forbidden := range forbiddenCapabilities {
		delete(caps.FeatureGates, forbidden)
	}
}

// detectInternalKroCRDs probes the internal.kro.run/v1alpha1 API group and
// returns true when the graphrevisions CRD is registered in the cluster.
// Returns false on any error (graceful degradation — pre-v0.9.0 clusters simply
// have no internal.kro.run API group).
func detectInternalKroCRDs(ctx context.Context, disc discovery.DiscoveryInterface) bool {
	log := zerolog.Ctx(ctx)
	rl, err := disc.ServerResourcesForGroupVersion(internalKroAPIVersion)
	if err != nil {
		log.Debug().Err(err).Msg("internal.kro.run API group not found; GraphRevisions not available")
		return false
	}
	for _, r := range rl.APIResources {
		if r.Name == GraphRevisionResource {
			log.Debug().Msg("detected GraphRevision CRD (internal.kro.run/v1alpha1)")
			return true
		}
	}
	return false
}

// --- Unstructured navigation helpers ---

// nestedMap walks a chain of keys through nested map[string]any structures.
func nestedMap(obj map[string]any, keys ...string) (map[string]any, bool) {
	current := obj
	for _, key := range keys {
		val, ok := current[key]
		if !ok {
			return nil, false
		}
		next, ok := val.(map[string]any)
		if !ok {
			return nil, false
		}
		current = next
	}
	return current, true
}

// nestedSlice navigates to a []any at the given key path.
func nestedSlice(obj map[string]any, keys ...string) ([]any, bool) {
	if len(keys) == 0 {
		return nil, false
	}

	// Navigate to the parent map.
	parent := obj
	for _, key := range keys[:len(keys)-1] {
		val, ok := parent[key]
		if !ok {
			return nil, false
		}
		next, ok := val.(map[string]any)
		if !ok {
			return nil, false
		}
		parent = next
	}

	// Get the final key as a slice.
	val, ok := parent[keys[len(keys)-1]]
	if !ok {
		return nil, false
	}
	slice, ok := val.([]any)
	return slice, ok
}

// hasKey checks if a key exists in a map (may be nil).
func hasKey(m map[string]any, key string) bool {
	if m == nil {
		return false
	}
	_, ok := m[key]
	return ok
}

// ForbiddenCapabilities returns the list of fork-only feature names that are
// excluded from capabilities detection. Exported for test assertions.
func ForbiddenCapabilities() []string {
	result := make([]string, len(forbiddenCapabilities))
	copy(result, forbiddenCapabilities)
	return result
}

// String returns a human-readable summary.
func (c *KroCapabilities) String() string {
	return fmt.Sprintf("kro %s (%s) resources=%v gates=%v", c.Version, c.APIVersion, c.KnownResources, c.FeatureGates)
}
