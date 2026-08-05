# Backend

One Go binary: it polls the Ficsit Remote Monitoring (FRM) mod per session, fans live data out over
Go channels to GraphQL subscriptions, serves the embedded SPA and the seeded assets, and persists
sessions, settings, auth and history in SQLite.

## Layout

```
main.go              serve, or the `migrate` subcommand
cmd/                 process wiring: flags, App lifecycle, HTTP mux, static serving
internal/graph/      gqlgen resolvers + mappers            -> AGENTS.md
internal/store/      SQLite via sqlc + golang-migrate      -> AGENTS.md
internal/auth/       Caller/Token context types
internal/session/    session.ID
internal/version/    the ldflags-stamped Version string
models/models/       domain types (the tygo source for the frontend's apiTypes.ts)
models/mode/         dev | prod | test
pkg/config/          YAML config + SD_* env overrides
pkg/db/              the *sql.DB singleton and its DSN pragmas
pkg/eventbus/        in-process fan-out + latest-value store -> AGENTS.md
pkg/log/             zap setup, level control
service/frm_client/  FRM API translation layer             -> AGENTS.md
service/auth/        password + token service
service/session/     session helpers
worker/              SessionManager: one poll loop per active session
web/                 //go:embed all:dist  (the built SPA)
export/tygo.yml      models/models -> dashboard/src/apiTypes.ts
```

## Data flow

```
FRM mod ──poll──> worker.SessionManager ──> eventbus.ChannelBus ──> subscription resolvers ──> ws
                          │                        │
                          └──> eventbus.LatestStore └──> store (history_points)
                                    │
                                    └──> snapshot queries
```

`worker.SessionManager` owns one poll loop per active session and is the **sole producer** onto the
bus, the `LatestStore`, and the history table. Resolvers only ever read.

## Commands

Run from the repo root; `just` lists everything.

```bash
just api            # serve on :8081
just api-live       # serve with hot reload (air)
just test           # go test ./... -race
just lint           # go vet
just migrate-up     # the server also migrates at boot
just migrate-version
```

## Conventions

- Idiomatic Go: `gofmt -s`, errors checked immediately and wrapped with `fmt.Errorf("...: %w", err)`,
  happy path left-aligned, exported symbols documented, mixedCaps.
- Never maintain backward compatibility — delete the old path.
- Config is read once into `config.Config` (`pkg/config`). Env overrides are `SD_*`.
- Domain types live in `models/models` and are the tygo source; changing one changes the frontend's
  `apiTypes.ts`, so run `just tygo`.
- The `models` package must not import `internal/graph` — mapping is one-directional, domain →
  GraphQL model, and lives in `internal/graph/mappers_*.go`.

## Serving

`cmd/server.go` builds a plain `http.ServeMux`:

- `/graphql` — the gqlgen handler behind `authMiddleware`, which attaches the response writer, the
  client IP, and (when the `sd_access_token` cookie validates) the authenticated caller to the
  context. It never rejects; the `@auth` directive enforces.
- `/healthz`, `/version` — plain handlers.
- everything else — `registerStatic` (`cmd/static.go`): the embedded SPA with an index.html fallback,
  plus the seeded assets directory.

Websocket upgrades check `Origin` against `config.Config.ExternalURL`; empty means accept any (dev).

## Adding an FRM-backed domain

1. Fetch and translate it in `service/frm_client` (see that package's AGENTS.md).
2. Register it in `SetupEventStream` with a poll interval.
3. Add the type to `models/models` and, if the frontend needs the domain shape, run `just tygo`.
4. Add the GraphQL type, snapshot field and subscription to `api/schema.graphql`, then `just gqlgen`.
5. Add the resolver and mapper in `internal/graph`.
6. Persist to history in `worker` only if the domain is worth charting over time.
