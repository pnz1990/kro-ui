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

	"github.com/rs/zerolog"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// rbacGroup is the API group for RBAC resources.
const rbacGroup = "rbac.authorization.k8s.io"

// policyRule represents a single RBAC rule extracted from a ClusterRole or Role.
type policyRule struct {
	APIGroups []string
	Resources []string
	Verbs     []string
}

// ResourcePermission holds required vs granted permissions for a single GVR.
type ResourcePermission struct {
	Group    string          `json:"group"`
	Version  string          `json:"version"`
	Resource string          `json:"resource"`
	Kind     string          `json:"kind"`
	Required []string        `json:"required"`
	Granted  map[string]bool `json:"granted"`
}

// AccessResult is the full permission matrix for an RGD.
type AccessResult struct {
	ServiceAccount      string `json:"serviceAccount"`
	ServiceAccountFound bool   `json:"serviceAccountFound"`
	// ClusterRole is the name of the primary ClusterRole bound to kro's service account.
	// Empty string means it could not be determined.
	ClusterRole string               `json:"clusterRole"`
	HasGaps     bool                 `json:"hasGaps"`
	Permissions []ResourcePermission `json:"permissions"`
}

// ManagedVerbs are the verbs required for resources kro actively manages.
var ManagedVerbs = []string{"get", "list", "watch", "create", "update", "patch", "delete"}

// ReadOnlyVerbs are the verbs required for external reference resources.
var ReadOnlyVerbs = []string{"get", "list", "watch"}

// gvrSpec holds the resolved group/version/resource/kind for a single RGD resource entry.
type gvrSpec struct {
	Group    string
	Version  string
	Resource string
	Kind     string
	ReadOnly bool // true for externalRef nodes
}

// ResolveKroServiceAccount finds kro's service account name by reading the kro Deployment.
// It looks for a Deployment in kro-system or kro namespace whose name starts with "kro".
// Falls back to ("kro-system", "kro") if not found.
func ResolveKroServiceAccount(ctx context.Context, clients K8sClients) (namespace, name string, found bool) {
	log := zerolog.Ctx(ctx)
	deployGVR := schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}

	for _, ns := range []string{"kro-system", "kro"} {
		list, err := clients.Dynamic().Resource(deployGVR).Namespace(ns).List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Debug().Err(err).Str("namespace", ns).Msg("could not list deployments for kro SA detection")
			continue
		}
		for _, item := range list.Items {
			itemName, _, _ := UnstructuredString(item.Object, "metadata", "name")
			if !strings.HasPrefix(strings.ToLower(itemName), "kro") {
				continue
			}
			saName, ok, _ := UnstructuredString(item.Object,
				"spec", "template", "spec", "serviceAccountName")
			if ok && saName != "" {
				log.Debug().
					Str("namespace", ns).
					Str("deployment", itemName).
					Str("serviceAccount", saName).
					Msg("resolved kro service account")
				return ns, saName, true
			}
		}
	}
	log.Debug().Msg("could not detect kro service account; manual specification required")
	return "", "", false
}

