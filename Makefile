IMAGE ?= ghcr.io/pnz1990/kro-ui
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT  ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")

.PHONY: all build web go run docker dev-web typecheck tidy clean \
        test-web test-web-watch test-e2e test-e2e-install test-e2e-report \
        demo demo-clean

## Build everything (frontend + Go binary)
all: build

## Build the frontend and then the Go binary
build: web go

## Build the React/Vite frontend
web:
	cd web && bun install && bun run build

## Build the Go binary (requires web/dist to exist)
go:
	GOPROXY=direct GONOSUMDB="*" go build \
	  -ldflags "-w -s \
	    -X github.com/pnz1990/kro-ui/internal/version.Version=$(VERSION) \
	    -X github.com/pnz1990/kro-ui/internal/version.Commit=$(COMMIT) \
	    -X github.com/pnz1990/kro-ui/internal/version.BuildDate=$$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
	  -o bin/kro-ui ./cmd/kro-ui

## Run frontend dev server (with proxy to Go server)
dev-web:
	cd web && bun run dev

## Run the Go server (assumes web/dist is already built)
run:
	go run ./cmd/kro-ui serve

## Build and push Docker image
docker:
	docker build \
	  --build-arg VERSION=$(VERSION) \
	  --build-arg COMMIT=$(COMMIT) \
	  -t $(IMAGE):$(VERSION) \
	  -t $(IMAGE):latest \
	  .

## Run type checks
typecheck:
	go vet ./...
	cd web && bun run typecheck

## Tidy Go modules
## Note: proxy.golang.org is blocked in some environments; GOPROXY=direct
## fetches modules directly from their VCS (requires github.com access).
tidy:
	GOPROXY=direct GONOSUMDB="*" go mod tidy

## Clean build artifacts
clean:
	rm -rf bin/ web/dist

## Run frontend unit tests (single run)
test-web:
	cd web && bun run test

## Run frontend unit tests in watch mode
test-web-watch:
	cd web && bun run test:watch

## Install Playwright and its Chromium browser (run once before test-e2e)
test-e2e-install:
	cd test/e2e && bun install
	cd test/e2e && bunx playwright install chromium --with-deps

## Run all E2E journeys against a kind cluster.
## Prerequisites: kind, helm, and kubectl must be in PATH.
## The kind cluster and kro installation are managed automatically by
## global-setup.ts / global-teardown.ts.
##
## To skip cluster creation (use an existing kind cluster):
##   SKIP_KIND_CREATE=true make test-e2e
##
## To keep the cluster after the run (for debugging):
##   SKIP_KIND_DELETE=true make test-e2e
test-e2e: build
	cd test/e2e && bun run test

## Open the last Playwright HTML report
test-e2e-report:
	cd test/e2e && bunx playwright show-report

## Start a local kro-ui demo cluster with all fixtures loaded.
## Prerequisites: kind, helm, and kubectl must be in PATH.
## Idempotent: re-running on an existing cluster is safe — the kind cluster,
## kro Helm release, and all fixture resources are created-or-reused.
## Builds the binary, applies fixtures, and starts the server at http://localhost:40107.
##
## To stop: press Ctrl+C. The cluster is left running for further exploration.
## To delete it: make demo-clean
demo: build
	@scripts/demo.sh

## Delete the demo kind cluster created by `make demo`.
demo-clean:
	kind delete cluster --name kro-ui-demo
