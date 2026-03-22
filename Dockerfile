# ── Stage 1: build frontend ───────────────────────────────────────────
FROM oven/bun:1 AS web-builder
WORKDIR /app/web
COPY web/package.json web/bun.lockb* ./
RUN bun install --frozen-lockfile
COPY web/ .
RUN bun run build

# ── Stage 2: build Go binary ─────────────────────────────────────────
FROM golang:1.25-alpine AS go-builder
# git is required by go mod download when GOPROXY=direct fetches from VCS
RUN apk add --no-cache git
WORKDIR /app
COPY go.mod go.sum ./
ENV GOPROXY=direct GONOSUMDB="*"
RUN go mod download
COPY . .
COPY --from=web-builder /app/web/dist ./web/dist
# TARGETARCH is set by Docker BuildKit (e.g. amd64, arm64).
# Go cross-compiles natively — no QEMU emulation needed.
ARG TARGETARCH
ARG VERSION=dev
ARG COMMIT=none
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build \
  -ldflags "-w -s \
    -X github.com/pnz1990/kro-ui/internal/version.Version=${VERSION} \
    -X github.com/pnz1990/kro-ui/internal/version.Commit=${COMMIT} \
    -X github.com/pnz1990/kro-ui/internal/version.BuildDate=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -o /kro-ui ./cmd/kro-ui

# ── Stage 3: minimal runtime image ──────────────────────────────────
FROM gcr.io/distroless/static:nonroot
COPY --from=go-builder /kro-ui /kro-ui
EXPOSE 40107
ENTRYPOINT ["/kro-ui", "serve"]
