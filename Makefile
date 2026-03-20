IMAGE ?= ghcr.io/pnz1990/kro-ui
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT  ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")

.PHONY: all build web go run docker dev clean

## Build everything (frontend + Go binary)
all: build

## Build the frontend and then the Go binary
build: web go

## Build the React/Vite frontend
web:
	cd web && bun install && bun run build

## Build the Go binary (requires web/dist to exist)
go:
	go build \
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
tidy:
	go mod tidy

## Clean build artifacts
clean:
	rm -rf bin/ web/dist
