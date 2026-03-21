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

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// stubClientFactory is a hand-written stub for testing context handlers.
// It implements the contextManager interface without needing a real cluster.
type stubClientFactory struct {
	contexts      []k8sclient.Context
	activeContext string
	switchErr     error
	listErr       error
}

func (s *stubClientFactory) ListContexts() ([]k8sclient.Context, string, error) {
	if s.listErr != nil {
		return nil, "", s.listErr
	}
	return s.contexts, s.activeContext, nil
}

func (s *stubClientFactory) SwitchContext(ctx string) error {
	if s.switchErr != nil {
		return s.switchErr
	}
	// Validate context exists in the stub's list.
	for _, c := range s.contexts {
		if c.Name == ctx {
			s.activeContext = ctx
			return nil
		}
	}
	return fmt.Errorf("context %q not found in kubeconfig", ctx)
}

func (s *stubClientFactory) ActiveContext() string {
	return s.activeContext
}

// newTestHandler creates a Handler backed by a stubClientFactory for testing.
func newTestHandler(stub *stubClientFactory) *Handler {
	return &Handler{ctxMgr: stub}
}
