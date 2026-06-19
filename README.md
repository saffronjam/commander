# Satisfactory Dashboard

<div align="center">
  <img src="docs/images/dashboard.png" alt="Satisfactory Dashboard" width="800">
</div>

A real-time scalable dashboard for monitoring and managing your Satisfactory factory.

## Requirements

This dashboard is built on the [Ficsit Remote Monitoring (FRM)](https://github.com/porisius/FicsitRemoteMonitoring) mod, which exposes factory data via an API. You must have FRM installed and running in your Satisfactory game for the dashboard to work.

**Installing the mod:**

Use [Satisfactory Mod Manager](https://docs.ficsit.app/) to install and manage mods. Search for "Ficsit Remote Monitoring" in the mod manager and install it. Once in-game, start with `/frm http start` (See docs [here](https://docs.ficsit.app/ficsitremotemonitoring/latest/commands.html)). This should print the port that is exposed. After that, you can add your session endpoint in this dashboard.

## Features

- Factory statistics visualization (energy, resources, sink points)
- Power circuit monitoring
- Drone and train tracking
- Player management
- Interactive map with Leaflet
- Real-time updates via GraphQL subscriptions (graphql-ws)
- **Multi-session support:** Connect to multiple FRM endpoints simultaneously - like your friends FRM endpoints

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────┐     ┌─────────────┐
│ Satisfactory│     │   Single Go binary (:8081)           │     │   Browser   │
│   (FRM)     │◄────│  poller → channel eventbus → GraphQL │◄────│   Clients   │
│             │     │  + embedded SPA + SQLite + assets    │     │ (graphql-ws)│
└─────────────┘     └──────────────────────────────────────┘     └─────────────┘
     1 poll          1 in-process poller per session              N subscribers
```

The dashboard is designed so that **client browsers never directly communicate with the FRM API**. Instead:

1. **In-process poller:** one poll loop per session fetches data from your Satisfactory FRM endpoint
2. **Channel eventbus:** the poller fans updates out in-process over Go channels (no Redis)
3. **GraphQL subscriptions:** each browser subscribes over a same-origin websocket (`/graphql`, graphql-ws); durable state (sessions, settings, auth, history) lives in SQLite

This means **many dashboard clients never affect your Satisfactory game performance** — the game only ever sees one polling connection per session regardless of how many people view the dashboard. Everything is one process, one container, one origin.

## Quick Start

```bash
docker compose up -d        # one-shot asset seeder + the app
```

Then open http://localhost:8081. The default password is `change-me` (`SD_BOOTSTRAP_PASSWORD`) — change it after first login.

## Development

```bash
make unpack-assets   # Extract LFS assets into dashboard/public/assets (after clone)
make run             # Run frontend (3039, proxies /graphql) + backend (8081) with hot reload
```

Other useful commands:

```bash
make help      # Show all available commands
make lint      # Run linters
make build     # Build for production (frontend embeds into the Go binary)
```

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Bun, shadcn/ui + Tailwind, urql + graphql-codegen
- **Backend:** Go (stdlib `net/http`), gqlgen GraphQL, SQLite (sqlc + golang-migrate)
- **Real-time:** GraphQL subscriptions over graphql-ws (Go-channel eventbus)

## Production Deployment

The dashboard ships as **one application image** plus a tiny one-shot **seeder** image. The map/icon
tiles are distributed as a versioned OCI artifact pulled with [ORAS](https://oras.land/) — they are
never baked into the app image and never require git-lfs at deploy time.

```
   registry (ghcr.io)
     satisfactory-dashboard        (app — code only, tens of MB)
     satisfactory-dashboard-seed   (seeder — alpine + oras)
     satisfactory-dashboard-assets (OCI artifact — map tiles, pushed rarely)
            │ oras pull                          │ docker pull
            ▼                                    ▼
     ┌──────────────┐   /assets volume   ┌───────────────────────────┐
     │ seed (once)  │───────────────────►│ app (Go, :8081)           │
     └──────────────┘                    │  SPA + assets + /graphql  │
                                         │  /data volume → SQLite     │
                                         └───────────────────────────┘
```

### Services

| Service | Description | Lifecycle |
|---------|-------------|-----------|
| `seed-assets` | ORAS-pulls the tiles artifact into the shared volume | one-shot (no-op once seeded) |
| `app` | Go binary: embedded SPA + assets + GraphQL on `:8081` | long-running |

### Building & publishing

```bash
make docker-build                              # build app + seeder images
make assets-publish ASSETS_TAG=tiles-YYYYMMDD  # push the tiles OCI artifact (maintainer-only)
```

Pin the tiles version with `SD_ASSETS_REF`; lock the websocket origin with `SD_EXTERNAL_URL`.

### Local contributor stack (bind-mount tiles, skip the seeder)

```bash
make unpack-assets
docker compose -f compose.yml -f compose.dev.yml up
```

## Note on Repository Size

This repository tracks the map/icon assets via git-lfs (`assets/*.tar.gz`). They are the *source*
for the ORAS artifact; deployments pull images only and never need lfs.
