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
	responsecache "github.com/pnz1990/kro-ui/internal/cache"
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
		// Enforce 5s response budget on every API handler (Constitution §XI).
		// healthz and version are exempt — they are served before the timeout
		// middleware applies (registered below inside this subrouter first).
		//
		// DESIGN: handlers that perform a single k8s API call rely on this
		// middleware-injected deadline exclusively. Handlers that fan-out to
		// multiple resources (e.g. GetInstanceChildren, FetchEffectiveRules, Fleet)
		// additionally set an inner per-resource context.WithTimeout to bound each
		// individual call and allow partial results. This is intentional: the outer
		// deadline provides the hard cap while the inner timeouts prevent a single
		// slow resource type from consuming the entire budget. (GH #300)
		r.Use(middleware.Timeout(5 * time.Second))

		r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
		})

		// Version endpoint: always available, cached when factory is present.
		// Defined here so it works even in factory=nil test mode.
		// Note: the cache-wrapped version inside the factory block takes
		// precedence in production since it's registered on the same path.
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

			// Response cache (spec 052-response-cache).
			// Singleton shared across all cacheable routes.
			// Purge expired entries every 2 minutes to prevent unbounded growth.
			rc := responsecache.New()
			go func() {
				for range time.Tick(2 * time.Minute) {
					rc.Purge()
				}
			}()

			// Cache TTLs per spec:
			//   RGD list/detail:   30s  — rarely changes mid-session
			//   Instance list:     10s  — moderate change rate
			//   Capabilities:       5m  — changes only on kro redeploy
			//   Version:            5m  — constant at runtime
			const (
				ttlRGD          = 30 * time.Second
				ttlInstanceList = 10 * time.Second
				ttlCapabilities = 5 * time.Minute
				ttlGraphRevs    = 30 * time.Second
			)

			// NOT cached (always fresh):
			//   /instances/{ns}/{name}           — 5s poll, must be fresh
			//   /instances/{ns}/{name}/children  — 5s poll
			//   /instances/{ns}/{name}/events    — realtime
			//   /events                          — realtime
			//   /kro/metrics                     — realtime
			//   /resources/...                   — on-demand YAML inspection

			// Cluster contexts — not cached (user-initiated, must be fresh for switcher)
			r.Get("/contexts", h.ListContexts)
			r.Post("/contexts/switch", h.SwitchContext)

			// ResourceGraphDefinitions — cached
			r.With(responsecache.Middleware(rc, ttlRGD)).Get("/rgds", h.ListRGDs)
			r.With(responsecache.Middleware(rc, ttlRGD)).Get("/rgds/{name}", h.GetRGD)
			r.With(responsecache.Middleware(rc, ttlInstanceList)).Get("/rgds/{name}/instances", h.ListInstances)
			r.Get("/rgds/{name}/access", h.GetRGDAccess)

			// Validate endpoints — never cached (stateful analysis)
			r.Post("/rgds/validate", h.ValidateRGD)
			r.Post("/rgds/validate/static", h.ValidateRGDStatic)

			// Instances — NOT cached (live polling)
			r.Get("/instances/{namespace}/{name}", h.GetInstance)
			r.Get("/instances/{namespace}/{name}/events", h.GetInstanceEvents)
			r.Get("/instances/{namespace}/{name}/children", h.GetInstanceChildren)

			// Raw resource YAML — not cached (on-demand)
			r.Get("/resources/{namespace}/{group}/{version}/{kind}/{name}", h.GetResource)

			// kro capabilities — cached (long TTL, changes on kro redeploy only)
			r.With(responsecache.Middleware(rc, ttlCapabilities)).Get("/kro/capabilities", h.GetCapabilities)

			// GraphRevisions — cached (short TTL, updates on RGD spec changes)
			r.With(responsecache.Middleware(rc, ttlGraphRevs)).Get("/kro/graph-revisions", h.ListGraphRevisions)
			r.With(responsecache.Middleware(rc, ttlGraphRevs)).Get("/kro/graph-revisions/{name}", h.GetGraphRevision)

			// Smart event stream — NOT cached (realtime)
			r.Get("/events", h.ListEvents)

			// Controller metrics — NOT cached (realtime counter data)
			r.Get("/kro/metrics", h.GetMetrics)
		} else {
			// No factory — only version and healthz are functional
		}

		// Fleet summary is registered outside the 5s middleware timeout block
		// because it fans out across all kubeconfig contexts and legitimately
		// needs a longer deadline (30s) — Constitution §XI allows per-handler
		// overrides when documented and bounded.
		if factory != nil {
			h := handlers.New(factory)
			r.With(middleware.Timeout(30*time.Second)).Get("/fleet/summary", h.FleetSummary)
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
