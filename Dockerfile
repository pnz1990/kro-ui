# ── Stage 1: build frontend ───────────────────────────────────────────
FROM oven/bun:1 AS web-builder
WORKDIR /app/web
COPY web/package.json web/bun.lockb* ./
RUN bun install --frozen-lockfile
COPY web/ .
RUN bun run build

# ── Stage 2: build Go binary ─────────────────────────────────────────
# --platform=$BUILDPLATFORM pins this stage to the CI runner's native platform
# (linux/amd64). apk, go mod download, and go build all run natively — no QEMU.
# TARGETARCH is injected by BuildKit and passed to GOARCH so the output binary
# targets the correct architecture (Go cross-compilation is near-instant).
FROM --platform=$BUILDPLATFORM golang:1.26.2-alpine AS go-builder
# git is required by go mod download when GOPROXY=direct fetches from VCS
RUN apk add --no-cache git
WORKDIR /app
COPY go.mod go.sum ./
ENV GOPROXY=direct GONOSUMDB="*"
RUN go mod download
COPY . .
COPY --from=web-builder /app/web/dist ./web/dist
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
# alpine so we can install aws-cli v2 for EKS exec credential plugin support.
# Mount ~/.aws (read-only) alongside ~/.kube/config for EKS clusters:
#   docker run ... \
#     -v ~/.kube/config:/home/nonroot/.kube/config:ro \
#     -v ~/.aws:/home/nonroot/.aws:ro \
#     ghcr.io/pnz1990/kro-ui:latest
FROM alpine:3.21
RUN apk add --no-cache aws-cli ca-certificates && \
    adduser -D -u 65532 nonroot
COPY --from=go-builder /kro-ui /kro-ui
EXPOSE 40107
USER nonroot
ENTRYPOINT ["/kro-ui", "serve"]
