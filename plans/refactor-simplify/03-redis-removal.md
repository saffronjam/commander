# 03 — Redis removal: the kill map

## Context

The backend currently routes everything through Redis: the live-state cache, the
SSE-backing pub/sub, settings storage and change-broadcast, auth password + tokens,
session config, the deleted-session tombstone, the history time-series (ZSET index +
per-point JSON values), and the entire distributed-polling lease/heartbeat
coordination layer. There is exactly **one** Redis dependency (`github.com/redis/go-redis/v9`),
funnelled through one client wrapper (`api/pkg/db/key_value/client.go`) plus direct
`db.DB.RedisClient` use inside `api/service/lease/`.

The refactor removes Redis entirely. Every touchpoint moves to one of three homes:

- **Go channels / in-process eventbus** — live data and broadcasts (plan 05).
- **SQLite via sqlc** — stateful, historical, auth, settings, session data (plan 04).
- **In-memory map / state held by the single poller** — ephemeral "latest value"
  caches and coordination guards that no longer need a store (plans 02 / 05).

This document is the cross-cutting checklist: it owns the *decision* of where each
Redis object goes and the *sequencing* of the removal so the build never silently
keeps a Redis dependency past a defined cut point. Plans 02 (poller), 04 (SQLite),
05 (eventbus), 06 (GraphQL) own the implementations; this plan is what they plug into.
It is the authority on the deletion of `api/pkg/db/redis.go`, `api/pkg/db/key_value/`,
the `go-redis` dependency, the `redis` compose service, the Redis config fields, and
the `make deps` / `deps-down` targets.

Redis code paths are deleted, not feature-flagged. At the cut point Redis is gone in one
commit; there is no interim "Redis optional" mode.