// FetchEffectiveRules returns the flattened list of RBAC rules that apply to the
// given service account (namespace/name), by reading ClusterRoleBindings and
// namespace-scoped RoleBindings and resolving their referenced roles.
// It also resolves aggregated ClusterRoles.
func FetchEffectiveRules(ctx context.Context, clients K8sClients, saNamespace, saName string) ([]policyRule, error) {
	log := zerolog.Ctx(ctx)

	var rules []policyRule

	// ── ClusterRoleBindings ──────────────────────────────────────────────────
	crbGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "clusterrolebindings"}
	crbList, err := clients.Dynamic().Resource(crbGVR).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list ClusterRoleBindings: %w", err)
	}

	clusterRoleRules := map[string][]policyRule{} // cache: name → rules

	for _, crb := range crbList.Items {
		if !bindingMatchesSA(crb.Object, saNamespace, saName) {
			continue
		}
		roleRef, _, _ := UnstructuredString(crb.Object, "roleRef", "name")
		roleKind, _, _ := UnstructuredString(crb.Object, "roleRef", "kind")
		if roleRef == "" {
			continue
		}
		switch roleKind {
		case "ClusterRole":
			r, err := fetchClusterRoleRules(ctx, clients, roleRef, clusterRoleRules)
			if err != nil {
				log.Warn().Err(err).Str("clusterRole", roleRef).Msg("skipping ClusterRole")
				continue
			}
			rules = append(rules, r...)
		case "Role":
			// A ClusterRoleBinding can reference a Role (unusual but valid) — skip
			log.Debug().Str("role", roleRef).Msg("ClusterRoleBinding references a Role; skipping")
		}
	}

	// ── Namespace-scoped RoleBindings ────────────────────────────────────────
	rbGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "rolebindings"}
	rbList, err := clients.Dynamic().Resource(rbGVR).Namespace(saNamespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Warn().Err(err).Str("namespace", saNamespace).Msg("could not list RoleBindings; skipping")
	} else {
		for _, rb := range rbList.Items {
			if !bindingMatchesSA(rb.Object, saNamespace, saName) {
				continue
			}
			roleRef, _, _ := UnstructuredString(rb.Object, "roleRef", "name")
			roleKind, _, _ := UnstructuredString(rb.Object, "roleRef", "kind")
			rbNS, _, _ := UnstructuredString(rb.Object, "metadata", "namespace")
			if rbNS == "" {
				rbNS = saNamespace
			}
			switch roleKind {
			case "ClusterRole":
				r, err := fetchClusterRoleRules(ctx, clients, roleRef, clusterRoleRules)
				if err != nil {
					log.Warn().Err(err).Str("clusterRole", roleRef).Msg("skipping ClusterRole from RoleBinding")
					continue
				}
				rules = append(rules, r...)
			case "Role":
				r, err := fetchRoleRules(ctx, clients, rbNS, roleRef)
				if err != nil {
					log.Warn().Err(err).Str("role", roleRef).Msg("skipping Role")
					continue
				}
				rules = append(rules, r...)
			}
		}
	}

	return rules, nil
}

// CheckPermissions checks whether the given rules grant each of the required verbs
// for the specified group+resource. Returns a map of verb → granted.
// Handles wildcards: apiGroup "*", resource "*", verb "*".
func CheckPermissions(rules []policyRule, group, resource string, required []string) map[string]bool {
	granted := make(map[string]bool, len(required))
	for _, v := range required {
		granted[v] = false
	}

	for _, rule := range rules {
		if !matchesGroup(rule.APIGroups, group) {
			continue
		}
		if !matchesResource(rule.Resources, resource) {
			continue
		}
		for _, v := range required {
			if matchesVerb(rule.Verbs, v) {
				granted[v] = true
			}
		}
	}
	return granted
}

// ResolveKroClusterRole returns the name of the first ClusterRole bound to the given
// service account via a ClusterRoleBinding. Returns an empty string if none is found.
// The first match with a ClusterRole (not a Role) is returned; typically kro has a
// single ClusterRoleBinding.
func ResolveKroClusterRole(ctx context.Context, clients K8sClients, saNamespace, saName string) string {
	crbGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "clusterrolebindings"}
	crbList, err := clients.Dynamic().Resource(crbGVR).List(ctx, metav1.ListOptions{})
	if err != nil {
		return ""
	}
	for _, crb := range crbList.Items {
		if !bindingMatchesSA(crb.Object, saNamespace, saName) {
			continue
		}
		roleKind, _, _ := UnstructuredString(crb.Object, "roleRef", "kind")
		roleName, _, _ := UnstructuredString(crb.Object, "roleRef", "name")
		if roleKind == "ClusterRole" && roleName != "" {
			return roleName
		}
	}
	return ""
}

