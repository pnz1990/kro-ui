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

// Package server sets up the HTTP server, embeds the frontend, and wires routes.
package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/cors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/pnz1990/kro-ui/internal/api/handlers"
	"github.com/pnz1990/kro-ui/internal/api/types"
	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
	"github.com/pnz1990/kro-ui/internal/version"
	"github.com/pnz1990/kro-ui/web"
)

var zeroTime time.Time

// Config holds server startup options.
type Config struct {
	Port       int
	Kubeconfig string
	Context    string
}

// NewRouter creates a chi.Router with all API routes, middleware, and SPA fallback.
// If factory is nil, only healthz and static file serving are functional (for testing).
func NewRouter(factory *k8sclient.ClientFactory) (chi.Router, error) {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"*"},
	}).Handler)

	// API routes — handler may be nil-safe for healthz-only testing.
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
		})

		// Version — always available regardless of cluster connectivity.
		r.Get("/version", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			v := types.VersionResponse{
				Version:   version.Version,
				Commit:    version.Commit,
				BuildDate: version.BuildDate,
			}
			_ = json.NewEncoder(w).Encode(v)
		})

		// Only wire handler routes when a factory is available.
		if factory != nil {
			h := handlers.New(factory)

			// Cluster contexts
			r.Get("/contexts", h.ListContexts)
			r.Post("/contexts/switch", h.SwitchContext)

			// ResourceGraphDefinitions
			r.Get("/rgds", h.ListRGDs)
			r.Get("/rgds/{name}", h.GetRGD)
			r.Get("/rgds/{name}/instances", h.ListInstances)
			r.Get("/rgds/{name}/access", h.GetRGDAccess)

			// Instances
			r.Get("/instances/{namespace}/{name}", h.GetInstance)
			r.Get("/instances/{namespace}/{name}/events", h.GetInstanceEvents)
			r.Get("/instances/{namespace}/{name}/children", h.GetInstanceChildren)

			// Raw resource YAML (any kind — for node inspection)
			r.Get("/resources/{namespace}/{group}/{version}/{kind}/{name}", h.GetResource)

			// kro capabilities detection
			r.Get("/kro/capabilities", h.GetCapabilities)

			// Smart event stream — kro-filtered Kubernetes Events
			r.Get("/events", h.ListEvents)

			// Fleet overview — aggregated multi-context summary
			r.Get("/fleet/summary", h.FleetSummary)

			// Controller metrics — kro Prometheus scrape summary
			r.Get("/kro/metrics", h.GetMetrics)
		}
	})

	// Serve embedded frontend — all non-API routes go to index.html (SPA).
	distFS, err := fs.Sub(web.DistFS, "dist")
	if err != nil {
		return nil, fmt.Errorf("embedded frontend corrupted: %w", err)
	}
	fileServer := http.FileServer(http.FS(distFS))
	r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// Strip the leading slash for fs.Stat — embedded FS paths have no prefix.
		path := req.URL.Path[1:]
		if path == "" {
			path = "index.html"
		}

		// If the file exists in web/dist, serve it directly with correct MIME type.
		if _, err := fs.Stat(distFS, path); err == nil {
			fileServer.ServeHTTP(w, req)
			return
		}

		// SPA fallback: serve index.html for client-side routing.
		index, err := distFS.Open("index.html")
		if err != nil {
			http.NotFound(w, req)
			return
		}
		defer index.Close()
		http.ServeContent(w, req, "index.html", zeroTime, index.(io.ReadSeeker))
	}))

	return r, nil
}

// Run starts the HTTP server and blocks until it exits or receives SIGINT/SIGTERM.
func Run(cfg Config) error {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	logger := log.With().
		Int("port", cfg.Port).
		Str("context", cfg.Context).
		Logger()

	logger.Info().Msg("starting kro-ui")

	// Build k8s client factory — supports runtime context switching.
	factory, err := k8sclient.NewClientFactory(cfg.Kubeconfig, cfg.Context)
	if err != nil {
		return fmt.Errorf("failed to build k8s client: %w", err)
	}

	logger.Info().Str("active_context", factory.ActiveContext()).Msg("connected to cluster")

	r, err := NewRouter(factory)
	if err != nil {
		return fmt.Errorf("create router: %w", err)
	}

	addr := fmt.Sprintf(":%d", cfg.Port)
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	// Graceful shutdown on SIGINT/SIGTERM.
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-done
		logger.Info().Msg("shutting down")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			logger.Warn().Err(err).Msg("unclean shutdown")
		}
	}()

	logger.Info().Str("addr", addr).Msg("kro-ui ready")
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("server error: %w", err)
	}
	return nil
}
