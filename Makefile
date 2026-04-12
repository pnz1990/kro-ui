IMAGE ?= ghcr.io/pnz1990/kro-ui
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT  ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")

.PHONY: all build web go run docker dev-web typecheck tidy clean \
        test-web test-web-watch test-e2e test-e2e-install test-e2e-report \
        demo demo-clean dump-fixtures \
        helm-docs helm-test helm-lint helm-package helm-push

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
## Prerequisites: kind and kubectl must be in PATH.
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
## Prerequisites: kind and kubectl must be in PATH.
## Idempotent: re-running on an existing cluster is safe — the kind cluster,
## kro installation, and all fixture resources are created-or-reused.
## Builds the binary, applies fixtures, and starts the server at http://localhost:40107.
##
## To stop: press Ctrl+C. The cluster is left running for further exploration.
## To delete it: make demo-clean
demo: build
	@scripts/demo.sh

## Delete the demo kind cluster created by `make demo`.
demo-clean:
	kind delete cluster --name kro-ui-demo

## Regenerate upstream fixture YAMLs into test/e2e/fixtures/.
## Run after a kro version bump:
##   GOPROXY=direct GONOSUMDB="*" go get github.com/kubernetes-sigs/kro@vX.Y.Z
##   make tidy && make dump-fixtures
##   git diff test/e2e/fixtures/upstream-*.yaml
dump-fixtures:
	GOPROXY=direct GONOSUMDB="*" go run -tags tools ./cmd/dump-fixtures

## Helm chart targets

## Install helm plugins (helm-docs, unittest)
helm-install:
	helm plugin install https://github.com/nicholasjng/helm-docs --version latest || true
	helm plugin install https://github.com/helm-unittest/helm-unittest --version latest || true

## Generate README.md from README.md.gotmpl (requires helm-docs)
helm-docs:
	helm-docs --chart-search-root=helm/kro-ui --sort-values-order=file --skip-version-footer=true

## Run helm-unittest tests
helm-test:
	helm unittest helm/kro-ui

## Lint the helm chart
helm-lint:
	helm lint helm/kro-ui

## Package the helm chart into a .tgz
helm-package:
	helm package helm/kro-ui --destination dist/

## Bump chart version and package for release.
## Usage: make helm-bump VERSION=0.9.4 (bumps from X.Y.Z to X.Y.Z+1, sets appVersion)
helm-bump:
	@CHART_VERSION=$$(grep '^version:' helm/kro-ui/Chart.yaml | awk '{print $$2}') && \
	MAJOR=$$(echo $$CHART_VERSION | cut -d. -f1) && \
	MINOR=$$(echo $$CHART_VERSION | cut -d. -f2) && \
	PATCH=$$(echo $$CHART_VERSION | cut -d. -f3) && \
	NEW_VERSION="$$MAJOR.$$MINOR.$$((PATCH + 1))" && \
	echo "Bumping chart version: $$CHART_VERSION -> $$NEW_VERSION" && \
	sed -i "s/^version: $$CHART_VERSION/version: $$NEW_VERSION/" helm/kro-ui/Chart.yaml && \
	sed -i "s/^appVersion: \"[0-9.]*\"/appVersion: \"$(VERSION)\"/" helm/kro-ui/Chart.yaml && \
	grep -E '^(version|appVersion):' helm/kro-ui/Chart.yaml