One Redis object — the auth password + tokens (#5a/#5b) — is **not** migrated to SQLite; its
data is **intentionally discarded** on the cutover. This is the user-approved **auth clean
wipe** (decision D-A): on first boot against an empty SQLite DB, auth re-bootstraps to
`SD_BOOTSTRAP_PASSWORD` (default `"change-me"`, `is_default = 1`) and all previously issued
access tokens are gone. This is a deliberate clean cutover, not an accidental loss of
backward compatibility — see the prominent release note below. Every other stateful Redis
object (settings, sessions, history) keeps its data semantics in its SQLite home; only auth
state is reset by design.

## Settled design decisions (recorded for future-you)

- **One client wrapper dies, three homes replace it.** `key_value.Client` is not
  re-pointed at SQLite; it is deleted. Each caller is rewritten to talk to its new
  home directly (eventbus, the `*store.DB` wrapper from plan 04, or an in-memory map).
  No generic KV abstraction survives — that abstraction only existed to wrap Redis.

- **Live "latest state" is in-memory, never persisted.** The `state:*` cache is the
  latest value of the live stream. It is rebuilt every poll cycle, so it does not need
  durability. The single poller (plan 02) holds the in-memory `LatestStore` keyed by
  `(sessionID, saveName, dataType)` (decision E-11) and exposes per-domain accessors that
  the **typed per-domain snapshot query resolvers** read (`circuits`, `players`, `drones`,
  `factoryStats`, … — doc 08's snapshot-query catalog). There is no single `state` /
  `liveState` query (FORBIDDEN, decision D-C); each domain reads its own slice of the
  `LatestStore`. It does **not** go to SQLite.

- **Session-stage (`init` / `ready`) becomes in-memory poller state.** Today
  `IsSessionReady` checks that all `RequiredEventTypes` keys exist in Redis. After the
  cut it is "has the poller received all `RequiredEventTypes` for this session since it
  started" — a per-session bitset/set the poller maintains alongside the latest-state map.

- **History is the one thing that truly persists.** The ZSET-index-plus-JSON-string
  scheme collapses into the single SQLite `history_points` table (composite PK
  `(session_id, save_name, data_type, game_time_id)` + JSON `data` column, decision E-6),
  queried by range (plan 04 / 08). N+1 `GET`-per-point reads become one ranged `SELECT`.

- **TTL semantics that mattered:** only the auth-token 7-day TTL *mechanism* needs
  reimplementing (as an `expires_at` column on `auth_tokens` + lazy check on read +
  periodic `RunTokenPrune`, decision E-7). The *existing* token rows are not carried over
  — the auth clean wipe (D-A) discards them; only the expiry behavior is rebuilt for
  tokens minted after the cutover. The other TTLs (lease 30s, heartbeat 30s, tombstone
  24h) belong to subsystems that are deleted, not ported.

- **Auth state is wiped, not migrated (decision D-A).** `auth:password` and `auth:token:*`
  are the only stateful Redis objects whose data is deliberately dropped rather than
  re-homed with its contents. The SQLite `auth_password` / `auth_tokens` tables (plan 04)
  start empty; the auth service re-bootstraps the singleton `auth_password` row to
  `SD_BOOTSTRAP_PASSWORD` with `is_default = 1` on first boot. The operator must re-set
  their password after upgrade. This is the user-approved clean cutover, surfaced in the
  release note below; 01/02/06 carry it into the deployment/upgrade docs.

- **Two broadcasts collapse to in-process calls.** The `settings_changed` pub/sub and
  the `satisfactory_events:*` pub/sub only ever mattered for cross-instance fan-out.
  With one process, `settings_changed` becomes an in-memory channel (or a direct call to
  the log-level apply), and `satisfactory_events` becomes the eventbus topic (plan 05).

- **The deleted-session tombstone is eliminated, not ported.** With a single in-process
  poller, deleting a session synchronously cancels its poll goroutine, so the
  write-after-delete race the tombstone guarded against disappears. SQLite hard-delete
  (or FK cascade) replaces `ClearHistoryData` / `ClearCachedState`. No 24h guard key.

- **The lease subsystem has no replacement.** `poll:lease:*` and `poll:node:*` are
  coordination state that ceases to exist (plan 02). Not a channel, not a table — gone.

- **`notify-keyspace-events Ex` and `SetUpExpirationListener` are dead today.** Nothing
  consumes expired-key events. They disappear with `redis.go` and the KV client; no
  replacement needed.

- **`Incr` / `Decr` / `SetXX` on the KV client have no callers.** Dead surface, dropped
  with the wrapper, no porting.

- **`save_name` stays a first-class partition key.** The `state:` and `history:` keys are
  save-name-scoped (intentional fix, commit `0a12da81`). In SQLite this is a `save_name`
  column participating in the composite index; in the in-memory latest-state map it is a
  map key segment. Per-save isolation must not regress.

## The kill map

Every Redis object from the inventory, with its concrete replacement and the plan that
owns the implementation. "Home" is one of: **bus** (Go channel/eventbus, plan 05),
**sqlite** (sqlc store, plan 04), **memory** (in-process map/state), **deleted** (no
replacement).

| # | Redis object | Key / channel | Role | TTL | Home | Replacement | Owning plan |
|---|---|---|---|---|---|---|---|
| 1 | live state cache | `state:{sid}:{save}:{evt}` | KV cache | none | memory | poller-held `LatestState(sid)` map keyed by `(save, evt)` | 02 / 05 |
| 2 | SSE events | `satisfactory_events:{sid}` (pub/sub) | stream | — | bus | eventbus topic per `sid`; subscription resolvers subscribe | 05 / 06 |
| 3 | settings change | `settings_changed` (pub/sub) | stream | — | memory | in-proc channel or direct `log.SetLogLevel` call on `Update()` | 05 |
| 4 | settings store | `global:settings` | KV config | none | sqlite | `settings` table (key/value rows, `UpsertSetting` ON CONFLICT) | 04 |
| 5a | auth password | `auth:password` | KV auth | none | sqlite (data wiped, D-A) | `auth_password(id PK CHECK(id=1), hash, is_default, updated_at)` singleton — **re-bootstrapped to `SD_BOOTSTRAP_PASSWORD`, not migrated** | 04 |
| 5b | auth tokens | `auth:token:{tok}` | KV auth | 7d | sqlite (data wiped, D-A) | `auth_tokens(token PK, created_at, last_used, expires_at, client_ip)` + lazy expiry + `RunTokenPrune` — **existing tokens discarded** | 04 |
| 6 | session store | `session:{id}` | KV state | none | sqlite | `sessions` table; `List` → `SELECT *`; status cols updated by poller | 04 |
| 7 | delete tombstone | `deleted-session:{id}` | coordination | 24h | deleted | synchronous poller cancel on delete; hard-delete in SQLite | 02 |
| 8a | history index | `history:{sid}:{save}:{type}` (ZSET) | history | none | sqlite | `history_points` table, `ORDER BY game_time_id` | 04 / 06 |
| 8b | history data | `history:...:data:{gtid}` (string) | history | none | sqlite | `history_points.data` BLOB/JSON; upsert on `(sid,save,type,gtid)` | 04 / 06 |
| 9a | poll lease | `poll:lease:{sid}` | coordination lock | 30s | deleted | none — single process owns all sessions | 02 |
| 9b | node heartbeat | `poll:node:{iid}` | coordination | 30s | deleted | none — no node identity | 02 |
| — | keyspace events | `CONFIG SET notify-keyspace-events Ex` | infra | — | deleted | dead path (no consumers) | 03 |

### Caller rewrites that 03 tracks (so nothing is missed)

These are the call sites that touch the KV client / Redis client and must be re-homed
before the wrapper can be deleted. Implementation belongs to the listed plan; 03 owns
the checklist that all of them are done.

- **State cache reads — ~30 call sites in `routers/api/v1/`** (`state.go`, `status.go`,
  `circuits.go`, `stats.go`, `players.go`, `drones.go`, `trains.go`,
  `infrastructure.go`, `world.go`, `machines.go`, `schematics.go`,
  `resource_nodes.go`) all call `session.GetCachedState`. Each becomes a typed per-domain
  GraphQL snapshot query resolver reading the poller's in-memory `LatestStore` (plan 06
  turns them into resolvers; plan 02/05 provides the accessor). There is no single `state`
  query (D-C); the REST `state.go` fans out into the per-domain snapshot queries.
  `GetCachedState`, `GetSessionStage`, `IsSessionReady`, `ClearCachedState` in
  `api/service/session/cache.go` are rewritten off Redis (state portion → memory).
- **State cache writes** — `api/worker/session_manager.go` (publishLoop) `Set(stateKey, …)`
  → write into the poller's in-memory map (plan 02 / 05).
- **Event publish** — `session_manager.go:343` and `:446` (`kvClient.Publish`) →
  `bus.Publish(topic, event)` (plan 05). Centralize the topic-key construction that is
  currently duplicated at `session_manager.go:254` and `events_sse.go:166`.
- **Event subscribe** — `api/routers/api/v1/events_sse.go` (`AddListener`) → GraphQL
  subscription resolver subscribing to the bus (plan 06). The whole SSE file is deleted
  by plan 06; 03 only confirms the Redis subscribe is gone.
- **Settings store + broadcast** — `api/service/settings/service.go` `Get`/`Update`
  (`Set`/`Publish` on `global:settings` + `settings_changed`) → SQLite read/write
  (plan 04) + in-proc broadcast (plan 05). `api/worker/settings_listener.go`
  (`AddListener`) → in-proc subscriber.
- **Auth** — `api/service/auth/auth.go` (`IsSet`/`Get`/`Set`/`Del` on `auth:password`,
  `auth:token:*`) → `*store.DB` auth methods against `auth_password` / `auth_tokens`
  (plan 04). **No data migration (D-A):** the tables start empty and the service
  re-bootstraps the `auth_password` row to `SD_BOOTSTRAP_PASSWORD` (`is_default = 1`) on
  first boot; existing Redis tokens are discarded. `rate_limiter.go` is pure in-memory
  `sync.Map`, untouched (its `client_ip` context now comes from the `auth_tokens.client_ip`
  column). `GetTokenTTL()` stays a Go const for cookie max-age.
- **Session store** — `api/service/session/store.go` (`Create`/`Get`/`Update`/`Delete`/
  `List`/`UpdateOnlineStatus`/`UpdateDisconnectedStatus`) → `*store.DB` session methods
  (plan 04).
- **History** — `api/service/session/cache.go` (`StoreHistoryPoint`, `GetHistory`,
  `GetHistorySaves`, `PruneOldHistory`, `ClearHistoryData`) → `*store.DB` `history_points`
  methods (plan 04); `api/routers/api/v1/history.go` → the per-type `<domain>History`
  GraphQL query resolvers + `historySaves` (plan 06, doc 08 catalog).
- **Tombstone** — `MarkSessionDeleted` / `IsSessionDeleted` (`cache.go`) and their
  callers (`sessions.go:151`, `cache.go:189`, `session_manager.go:269`) → deleted (plan
  02); guard removed because the poller cancel is synchronous.
- **Lease** — all of `api/service/lease/` (direct `RedisClient` `SetNX`/`Get`/`Scan`/
  `EVAL`) → deleted (plan 02).

## Files to CHANGE / DELETE (owned by 03)

These are the pure-Redis-plumbing files this plan deletes or edits directly. The
*caller* rewrites above are edited by 02/04/05/06; the files below are the wiring that
03 removes once those rewrites land.

### DELETE

- `api/pkg/db/redis.go` — the Redis client constructor + `notify-keyspace-events`.
- `api/pkg/db/key_value/client.go` (and the whole `api/pkg/db/key_value/` directory) —
  the sole Redis wrapper.
- The `redis` service block and the `redis-data` volume in `compose.yml`.
- The `redis:` block in `api/config.docker.yml` (lines ~9–11) and `api/config.local.yml`
  (lines ~9–11).

### CHANGE

- `api/pkg/db/db.go` — remove `RedisClient *redis.Client` from `Context`, remove the
  `setupRedis()` call from `Setup()` and `shutdownRedis()` from `Shutdown()`. Plan 04
  re-purposes `db.Setup()` to open the SQLite `*sql.DB` + run migrations (or `db.go` is
  replaced by the `*store.DB` wrapper entirely — plan 04's call). For 03 the requirement
  is: after this edit, `db.go` imports no `go-redis` symbol.
- `api/cmd/app.go:53` — the `"Setup DB"` init task stays but no longer touches Redis
  (plan 04 changes what it sets up).
- `api/pkg/config/config.go` — delete the `Redis struct { URL; Password }` field (lines
  ~15–18) and the `NodeName` field (line 12, with plan 02). Keep `MaxSampleGameDuration`
  (still drives history pruning).
- `api/pkg/config/environment.go` — delete the `SD_NODE_NAME` read block (~lines 40–43,
  with plan 02). There is no `SD_REDIS_*` binding to remove (Redis URL was yaml-only).
  Keep `SD_MAX_SAMPLE_GAME_DURATION` (~lines 55–65).
- `api/go.mod` / `api/go.sum` — remove `github.com/redis/go-redis/v9 v9.17.2` (go.mod
  line 12) via `go mod tidy` after the last import is gone.
- `Makefile` — delete the `deps` target (line ~243, `compose up -d redis`) and the
  `deps-down` target (line ~248, `compose down redis`), plus their `help` lines (~45–46).
  Plan 04 may add a `migrate-*` target set in their place; 03 only removes the Redis ones.
- `api/CLAUDE.md` / root `CLAUDE.md` — drop the Redis-as-store language and the
  Redis-dev-dependency notes that reference `make deps`. (The stale mock-mode lines in
  these files — root `CLAUDE.md` "Set `mock: true`" and `api/CLAUDE.md`
  `service/mock_client` / `Config.Mock` — are deleted by 06 per decision D-D; there is no
  mock mode and no mock poller. 03 only removes the Redis-store wording here.)
- `models/models/data_point.go` and `models/models/satisfactory_event.go` — strip the
  Redis-implementation doc comments (`SatisfactoryEventKey`, member-keying notes); the
  types survive but their comments must not describe a Redis layout (plan 08 owns the
  type-shape decisions; 03 just flags the stale comments).

## How this satisfies the done-criteria

- **No Redis.** Every row of the kill map has a non-Redis home; `redis.go`, the
  `key_value` package, the `go-redis` go.mod line, the compose `redis` service, the
  config `redis:` blocks, and the `make deps`/`deps-down` targets are all deleted. After
  the cut point `grep -rn "go-redis\|redis\.\|key_value\|RedisClient" api/` returns
  nothing.
- **No home-built distributed polling.** The lease/heartbeat objects (#9a/#9b) and the
  tombstone (#7) are deleted outright, not re-homed — single-process ownership makes them
  meaningless (plan 02 executes; 03 records the decision).
- **SQLite for stateful/history/auth/settings/sessions.** Rows #4, #5a, #5b, #6, #8a, #8b
  are assigned to the canonical SQLite tables — `settings`, `auth_password`, `auth_tokens`,
  `sessions`, `history_points` (plan 04 implements; plan 08 maps the schema). Auth
  (#5a/#5b) re-homes its *mechanism* to SQLite but **discards its data** on the cutover
  (decision D-A): the tables start empty and re-bootstrap to `SD_BOOTSTRAP_PASSWORD`.
- **Channels for live data.** Rows #2 and #3 go to the eventbus; row #1 (latest-state) is
  the in-memory tail of that stream (plan 05).
- **GraphQL replaces the read/stream paths.** The ~30 `GetCachedState` resolvers and the
  history reads become GraphQL queries; the event subscribe becomes a GraphQL
  subscription (plan 06). 03 ensures no Redis read/subscribe survives behind them.

## Ordered migration (the cut sequence)

The constraint: **after the defined cut point, nothing in `api/` imports `go-redis`, and
`go build ./...` succeeds without a running Redis.** Get there by re-homing every caller
*first*, then deleting the wrapper + dependency in one final step. Until that final step,
Redis can still be running in dev; the moment the wrapper is deleted, it is gone for good.

1. **Land the new homes (no deletions yet).** Bring in plan 04's `*store.DB` (SQLite +
   sqlc + migrations) and plan 05's eventbus + the poller's in-memory latest-state map.
   These are additive; Redis still runs. This is the prerequisite for every re-home below.

2. **Re-home auth, settings, sessions to SQLite (plan 04).** Rewrite
   `api/service/auth/auth.go`, `api/service/settings/service.go`,
   `api/service/session/store.go` to call `*store.DB`. **Auth carries no data across the
   cut (decision D-A):** `auth_password` / `auth_tokens` start empty and the auth service
   re-bootstraps the password to `SD_BOOTSTRAP_PASSWORD` (`is_default = 1`) on first boot —
   there is no read-from-Redis-then-write-to-SQLite step for auth. Settings-change
   broadcast moves to the in-proc channel and `settings_listener.go` becomes an in-proc
   subscriber (plan 05). After this step those three packages import no `key_value`.

3. **Re-home history to SQLite (plan 04 / 06).** Rewrite the history half of
   `api/service/session/cache.go` (`StoreHistoryPoint`/`GetHistory`/`GetHistorySaves`/
   `PruneOldHistory`/`ClearHistoryData`) onto `history_points`. Convert `history.go`
   reads to GraphQL resolvers (plan 06).

4. **Re-home live state + events (plans 02 / 05 / 06).** Move the `state:*` writes/reads
   to the poller's in-memory `LatestStore` (keyed by `(sessionID, saveName, dataType)`,
   E-11) and its per-domain accessors; convert the ~30 `GetCachedState` consumers to the
   typed per-domain GraphQL snapshot query resolvers (no single `state` query, D-C); move
   `Publish`/`AddListener` to the eventbus + the `<domain>Changed` subscription resolvers;
   delete `events_sse.go`. Centralize the per-`(session, save, dataType)` topic key.

5. **Delete the lease subsystem + tombstone (plan 02).** Remove `api/service/lease/`,
   `nodes.go`, the worker-flag split, `SD_NODE_NAME`, and the `deleted-session` guard.
   This removes the last direct `db.DB.RedisClient` usage (the Lua `EVAL`/`SetNX`/`Scan`).

6. **CUT POINT — delete the Redis wrapper and dependency.** With every caller re-homed,
   delete `api/pkg/db/redis.go`, `api/pkg/db/key_value/`, strip `RedisClient` from
   `db.go`, drop the `Redis` config struct and `redis:` yaml blocks, then `go mod tidy`
   to drop `go-redis`. Verify: `grep -rn "go-redis\|key_value\|RedisClient\|notify-keyspace" api/`
   is empty and `cd api && CGO_ENABLED=0 go build ./...` passes with no Redis reachable.

7. **Remove the Redis ops surface.** Delete the `redis` service + `redis-data` volume
   from `compose.yml`, the `deps`/`deps-down` Makefile targets and their help lines, and
   the stale Redis docs/comments. Confirm `docker compose config` no longer references
   `redis`.

8. **Final guard.** Run `make build` (or `cd api && go build ./...`) with no Redis
   container running, start the binary, and confirm it boots, migrates SQLite, and serves
   GraphQL with no connection-refused on 6379.

## RELEASE / UPGRADE NOTE — auth clean wipe (decision D-A)

Removing Redis removes the auth store with it. **The existing password and access tokens
are NOT migrated** — this is a deliberate, user-approved clean cutover (decision D-A,
closes critic B4), not an accidental break. On first boot against an empty SQLite DB:

- the `auth_password` singleton row re-bootstraps to `SD_BOOTSTRAP_PASSWORD` (default
  `"change-me"`) with `is_default = 1`;
- the `auth_tokens` table is empty, so every client must log in again;
- **the operator MUST re-set their password after upgrade.**

03 is the plan that records *why* the auth Redis data is discarded rather than ported (all
other stateful Redis objects — settings, sessions, history — keep their data in their
SQLite home; auth is the sole intentional exception). Doc 08 carries the same note as the
authoritative release statement, and 01/02/06 surface it in the deployment/upgrade docs.

## Risks

- **Caller-count drift.** The state-cache fan-out is ~30 resolvers across a dozen files;
  missing one leaves a dangling `key_value` import that blocks the cut at step 6. Mitigation:
  step 6 is gated on `grep -rn "key_value" api/` being empty, not on a manual checklist.
- **Silent auth lockout if the wipe is not communicated.** The auth clean wipe (D-A) is
  intentional, but an operator who upgrades without reading the release note will find their
  old password and all sessions rejected and the system back on `SD_BOOTSTRAP_PASSWORD`.
  Mitigation: the release/upgrade note above is mandatory in the deploy docs (01/02/06) and
  the login flow surfaces `usedDefaultPassword` so the UI prompts an immediate reset. This is
  a documentation/UX risk, not a data-integrity bug — the discard is by design.

- **Auth-token TTL regression.** Redis auto-evicted expired tokens; SQLite does not.
  If the lazy `expires_at` check + prune is forgotten, expired tokens validate forever.
  Mitigation: plan 04 must implement both the read-time check and a periodic prune; 03
  flags it as the only TTL that needs porting.
- **Save-name isolation regression.** If the in-memory latest-state map or the
  `history_points` schema drops the `save_name` dimension, the commit `0a12da81` fix
  regresses (cross-save data bleed). Mitigation: `save_name` is a mandatory key segment /
  column in plans 04/05/08.
- **Lost coalescing/back-pressure semantics.** SSE used a 1000-buffered Redis subscription
  + per-connection coalescing-by-event-type. Naively bridging to an unbuffered channel
  changes drop/latency behavior. Mitigation: plan 05 must preserve the buffered-fan-out +
  latest-wins-per-type semantics; 03 records that this is a behavioral contract, not just
  a transport swap.
- **Tombstone race re-emergence.** Deleting the tombstone assumes session delete
  *synchronously* cancels the poll goroutine before returning. If plan 02's delete path is
  async, a stray write-after-delete can occur. Mitigation: plan 02's delete must join the
  cancelled goroutine (or the SQLite FK/`DELETE` ordering must make a late write a no-op).
- **`db.go` ownership overlap with plan 04.** Both 03 (strip Redis) and 04 (add SQLite)
  edit `api/pkg/db/db.go`. Mitigation: 04 owns the final shape; 03's only invariant is
  "no `go-redis` symbol remains." Coordinate so the edits don't clobber.

## Open questions

- Does `db.DB` (the singleton `Context`) survive as the SQLite handle holder, or is it
  replaced wholesale by plan 04's `*store.DB`? (Affects whether step 6 edits `db.go` or
  deletes it.)
- Should the settings-change broadcast remain a channel at all, or collapse to a direct
  synchronous call inside `settings.Update()` now that there is one process and one
  consumer (log-level)? (Plan 05's call; affects whether `settings_listener.go` survives.)
- Is any in-memory tombstone guard wanted as defense-in-depth, or is the synchronous
  poller-cancel guarantee (plan 02) considered sufficient to drop it entirely?
