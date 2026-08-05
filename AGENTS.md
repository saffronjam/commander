# AGENTS.md

Guidance for agents working in this repository.

## Project overview

Satisfactory Dashboard is a real-time dashboard for monitoring a Satisfactory factory: factory
statistics, power circuits, drone/train tracking, players, an interactive Leaflet map, and live
updates over GraphQL subscriptions.

One Go binary (stdlib `net/http` + gqlgen) serves the embedded React SPA, the map/icon assets, and a
single same-origin `/graphql` endpoint. Durable state lives in SQLite (sqlc + golang-migrate); live
data fans out in-process over Go channels (`pkg/eventbus`). The frontend is React + Vite +
shadcn/Tailwind, GraphQL-native via urql + graphql-codegen.

There is no Redis, no Gin, no REST, no SSE, and no separate frontend or asset container.

## Commands

`just` is the task runner. Run `just` with no arguments to list every recipe with its description.

```bash
just install          # Go + frontend dependencies
just unpack-assets    # extract the git-lfs map tiles and icons (once, after clone)
just dev              # frontend :3039 (proxies /graphql) + backend :8081, both hot-reloading
just check            # exactly what CI runs
```

Before committing anything that touches a generator input, run `just check` — CI fails on
generated-code drift. The generators:

```bash
just sqlc       # internal/store/queries + migrations -> internal/store/sqlite
just gqlgen     # api/schema.graphql              -> internal/graph/{generated.go,model}
just codegen    # api/schema.graphql + documents  -> dashboard/src/gql
just tygo       # api/models/models               -> dashboard/src/apiTypes.ts
just generate   # all four
```

Never start a service (`just dev`, `just web`, `just api`, `just up`) without being asked to. The
user drives service startup and testing.

## API surface

| Path | Transport | Use |
| --- | --- | --- |
| `/graphql` | POST/GET | queries (snapshot + `<domain>History`) and mutations (auth, sessions, settings) |
| `/graphql` | websocket | subscriptions (per-domain `<domain>Changed`) via graphql-ws |
| `/healthz` | GET | liveness probe |
| `/version` | GET | `{"version": "..."}` — the build's stamped version |
| `/` and `/assets/images/satisfactory/` | GET | embedded SPA (index.html fallback) + seeded map tiles |

`api/schema.graphql` is the contract: ~30 typed domains, ~24 enums, per-type history queries,
per-domain subscriptions. Field names are lowercase camelCase; enums are SCREAMING_SNAKE.

## Authorization

An instance is in one of three states, and `authStatus` — the only unguarded query — reports which:

| State | `initialized` | `authRequired` | Client shows |
| --- | --- | --- | --- |
| never set up | false | — | `/setup`, gated on the logged setup token |
| open | true | false | the dashboard, no login, no sign-out button |
| protected | true | true | `/login`, then the dashboard |

Nothing is guarded twice: `authMiddleware` (`api/cmd/server.go`) is the **only** place that knows
about auth modes. On an open instance it attaches an authorized `Caller` unconditionally, so the
`@auth` directive stays a pure "is there a caller?" check across all ~30 guarded fields, and
websocket upgrades are covered because they pass through the same middleware. Do not teach the
directive about modes.

There is no default password. A fresh instance is unclaimed and prints a single-use setup token;
setting an access key is optional. Access tokens are stored as SHA-256 digests, never in plaintext.
See `api/service/auth/AGENTS.md`.

## Adding a feature

1. Add the type/field/operation to `api/schema.graphql`.
2. `just gqlgen`, then add a resolver in `internal/graph/resolvers_*.go` and a mapper in
   `internal/graph/mappers_*.go`. Persist through `internal/store` when the data is durable.
3. On the frontend, write the typed document, run `just codegen`, and consume the generated hooks.
4. `just check`.

See `api/AGENTS.md` and `dashboard/AGENTS.md` for the per-side detail, and the package-level
AGENTS.md files under `api/internal/graph`, `api/internal/store`, `api/pkg/eventbus`, and
`dashboard/src/contexts/api`.

## Conventions

- **No backward compatibility.** Remove old code paths entirely rather than keeping dual behaviour.
  Clean breaks over gradual migrations.
- **No inline comments** explaining flow. Code should read on its own. Comment exported symbols (Go
  doc comments, JSDoc) and genuinely non-obvious edge cases only.
- **No migration or change-journey commentary** in code or docs — no "previously", "now uses",
  "replaces X". Git history and release notes are where change belongs.
- **The backend is the source of truth.** The frontend renders what subscriptions deliver.
- **The schema is the contract.** Regenerate after editing `api/schema.graphql`.

## Versioning and releases

The version is one `VERSION` build arg with two sinks, both fed from the same value: a Vite `define`
(`__BUILD_VERSION__` → `CONFIG.appVersion` → the sidebar) and Go ldflags
(`-X api/internal/version.Version` → `/version`). `.dockerignore` excludes `.git`, so the value must
arrive as a build arg — nothing inside the image can derive it.

- Tag builds stamp the tag (`v1.2.3`); `main` builds stamp `latest`; local `just build` / `just
  package` stamp `git describe --tags --always --dirty`, falling back to `localbuild`.
- Releasing is a single annotated tag. `.github/workflows/release.yaml` turns the tag's **body**
  into a draft GitHub release named after the tag, so the subject line is dropped on purpose:

  ```
  Satisfactory Dashboard v1.2.3
                                  <- blank line
  Highlights since v1.2.2 (12 commits).

  Added
  - ...

  Changed
  - ...
  ```

- `ci.yaml` independently gates on format, lint, typecheck, test, and codegen drift before pushing
  `ghcr.io/saffronjam/satisfactory-dashboard{,-seed}`.
- Map/icon tiles ship separately as a versioned OCI artifact, published by hand via the
  `publish-assets` workflow or `just assets-publish <tag>`. Pin them with `SD_ASSETS_REF`.
