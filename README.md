<h1 align="center">Satisfactory Dashboard</h1>

<p align="center">
  Your whole factory, live, from one binary.
</p>

<p align="center">
  <a href="https://github.com/saffronjam/satisfactory-dashboard/actions/workflows/ci.yaml"><img src="https://github.com/saffronjam/satisfactory-dashboard/actions/workflows/ci.yaml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/saffronjam/satisfactory-dashboard/releases"><img src="https://img.shields.io/github/v/release/saffronjam/satisfactory-dashboard?display_name=tag&sort=semver" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/go-1.25-00ADD8.svg?logo=go&logoColor=white" alt="Go 1.25" />
  <img src="https://img.shields.io/badge/react-18-61DAFB.svg?logo=react&logoColor=white" alt="React 18" />
</p>

---

<div align="center">
  <img src="docs/images/dashboard.png" alt="Satisfactory Dashboard" width="800">
</div>

A real-time dashboard for a Satisfactory factory: power circuits and battery banks, production and
sink statistics, trains, drones, trucks and their stations, players, milestones, and an interactive
map of the whole world. Everything updates itself over GraphQL subscriptions, and every chart has
history behind it.

One Go process does all of it — GraphQL API, embedded React dashboard, SQLite, and the map tiles. No
database to run, no reverse proxy to configure, nothing to keep in sync.

Your browser never talks to the game. A single in-process poller reads your Ficsit Remote Monitoring
endpoint once per session and fans the result out over Go channels to every connected subscriber, so
ten people watching the dashboard cost the game exactly as much as one:

```
┌─────────────┐     ┌──────────────────────────────────────┐     ┌─────────────┐
│ Satisfactory│     │   Single Go binary (:8081)           │     │   Browser   │
│   (FRM)     │◄────│  poller → channel eventbus → GraphQL │◄────│   Clients   │
│             │     │  + embedded SPA + SQLite + assets    │     │ (graphql-ws)│
└─────────────┘     └──────────────────────────────────────┘     └─────────────┘
    1 poll             1 in-process poller per session            N subscribers
```

Sessions are first-class: point the dashboard at several FRM endpoints — your save and your friends'
— and switch between them from the sidebar.

## Requirements

The dashboard reads its data from the
[Ficsit Remote Monitoring](https://github.com/porisius/FicsitRemoteMonitoring) mod, so you need it
installed and running in your game. Install it with
[Satisfactory Mod Manager](https://docs.ficsit.app/), then in-game run:

```
/frm http start
```

That prints the port FRM is listening on. You add that endpoint as a session in the dashboard.

## Run with Docker

```bash
docker compose up -d
```

Two containers: a one-shot seeder that pulls the map tiles into a volume, then the app on
[localhost:8081](http://localhost:8081). The default password is `change-me`
(`SD_BOOTSTRAP_PASSWORD`) — change it after your first login.

Worth setting for anything beyond a local run:

| Variable | Purpose |
| --- | --- |
| `SD_BOOTSTRAP_PASSWORD` | initial password, applied on first boot against an empty database |
| `SD_EXTERNAL_URL` | locks the websocket `Origin` check to your hostname |
| `SD_VERSION` | pins a released image tag instead of tracking `main` |
| `SD_ASSETS_REF` | pins the map tiles artifact version |
| `SD_MAX_SAMPLE_GAME_DURATION` | how much game-time history to retain |

## First run

Log in, then add a session with the address FRM printed. The dashboard validates it, starts polling,
and the pages fill in as data arrives. History accumulates from the moment a session is live, per
save — switching saves in-game starts a clean series rather than mixing the two.

## Run from source

Needs Go 1.25+, Bun, and [`just`](https://github.com/casey/just).

```bash
just install         # Go + frontend dependencies
just unpack-assets   # extract the git-lfs map tiles and icons
just dev             # dashboard on :3039, API on :8081, both hot-reloading
```

`just` on its own lists every recipe. The ones worth knowing:

```bash
just generate            # regenerate sqlc, gqlgen, GraphQL client and domain types
just check               # exactly what CI runs
just package             # build the container images
```

CI fails on generated-code drift, so run `just check` before pushing anything that touches
`api/schema.graphql`, `api/internal/store/queries/`, `api/models/models/`, or a GraphQL document.

## Releases

Releasing is one annotated tag. Its body becomes a draft GitHub release, and the tag name is stamped
into the build — you can read it at the bottom of the sidebar and on `/version`, so you always know
what is actually deployed.

Images are published to `ghcr.io/saffronjam/satisfactory-dashboard`. The map and icon tiles are
distributed separately as a versioned OCI artifact pulled with [ORAS](https://oras.land/), which is
why the app image stays small and no deployment ever needs git-lfs.

## License

[MIT](LICENSE)