// ComputeAccessResult extracts all GVRs from the RGD's spec.resources, reads the
// effective RBAC rules for the given service account (saNS/saName), and returns the
// full permission matrix.
//
// saNS, saName, and saFound are provided by the caller — typically from
// ResolveKroServiceAccount or from a user-supplied manual override. When saNS is
// empty, ComputeAccessResult returns immediately with a not-found result (no matrix).
func ComputeAccessResult(ctx context.Context, clients K8sClients, rgdObj map[string]any, saNS, saName string, saFound bool) (*AccessResult, error) {
	log := zerolog.Ctx(ctx)

	// ── Short-circuit when SA is unknown ─────────────────────────────────────
	if saNS == "" {
		log.Debug().Msg("kro service account not resolved; returning empty access result")
		return &AccessResult{
			ServiceAccount:      "",
			ServiceAccountFound: false,
			HasGaps:             false,
			Permissions:         []ResourcePermission{},
		}, nil
	}

	saDisplay := saNS + "/" + saName

	// ── Fetch effective rules ────────────────────────────────────────────────
	rules, err := FetchEffectiveRules(ctx, clients, saNS, saName)
	if err != nil {
		return nil, fmt.Errorf("fetch effective rules: %w", err)
	}
	log.Debug().Int("rules", len(rules)).Str("sa", saDisplay).Msg("fetched effective RBAC rules")

	// ── Extract GVRs from RGD spec.resources ─────────────────────────────────
	gvrs, err := extractRGDGVRs(ctx, clients, rgdObj)
	if err != nil {
		return nil, fmt.Errorf("extract GVRs from RGD: %w", err)
	}

	// ── Compute permission matrix ────────────────────────────────────────────
	var permissions []ResourcePermission
	hasGaps := false

	for _, g := range gvrs {
		required := ManagedVerbs
		if g.ReadOnly {
			required = ReadOnlyVerbs
		}
		granted := CheckPermissions(rules, g.Group, g.Resource, required)

		// Check for any gap
		for _, v := range required {
			if !granted[v] {
				hasGaps = true
				break
			}
		}

		permissions = append(permissions, ResourcePermission{
			Group:    g.Group,
			Version:  g.Version,
			Resource: g.Resource,
			Kind:     g.Kind,
			Required: required,
			Granted:  granted,
		})
	}

	return &AccessResult{
		ServiceAccount:      saDisplay,
		ServiceAccountFound: saFound,
		ClusterRole:         ResolveKroClusterRole(ctx, clients, saNS, saName),
		HasGaps:             hasGaps,
		Permissions:         permissions,
	}, nil
}

// ── Internal helpers ───────────────────────────────────────────────────────────

// extractRGDGVRs extracts all unique GVRs from an RGD's spec.resources.
func extractRGDGVRs(ctx context.Context, clients K8sClients, rgdObj map[string]any) ([]gvrSpec, error) {
	log := zerolog.Ctx(ctx)

	spec, ok := rgdObj["spec"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("RGD has no spec")
	}
	resources, _ := spec["resources"].([]any)

	seen := map[string]struct{}{}
	var result []gvrSpec

	for _, r := range resources {
		res, ok := r.(map[string]any)
		if !ok {
			continue
		}

		var group, version, kind string
		readOnly := false

		// Determine node type and extract apiVersion+kind
		if extRef, ok := res["externalRef"].(map[string]any); ok {
			// External reference — read-only, extract from externalRef directly
			kind, _, _ = UnstructuredString(extRef, "kind")
			apiVersion, _, _ := UnstructuredString(extRef, "apiVersion")
			group, version = splitAPIVersion(apiVersion)
			readOnly = true
		} else if tmpl, ok := res["template"].(map[string]any); ok {
			// Managed resource — extract from template
			kind, _, _ = UnstructuredString(tmpl, "kind")
			apiVersion, _, _ := UnstructuredString(tmpl, "apiVersion")
			group, version = splitAPIVersion(apiVersion)
		} else {
			continue
		}

		if kind == "" || version == "" {
			log.Debug().Interface("resource", res).Msg("skipping RGD resource with missing kind/version")
			continue
		}

		// Discover plural resource name
		plural, err := DiscoverPlural(clients, group, version, kind)
		if err != nil {
			// Fallback: naive lowercase+s
			plural = strings.ToLower(kind) + "s"
			log.Debug().Err(err).Str("kind", kind).Str("plural", plural).Msg("discovery failed; using naive plural")
		}

		// Deduplicate by group/resource
		key := group + "/" + plural
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}

		result = append(result, gvrSpec{
			Group:    group,
			Version:  version,
			Resource: plural,
			Kind:     kind,
			ReadOnly: readOnly,
		})
	}

	return result, nil
}

