# 99 — Open Questions, Gaps & Contradictions (critic's review — RESOLVED)

> This was the adversarial completeness + consistency review of plans `00`–`08`. The 9
> cross-document contradictions (C1–C9) and the 12 user decisions (D1–D12) it surfaced have now
> been **LOCKED** by the user and applied across the plan set. This rewrite records, for each
> item, the resolution and the directive that carries it (`DECISIONS.md`, `D-A…D-D` /
> `E-1…E-11`). The plan set is now **internally consistent and executable**.
>
> Read `DECISIONS.md` for the full rationale of every directive. A short list of genuinely
> still-open minor items is kept at the end.

---

## A. Coverage matrix — the explicit "done when" criteria (post-resolution)

| # | "Done when" | Covered? | Where / status |
|---|---|---|---|
| DW1 | **No Redis** (db/stream) | **Yes** | 03 kill-map routes every Redis object to bus/SQLite/memory/deleted; 01 drops the container; 04 SQLite homes; 05 channel homes. Gate is a `grep` (00 D1). |
| DW2 | **No REST** | **Yes** | 06 maps every one of the ~39 routes to a GraphQL op; 07 deletes all `services/*Api.ts`. **Gin is removed entirely** [E-1]; only `/healthz` + `/internal/metrics` remain (00 D2). |
| DW3 | **No WSS / no SSE / no home-rolled socket** | **Yes (clarified)** | 05 deletes `events_sse.go` + `CoalescingQueue`; 06 uses gqlgen `transport.Websocket` (graphql-ws). **Confirmed scope:** "No WSS" means no *home-rolled* stream — graphql-ws is the sanctioned transport (an unavoidable WS upgrade), and 00 D3 states this caveat explicitly. |
| DW4 | **No home-built distributed polling** | **Yes** | 02 deletes `service/lease/`, worker-flag split, `SD_NODE_NAME`, `/v1/nodes`. Single in-process poller justified at ~10 sessions [D-B]. |
| DW5 | **sqlc + migration files are used** | **Yes** | 04 ships `sqlc.yaml`, numbered `00N_*.{up,down}.sql`, iofs + `migrate.NewWithInstance`, `migration_test.go`; tables `sessions`/`settings`/`auth_password`/`auth_tokens`/`history_points` [E-6/E-7]. |
| DW6 | **GraphQL replaces polling — history** | **Yes (executable)** | The C1/C2/C9 design conflict is **resolved** [E-6/D-C]: table is `history_points`; the wire is five typed `<domain>History` queries returning `[<Type>HistoryPoint!]!` — no `HistoryChunk`, no opaque `data`. 04/06/07/08 now agree. |
| DW7 | **GraphQL replaces polling — live** | **Yes (executable)** | The C3 subscription-shape conflict is **resolved** [D-C]: per-domain typed `<domain>Changed` subscriptions (plus `connectivityChanged`/`sessionUpdated`), no sparse `liveState`. 05/06/08 use one anchor set; 07 references the actual fields. |
| DW8 | **UI fetching is GraphQL-native** | **Yes** | 07 urql + client-preset + graphql-ws; tygo/`apiTypes.ts` deleted (08, [E-8]). The schema path/shape is settled (C1–C4 resolved), so codegen has a stable contract. |
| DW9 | **One container** | **Yes** | 01 single multi-stage `Dockerfile`, `go:embed` SPA, stdlib `FileServer` assets, one compose service, one CI job. |
| DW10 | **Single same-origin** | **Yes (no CORS leak)** | The C6 leak is **resolved** [E-4]: 01 drops CORS/runtime-config; the only origin check is the WS `Upgrader.CheckOrigin` sourced from `config.ExternalURL` (not a non-existent `AllowedOrigins`); WS auth is same-origin cookie-only [E-3]. |

**Net:** every criterion is addressed AND the contracts it rides on are now stated consistently.
The plan is directionally complete **and** executable as written.

---

## B. The contradictions (C1–C9) — all RESOLVED

- **C1 — History TABLE name + shape.** Old: `history_points` (04) vs `history_samples` (08).
  **RESOLVED [E-6]:** the table is **`history_points`**, composite PK
  `(session_id, save_name, data_type, game_time_id)`, JSON `data TEXT`, **no** surrogate `id`,
  **no** `recorded_at`. Queries `UpsertHistoryPoint` / `QueryHistoryRaw` / `QueryHistoryBucketed`
  (keep-last). 08's SQLite schema now matches 04's executable SQL.

