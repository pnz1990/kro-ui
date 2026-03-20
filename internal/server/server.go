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
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/cors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/pnz1990/kro-ui/internal/api/handlers"
	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
	"github.com/pnz1990/kro-ui/web"
)

var zeroTime time.Time

// Config holds server startup options.
type Config struct {
	Port       int
	Kubeconfig string
	Context    string
}

// Run starts the HTTP server and blocks until it exits.
func Run(cfg Config) error {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Info().
		Int("port", cfg.Port).
		Str("context", cfg.Context).
		Msg("starting kro-ui")

	// Build k8s client factory — supports runtime context switching.
	factory, err := k8sclient.NewClientFactory(cfg.Kubeconfig, cfg.Context)
	if err != nil {
		return fmt.Errorf("failed to build k8s client: %w", err)
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"*"},
	}).Handler)

	// API routes
	h := handlers.New(factory)
	r.Route("/api/v1", func(r chi.Router) {
		// Cluster contexts
		r.Get("/contexts", h.ListContexts)
		r.Post("/contexts/switch", h.SwitchContext)

		// ResourceGraphDefinitions
		r.Get("/rgds", h.ListRGDs)
		r.Get("/rgds/{name}", h.GetRGD)
		r.Get("/rgds/{name}/instances", h.ListInstances) // ?namespace=

		// Instances
		r.Get("/instances/{namespace}/{name}", h.GetInstance)
		r.Get("/instances/{namespace}/{name}/events", h.GetInstanceEvents)
		r.Get("/instances/{namespace}/{name}/children", h.GetInstanceChildren)

		// Raw resource YAML (any kind — for node inspection)
		r.Get("/resources/{namespace}/{group}/{version}/{kind}/{name}", h.GetResource)

		// Metrics — stub, returns 501 until phase 2
		r.Get("/metrics", h.GetMetrics)

		r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
		})
	})

	// Serve embedded frontend — all non-API routes go to index.html (SPA).
	distFS, err := fs.Sub(web.DistFS, "dist")
	if err != nil {
		return fmt.Errorf("failed to sub web/dist: %w", err)
	}
	fileServer := http.FileServer(http.FS(distFS))
	r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// If the file exists, serve it. Otherwise serve index.html for SPA routing.
		if _, err := fs.Stat(distFS, req.URL.Path[1:]); err == nil {
			fileServer.ServeHTTP(w, req)
			return
		}
		// Serve index.html for SPA client-side routing.
		index, _ := distFS.Open("index.html")
		defer index.Close()
		http.ServeContent(w, req, "index.html", zeroTime, index.(interface {
			io.ReadSeeker
		}))
	}))

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Info().Str("addr", addr).Msg("kro-ui ready")
	return http.ListenAndServe(addr, r)
}
