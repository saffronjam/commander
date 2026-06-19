# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Satisfactory Dashboard is a real-time dashboard application for monitoring and managing a Satisfactory game factory. Features: factory statistics visualization, power circuit monitoring, drone/train tracking, player management, interactive map with Leaflet, and real-time updates via GraphQL subscriptions (graphql-ws).

Architecture: a single Go binary (stdlib `net/http` + gqlgen GraphQL) serves the embedded React SPA, the map/icon assets, and one same-origin `/graphql` endpoint (HTTP queries/mutations + websocket subscriptions). State lives in SQLite (sqlc + golang-migrate); live data fans out in-process over Go channels (eventbus). The frontend is React + Vite + shadcn/Tailwind, GraphQL-native via urql + graphql-codegen. There is no Redis, no Gin, no REST/SSE, no separate frontend/asset containers.

## Quick Start

```bash
# Operator (pull images): the one-shot seeder ORAS-pulls the map tiles into a
# volume, then the single app container serves everything on :8081.
docker compose up -d          # seed-assets (one-shot) + app (:8081)
```

### Development

```bash
make unpack-assets   # Extract LFS assets into dashboard/public/assets (after clone)
make run             # Run frontend (3039, proxies /graphql) + backend (8081) with hot reload
```

### Essential Commands

```bash
make help      # Show all available commands
make lint      # Run all linters
make format    # Format all code
make build     # Build for production
make generate  # Generate TypeScript types from Go structs
```

**CRITICAL**: Run `make generate` after any changes to Go model structs to keep frontend types in sync.

## API

There is a single GraphQL endpoint, served same-origin:

| Path        | Transport | Use                                                    |
| ----------- | --------- | ------------------------------------------------------ |
| `/graphql`  | POST/GET  | queries (snapshot + `<domain>History`) and mutations (auth, sessions, settings) |
| `/graphql`  | websocket | subscriptions (per-domain `<domain>Changed` live data) via graphql-ws |
| `/healthz`  | GET       | liveness probe                                         |
| `/` + `/assets/images/satisfactory/` | GET | embedded SPA (index.html fallback) + seeded map/icon tiles |

The schema lives at `api/schema.graphql` (~30 typed domains, ~24 enums, per-type history queries,
per-domain subscriptions). Auth is a single shared password over an HTTP-only `sd_access_token`
cookie; the `@auth` directive guards protected fields and the websocket reads the same cookie off
its upgrade request (same-origin).

## Development Workflow

### Adding New Features

1. **Schema**: add the type/field/operation to `api/schema.graphql`
2. **Backend**: regenerate gqlgen models (`generated.go`/`models_gen.go`), add a resolver in
   `internal/graph/resolvers_*.go`, and a mapper in `internal/graph/mappers_*.go`; persist via the
   SQLite store (`internal/store`) when durable
3. **Frontend**: write the typed operation document, run `bun run codegen`, consume the generated
   hooks/types from `src/gql`
4. **Code quality**: run `make lint` and `make format`

### Adding New GraphQL Operations

1. Edit `api/schema.graphql` (SDL is the source of truth; field names are lowercase camelCase,
   enums are SCREAMING_SNAKE)
2. Regenerate gqlgen `generated.go`/`models_gen.go` (do NOT run `gqlgen generate` blindly — it
   re-stubs `schema.resolvers.go`; resolvers live in `resolvers_*.go`)
3. Implement the resolver and any enum/case mappers
4. On the frontend, add the document and run `bun run codegen`

## Docker Deployment

```bash
make docker-build                   # Build the app + seeder images
docker compose up -d                # seed-assets (one-shot ORAS pull) + app (:8081)
docker compose logs -f app          # Follow app logs
```

Map/icon tiles ship as a versioned OCI artifact (`…-assets:<tiles-tag>`) pulled by the one-shot
seeder into a shared volume; pin the version via `SD_ASSETS_REF`. Publish a new tiles version with
`make assets-publish ASSETS_TAG=tiles-YYYYMMDD` (maintainer-only, requires `oras` + LFS).

**Upgrade note (auth clean-wipe):** the auth store moved from Redis to SQLite with NO migration of
the old password/tokens. On first boot against an empty DB the password re-bootstraps to
`SD_BOOTSTRAP_PASSWORD` (default `change-me`); re-set it after upgrade.

## Important Notes

- **NEVER Start Services Without User Permission**: NEVER run backend or frontend services (make run, make backend, make frontend, etc.) without CLEAR and EXPLICIT instructions from the user. The user controls all service startup and will handle testing and verification themselves. Only start services when the user explicitly asks you to.
- **Never Maintain Backward Compatibility**: Always implement the correct fix for a better system. Remove old code paths completely rather than maintaining dual behavior. Clean breaks are preferred over gradual migrations.
- **No Inline Comments**: Do NOT add comments explaining logic flow in code. The code should be self-documenting. Only add comments for exported functions/types (Go doc comments, JSDoc) or truly non-obvious edge cases.
- **State Management**: Backend is the source of truth; the frontend receives live updates via GraphQL subscriptions (graphql-ws). Durable state (sessions, settings, auth, history) is in SQLite; live data fans out in-process over the Go-channel eventbus.
- **Schema is the contract**: `api/schema.graphql` is the source of truth. Regenerate gqlgen types after editing it, then `bun run codegen` on the frontend.

## Detailed Documentation

- **api/CLAUDE.md**: Backend architecture, patterns, and development guide
- **dashboard/CLAUDE.md**: Frontend architecture, patterns, and development guide
- **GraphQL schema**: `api/schema.graphql`

## Active Technologies
- Go 1.24 (backend), TypeScript 5.6 (frontend) + Gin (HTTP), Redis (session store), React 18, Material-UI 6 (001-access-key-auth)
- Redis for access tokens and hashed password (001-access-key-auth)
- Go 1.24.1 + go-redis/v9 (existing), gin-gonic (existing), zap (logging) (002-redis-poll-lease)
- Redis (existing infrastructure, used for sessions and caching) (002-redis-poll-lease)
- TypeScript 5.6, React 18.3, Bun 1.3 + shadcn/ui, Tailwind CSS v4, Recharts, React Router 6, Leaflet (003-shadcn-migration)
- TypeScript 5.6 (frontend), React 18.3 + React, Leaflet, Material-UI 6, zustand (for potential state management) (004-universal-map-selection)
- localStorage (map settings persistence) (004-universal-map-selection)
- Go 1.24 (backend), TypeScript 5.6 (frontend) + Gin (HTTP), React 18, shadcn/ui, Tailwind CSS v4, Lucide React (icons) (005-unlockables)
- Redis (session-scoped caching via existing infrastructure) (005-unlockables)
- Go 1.24 (backend), TypeScript 5.6 (frontend) + Gin (HTTP), go-redis/v9, React 18, Material-UI 6 (006-data-history-persistence)
- Redis (existing infrastructure) (006-data-history-persistence)

## Recent Changes
- 001-access-key-auth: Added Go 1.24 (backend), TypeScript 5.6 (frontend) + Gin (HTTP), Redis (session store), React 18, Material-UI 6