- **C2 — History QUERY/GraphQL shape.** Old: single `history → HistoryChunk` (04/06/07) vs five
  per-type queries (08). **RESOLVED [D-C]:** **five typed per-type queries** —
  `circuitsHistory`, `factoryStatsHistory`, `prodStatsHistory`, `generatorStatsHistory`,
  `sinkStatsHistory` — each returning `[<Type>HistoryPoint!]!`, plus `historySaves`. No
  `HistoryChunk`, no opaque `data` field. 06 SDL, 07 documents, and 08 catalog all conform.

- **C3 — Live SUBSCRIPTION shape.** Old: one `liveState` sparse object (06) vs per-type fields
  (08) vs page-named subs (07). **RESOLVED [D-C]:** **per-domain typed `<domain>Changed`
  subscriptions** (the anchor set is enumerated in 08's Subscription block, derived from the SSE
  inventory), plus `connectivityChanged(sessionId): ConnectivityStatus!` and
  `sessionUpdated: Session!`. No sparse `liveState`. 07's per-page documents reference the actual
  `<domain>Changed` fields.

- **C4 — `Int64` scalar.** Old: declared+used (06) vs forbidden (08). **RESOLVED [E-2]:** keep
  built-in **`Int`** for `gameTimeId`/`shipReturnTime`/`since`; the `Int64` scalar is **deleted**
  from 06's SDL and `gqlgen.yml`. Game-time seconds stay < 2^53 for decades.

- **C5 — Router framework.** Old: Gin retained (01/02) vs stdlib mux (00/06). **RESOLVED [E-1]:**
  **stdlib `net/http` ServeMux + the gqlgen handler; Gin removed entirely.** 01's `RegisterStatic`
  is a stdlib `http.Handler` (`FileServer` over embedded `dist` + mounted assets + `index.html`
  SPA fallback, registered last); 02's `app.go` builds an `*http.Server` (no `gin.SetMode`);
  `GIN_MODE` is dropped from the Dockerfile. (Also resolves B10.)

- **C6 — CORS / allowed-origins.** Old: deleted (01/07) vs still referenced via `AllowedOrigins`
  (06). **RESOLVED [E-4]:** CORS removed entirely (same-origin). The only origin check is the WS
  `Upgrader.CheckOrigin`, validated against `config.ExternalURL` — **not** a non-existent
  `AllowedOrigins` field. 01 deletes all CORS machinery; 06 sources `CheckOrigin` from `ExternalURL`.

- **C7 — sqlc override TYPES.** Old: leaf packages (04) vs `models.SessionID` /
  `models.SatisfactoryEventType` (08). **RESOLVED [E-5]:** override only
  `sessions.id`/`history_points.session_id` → `internal/session.ID` and `auth_tokens.token` →
  `internal/auth.Token` (dependency-free leaf-package string aliases). `data_type` is **NOT**
  overridden — it stays `TEXT` and is mapped to the GraphQL `HistoryDataType` enum in the
  resolver. 08's `models.*` override table is dropped. (Avoids the import cycle, R17.)

- **C8 — Auth table name/columns.** Old: `auth_password`/`is_default` (04) vs
  `auth_credentials`/`used_default` (08); plus the token-column superset issue (B5).
  **RESOLVED [E-7]:** **`auth_password`** (single row: `hash`, `is_default`, `updated_at`) +
  **`auth_tokens`** (`token` PK, `created_at`, `last_used`, `expires_at`, `client_ip` — the
  superset the queries need). The `auth_credentials`/`used_default` naming and the minimal-token
  variant are dropped.

- **C9 — History point field naming.** Old: three slightly different `HistoryChunk`/`HistoryPoint`
  shapes. **RESOLVED [D-C]:** there is no `HistoryChunk`/`HistoryPoint`/interface/union; each
  `<Type>HistoryPoint = { gameTimeId: Int!, <typed domain fields> }` is standalone and concrete.
  `historySaves(sessionId: ID!): [String!]!` returns plain save names.

---

## C. The user decisions (D1–D12 from the original review) — all LOCKED

Each maps to a directive in `DECISIONS.md`.

