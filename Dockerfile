FROM oven/bun:1.3-slim AS web
WORKDIR /web
COPY dashboard/package.json dashboard/bun.lock* ./
RUN bun install --frozen-lockfile
COPY dashboard/ .
# The version is stamped in from the outside: .dockerignore excludes .git, so
# nothing inside the build can derive it.
ARG VERSION=localbuild
ENV VITE_BUILD_VERSION=${VERSION}
RUN bun run build

FROM --platform=$BUILDPLATFORM golang:alpine AS build
RUN apk add --no-cache git
WORKDIR /src
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ .
COPY --from=web /api/web/dist ./web/dist
ARG TARGETOS
ARG TARGETARCH
ARG VERSION=localbuild
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath \
    -ldflags "-X api/internal/version.Version=${VERSION}" \
    -o /out/satisfactory-dashboard .

FROM alpine:3
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/satisfactory-dashboard .
COPY api/config.docker.yml config.local.yml
ENV SD_ASSETS_DIR=/assets
ENV SD_DB_PATH=/data/satisfactory-dashboard.db
VOLUME ["/data", "/assets"]
EXPOSE 8081
ENTRYPOINT ["./satisfactory-dashboard"]
