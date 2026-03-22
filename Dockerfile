# ── Stage 1: build frontend ───────────────────────────────────────────
FROM oven/bun:1 AS web-builder
WORKDIR /app/web
COPY web/package.json web/bun.lockb* ./
RUN bun install --frozen-lockfile
COPY web/ .
RUN bun run build

# ── Stage 2: build Go binary ─────────────────────────────────────────
FROM golang:1.25-alpine AS go-builder
RUN apk add --no-cache git
WORKDIR /app
# git is required by go mod download when GOPROXY=direct fetches from VCS
RUN apk add --no-cache git
COPY go.mod go.sum ./
ENV GOPROXY=direct GONOSUMDB="*"
RUN go mod download
COPY . .
COPY --from=web-builder /app/web/dist ./web/dist
RUN CGO_ENABLED=0 GOOS=linux go build \
  -ldflags "-w -s \
    -X github.com/pnz1990/kro-ui/internal/version.Version=${VERSION:-dev} \
    -X github.com/pnz1990/kro-ui/internal/version.Commit=${COMMIT:-none} \
    -X github.com/pnz1990/kro-ui/internal/version.BuildDate=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -o /kro-ui ./cmd/kro-ui

# ── Stage 3: minimal runtime image ──────────────────────────────────
FROM gcr.io/distroless/static:nonroot
COPY --from=go-builder /kro-ui /kro-ui
EXPOSE 40107
ENTRYPOINT ["/kro-ui", "serve"]