| # | Original decision | Locked outcome | Directive |
|---|---|---|---|
| D1 | Drop existing data — auth specifically | **CLEAN WIPE**: re-bootstrap to `SD_BOOTSTRAP_PASSWORD`, `is_default=1`; documented upgrade note; operator re-sets password. | **D-A** |
| D2 | urql vs Apollo + document cache | **urql** + `@graphql-codegen/client-preset` + `graphql-ws`, document cache; views `reexecuteQuery` after mutations. | (07, unchanged) |
| D3 | WS auth mechanism | **Same-origin cookie only**, read off the upgrade `http.Request`; no `connectionParams`. | **E-3** |
| D4 | History API shape | **Five fully-typed per-type queries**; no opaque `data` on the wire. | **D-C** |
| D5 | Live subscription shape | **Per-domain typed `<domain>Changed` subscriptions**; no sparse `liveState`. | **D-C** |
| D6 | `Int64` scalar | **Keep built-in `Int`**; delete the scalar. | **E-2** |
| D7 | Router framework | **Stdlib `net/http` mux**; Gin removed. | **E-1** |
| D8 | Mock mode | **Dropped**; stale `CLAUDE.md`/`api/CLAUDE.md` references deleted; no mock poller built. | **D-D** |
| D9 | History live-append mechanism | **No `historyAppended` subscription**; live points ride `<domain>Changed`; reconnect re-runs `<domain>History(since=…)` + re-snapshots. | **E-9** |
| D10 | Test / e2e gate | Keep Go unit tests + add a **minimal e2e smoke** (query+mutation+subscription) + CI migration up/down; manual two-session run remains the functional gate. | **E-10** |
| D11 | Single `generate` recipe + ordering | **One `make generate`, owned by 08**: gqlgen → sqlc → bun codegen. | **E-8** |
| D12 | Capacity envelope | **Up to ~10 concurrent sessions**; single in-process poller justified; sharding out of scope. | **D-B** |

---

## D. Gaps (B1–B13) — disposition

Resolved by the directives above:

- **B1 (mock mode)** → **D-D**: dropped; stale references deleted.
- **B2 (`make generate`)** → **E-8**: one owner (08), fixed ordering.
- **B3 (WS auth)** → **E-3**: cookie-only on the upgrade request.
- **B4 (auth data drop)** → **D-A**: explicit, user-approved clean wipe + release note.
- **B5 (token columns)** → **E-7**: `auth_tokens` superset (`last_used`, `client_ip`).
- **B6 (single-poller load)** → **D-B**: ~10-session capacity envelope (08).
- **B7 (reconnect/replay)** → **E-9**: reconnect re-runs `<domain>History(since=…)` + re-snapshots.
- **B8 (tests)** → **E-10**: Go unit tests + minimal e2e smoke + CI migration check.
- **B10 (SPA fallback host)** → **E-1**: stdlib SPA fallback handler, registered last.

---

## E. Residual open items (genuinely still minor / verify-before-execute)

These do not block the contract; they are low-effort checks or one-line operator notes the
implementing plans should resolve during execution.

- **B9 — Asset-path verify (now ORAS, decision E-12).** The ORAS seeder
  (`deploy/seed-assets.sh`) extracts the tarballs into
  `/assets/images/satisfactory/map/1763022054/{realistic,game}` (and `scraped-images` via
  `--strip-components=1`) — the same layout as the old asset-server Dockerfile. Verify it
  against the SPA's actual request paths before execution — a single path-segment mismatch
  silently 404s all tiles. Low effort.

- **B11 — `SD_MAX_SAMPLE_GAME_DURATION` reseed footgun.** 04 seeds the retention setting from
  the env **only if** the stored value is still its default `0`; after first boot the row is
  authoritative and env changes are ignored. Document this one-way-seed behavior (and R13: a
  paused/offline poller stalls game-time pruning) in the operator/upgrade notes. Behavior note,
  not a contract change.

- **B12 — Existing-feature regression spot-checks** (mostly implicit, call out during 07):
  - **004 (map):** confirm map tile/overlay selection state (localStorage) survives the provider
    rewrite — the `/map` route is the heaviest migration.
  - **005 (unlockables):** `use-unlockables.ts` must read schematics from a source populated by
    the **snapshot query** before the first `schematicsChanged` tick (fail-open preserved), not
    only from the subscription.

- **B13 — Login rate-limiter wiring.** Confirm the in-memory per-IP rate limiter
  (`rate_limiter.go`, kept per 03) is actually wired to the `login` resolver path, keyed on the
  `clientIp` context. With same-origin + no CORS [E-4], the IP comes from the request context;
  the `auth_tokens.client_ip` column [E-7] gives the resolver its rate-limit context.

---

## F. Summary verdict (post-resolution)

The plan set was thorough and directionally sound; it is now also **internally consistent and
executable**. The "authoritative mapping" doc (08) has been re-aligned so it agrees with 04
(store) and 06 (schema) on the history table (`history_points`, [E-6]), the typed per-type
history queries and per-domain subscriptions ([D-C]), the `Int` scalar ([E-2]), the auth tables
([E-7]), and the leaf-package sqlc overrides ([E-5]). Gin is removed in favor of stdlib mux
across 00/01/02/06 ([E-1]). The two foundational assumptions the original review flagged are
settled: mock mode is dropped ([D-D]) and the auth clean wipe is an explicit, documented,
user-approved cutover ([D-A]). All C1–C9 and D1–D12 are closed; only the four minor residual
items in Section E remain, none of which block execution.
