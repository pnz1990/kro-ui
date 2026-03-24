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
FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS go-builder
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

# ── Stage 3: extract aws CLI v2 binary ──────────────────────────────
# aws-cli v2 ships a self-contained installer with bundled Python runtime.
# We copy only the installed tree so the final image stays small and
# does not require an Alpine/glibc base.
FROM public.ecr.aws/aws-cli/aws-cli:2 AS aws-cli

# ── Stage 4: minimal runtime image ──────────────────────────────────
# distroless/base (glibc) instead of distroless/static because the aws CLI
# v2 bundled runtime links against glibc.
# Mount ~/.aws (read-only) alongside ~/.kube/config for EKS clusters:
#   docker run ... \
#     -v ~/.kube/config:/home/nonroot/.kube/config:ro \
#     -v ~/.aws:/home/nonroot/.aws:ro \
#     ghcr.io/pnz1990/kro-ui:latest
FROM gcr.io/distroless/base:nonroot
COPY --from=aws-cli /usr/local/aws-cli /usr/local/aws-cli
# Symlink so client-go can exec "aws" from PATH
COPY --from=go-builder /kro-ui /kro-ui
ENV PATH="/usr/local/aws-cli/v2/current/bin:${PATH}"
EXPOSE 40107
ENTRYPOINT ["/kro-ui", "serve"]
