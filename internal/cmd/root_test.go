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

package cmd

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCobraCommands(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) string
		check func(t *testing.T, cmdName string)
	}{
		{
			name: "serveCmd exists as subcommand of root",
			build: func(t *testing.T) string {
				t.Helper()
				for _, cmd := range rootCmd.Commands() {
					if cmd.Use == "serve" {
						return cmd.Use
					}
				}
				return ""
			},
			check: func(t *testing.T, cmdName string) {
				t.Helper()
				require.Equal(t, "serve", cmdName, "serve subcommand must exist")
			},
		},
		{
			name: "versionCmd exists as subcommand of root",
			build: func(t *testing.T) string {
				t.Helper()
				for _, cmd := range rootCmd.Commands() {
					if cmd.Use == "version" {
						return cmd.Use
					}
				}
				return ""
			},
			check: func(t *testing.T, cmdName string) {
				t.Helper()
				require.Equal(t, "version", cmdName, "version subcommand must exist")
			},
		},
		{
			name: "serve has --port flag with default 10174",
			build: func(t *testing.T) string {
				t.Helper()
				f := serveCmd.Flags().Lookup("port")
				if f == nil {
					return ""
				}
				return f.DefValue
			},
			check: func(t *testing.T, defVal string) {
				t.Helper()
				assert.Equal(t, "10174", defVal)
			},
		},
		{
			name: "serve has --kubeconfig flag",
			build: func(t *testing.T) string {
				t.Helper()
				f := serveCmd.Flags().Lookup("kubeconfig")
				if f == nil {
					return ""
				}
				return "found"
			},
			check: func(t *testing.T, result string) {
				t.Helper()
				require.Equal(t, "found", result, "--kubeconfig flag must exist on serve")
			},
		},
		{
			name: "serve has --context flag",
			build: func(t *testing.T) string {
				t.Helper()
				f := serveCmd.Flags().Lookup("context")
				if f == nil {
					return ""
				}
				return "found"
			},
			check: func(t *testing.T, result string) {
				t.Helper()
				require.Equal(t, "found", result, "--context flag must exist on serve")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.build(t)
			tt.check(t, result)
		})
	}
}