// splitAPIVersion splits "group/version" into (group, version).
// Core resources (e.g. "v1") have an empty group.
func splitAPIVersion(apiVersion string) (group, version string) {
	parts := strings.SplitN(apiVersion, "/", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return "", apiVersion
}

// bindingMatchesSA returns true if the binding's subjects include the given service account.
func bindingMatchesSA(obj map[string]any, saNamespace, saName string) bool {
	subjects, _ := obj["subjects"].([]any)
	for _, s := range subjects {
		subj, ok := s.(map[string]any)
		if !ok {
			continue
		}
		kind, _, _ := UnstructuredString(subj, "kind")
		name, _, _ := UnstructuredString(subj, "name")
		ns, _, _ := UnstructuredString(subj, "namespace")
		if kind == "ServiceAccount" && name == saName && ns == saNamespace {
			return true
		}
	}
	return false
}

// fetchClusterRoleRules retrieves and caches the flattened rules for a ClusterRole,
// resolving any aggregation rules recursively.
func fetchClusterRoleRules(ctx context.Context, clients K8sClients, name string, cache map[string][]policyRule) ([]policyRule, error) {
	if r, ok := cache[name]; ok {
		return r, nil
	}

	crGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "clusterroles"}
	obj, err := clients.Dynamic().Resource(crGVR).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get ClusterRole %q: %w", name, err)
	}

	rules := extractPolicyRules(obj.Object)

	// Resolve aggregation rule — list ClusterRoles matching the label selectors
	if aggRule, ok := obj.Object["aggregationRule"].(map[string]any); ok {
		selectors, _ := aggRule["clusterRoleSelectors"].([]any)
		for _, sel := range selectors {
			selMap, ok := sel.(map[string]any)
			if !ok {
				continue
			}
			matchLabels, _ := selMap["matchLabels"].(map[string]any)
			if len(matchLabels) == 0 {
				continue
			}
			// Build label selector string
			var parts []string
			for k, v := range matchLabels {
				parts = append(parts, k+"="+fmt.Sprintf("%v", v))
			}
			labelSelector := strings.Join(parts, ",")

			aggList, err := clients.Dynamic().Resource(crGVR).List(ctx, metav1.ListOptions{
				LabelSelector: labelSelector,
			})
			if err != nil {
				zerolog.Ctx(ctx).Warn().Err(err).Str("selector", labelSelector).Msg("could not list aggregated ClusterRoles")
				continue
			}
			for _, aggCR := range aggList.Items {
				rules = append(rules, extractPolicyRules(aggCR.Object)...)
			}
		}
	}

	cache[name] = rules
	return rules, nil
}

// fetchRoleRules retrieves the rules from a namespace-scoped Role.
func fetchRoleRules(ctx context.Context, clients K8sClients, namespace, name string) ([]policyRule, error) {
	roleGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "roles"}
	obj, err := clients.Dynamic().Resource(roleGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get Role %q in %q: %w", name, namespace, err)
	}
	return extractPolicyRules(obj.Object), nil
}

// extractPolicyRules parses the rules field from a ClusterRole or Role object.
func extractPolicyRules(obj map[string]any) []policyRule {
	rawRules, _ := obj["rules"].([]any)
	result := make([]policyRule, 0, len(rawRules))
	for _, r := range rawRules {
		rMap, ok := r.(map[string]any)
		if !ok {
			continue
		}
		result = append(result, policyRule{
			APIGroups: toStringSlice(rMap["apiGroups"]),
			Resources: toStringSlice(rMap["resources"]),
			Verbs:     toStringSlice(rMap["verbs"]),
		})
	}
	return result
}

// toStringSlice converts an []any to []string, skipping non-string elements.
func toStringSlice(v any) []string {
	arr, _ := v.([]any)
	result := make([]string, 0, len(arr))
	for _, item := range arr {
		if s, ok := item.(string); ok {
			result = append(result, s)
		}
	}
	return result
}

// matchesGroup returns true if the rule's apiGroups contains the given group or "*".
func matchesGroup(apiGroups []string, group string) bool {
	for _, g := range apiGroups {
		if g == "*" || g == group {
			return true
		}
	}
	return false
}

// matchesResource returns true if the rule's resources contains the given resource or "*".
func matchesResource(resources []string, resource string) bool {
	for _, r := range resources {
		if r == "*" || r == resource {
			return true
		}
	}
	return false
}

// matchesVerb returns true if the rule's verbs contains the given verb or "*".
func matchesVerb(verbs []string, verb string) bool {
	for _, v := range verbs {
		if v == "*" || v == verb {
			return true
		}
	}
	return false
}
