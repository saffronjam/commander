# Frontend Data Layer — Current State & GraphQL-Native Target Mapping

Research deliverable for the major refactor. Maps how the React dashboard currently fetches
data (REST + SSE) and gives a per-page table so a plan author can rebuild the data layer
GraphQL-native (urql + graphql-codegen client-preset + graphql-ws), with per-route smart fetches.

Scope: read-only investigation of `dashboard/src/`. No code modified.

---

## 1. Current transport mechanism

There is NO HTTP/GraphQL client library in `dashboard/package.json`. All networking is hand-rolled:

- **REST** = bare `fetch()` calls, every service uses `credentials: 'include'` (HTTP-only auth cookie).
- **Live stream** = native browser `EventSource` (SSE), one connection per selected session.
- **Polling** = `setInterval` in two places (session status list every 20s; a 2s re-render snapshot tick in `ApiProvider`).
- `package.json` has zero `graphql`, `urql`, `graphql-ws`, `@apollo`, `@tanstack/query`, or `axios` deps. Adding these is greenfield.

Base URL comes from `src/config.ts` -> `config.apiUrl` (default `http://localhost:8081/v1`), resolved at runtime via `window.__RUNTIME_CONFIG__` or build-time `VITE_API_URL`. The GraphQL refactor needs a single `/graphql` (HTTP) + `/graphql` (ws upgrade) endpoint to replace this `/v1` REST prefix.

---

## 2. Provider tree (where data context lives)

`dashboard/src/main.tsx` mounts (outer -> inner):
```
ThemeProvider/HelmetProvider/Router (app.tsx)
  AuthProvider              (contexts/auth/AuthContext.tsx)
    DebugProvider           (contexts/debug/DebugContext.tsx)
      SessionProvider       (contexts/sessions/SessionProvider.tsx)
        SessionAwareApiProvider  (contexts/api/SessionAwareApiProvider.tsx)
          App routes
```
`ConnectionCheckerProvider` is rendered inside `app.tsx` (line 54); it only reads `isOnline` from `ApiContext` and fires toast notifications. It is a pure consumer, no fetching.

In the target, a single urql `<Provider>` (with the graphql-ws subscription exchange wired in) wraps the app, replacing `SessionAwareApiProvider` + `ApiProvider`. `AuthProvider`, `SessionProvider`, `DebugProvider` survive as thin state holders but their data ops become GraphQL queries/mutations/subscriptions.

---

## 3. REST clients (services/) — full inventory

All five live in `dashboard/src/services/`. Each has its own `handleResponse<T>` that dispatches `auth:expired` (a `window` CustomEvent) on HTTP 401. That 401->event bridge (`dispatchAuthExpired` in `AuthContext.tsx`) is the central auth-expiry signal and must be reproduced via an urql error/auth exchange.

| Service file | Functions | REST endpoints hit | Target GraphQL op |
| --- | --- | --- | --- |
| `authApi.ts` | `login`, `getStatus`, `changePassword`, `logout` | `POST /auth/login`, `GET /auth/status`, `POST /auth/change-password`, `POST /auth/logout` | mutations `login`/`changePassword`/`logout`; query `authStatus` |
| `sessionApi.ts` | `list`, `get`, `create`, `delete`, `update`, `validate`, `preview`, `getClientIP` | `GET/POST /sessions`, `GET/PATCH/DELETE /sessions/:id`, `GET /sessions/:id/validate`, `GET /sessions/preview`, `GET /client-ip` | queries `sessions`/`session`/`sessionPreview`/`clientIp`; mutations `createSession`/`updateSession`/`deleteSession`/`validateSession` |
| `settingsApi.ts` | `get`, `update` | `GET /settings`, `PUT /settings` (global, server-side `Settings`) | query `settings`; mutation `updateSettings` |
| `historyApi.ts` | `fetchHistory`, `listSaves` | `GET /sessions/:id/history/:dataType?saveName&since&limit`, `GET /sessions/:id/history` | query `history(sessionId,dataType,saveName,since,limit)` returning a `HistoryChunk`; query `historySaves` |
| `nodesApi.ts` | `getNodes` | `GET /nodes` | **DELETE** — lease/node info dies with distributed polling (refactor goal #2). Drop endpoint, query, and `debug-nodes` page. |

Note two distinct "settings": server-global `Settings` via `settingsApi` (log level, etc.) AND a *client-local* `Settings` (`hooks/use-settings.ts`) stored in `localStorage` (`apiUrl`, `productionView`, `historyDataRange`, `historyWindowSize`). The local one is NOT a network concern; keep it in localStorage (or move to SQLite-backed user settings if the plan wants it server-side — open question).

---

## 4. The live-data SSE layer — `ApiProvider.tsx` (the core to replace)

`contexts/api/ApiProvider.tsx` is the heart of live data. It is keyed by `${session.id}:${sessionName}` in `SessionAwareApiProvider` so a save-name change force-remounts it (clears + refetches). Flow:

1. On mount with a `sessionId`, opens `EventSource(${API_URL}/sessions/:id/events, {withCredentials})`.
2. Does an initial REST snapshot `GET /sessions/:id/state` (full `State` object) to seed all fields — but only if `sessionStage === 'ready'`. Stage transition `init -> ready` triggers a deferred fetch.
3. Subscribes to the single SSE event name `satisfactory_events` (`API.SatisfactoryEventKey`); each message has `{ type, data }` where `type` is one of ~30 `SatisfactoryEvent*` constants (`apiTypes.ts` lines 660-685). A big `switch` writes each payload into a mutable `dataRef`.
4. A `setInterval(..., 2000)` snapshots `dataRef` into React state — the 2s throttle that drives re-renders. This is a homegrown batching mechanism urql subscriptions replace.
5. `satisfactoryApiCheck` event toggles `isOnline`; offline -> immediate flush; online-after-offline -> re-fetch full state. This is the "offline event" the eventbus plan (05) must surface as a subscription field/event.
6. `sessionUpdate` event is forwarded to `SessionProvider.updateSessionFromEvent` (session metadata pushed over the same SSE channel).

The context shape is `ApiData` (`contexts/api/useApi.ts`): `isLoading`, `isOnline`, `satisfactoryApiStatus`, plus 30 live data arrays/objects (circuits, factoryStats, prodStats, sinkStats, players, generatorStats, machines, trains, trainStations, drones, droneStations, trucks, truckStations, belts, pipes, pipeJunctions, trainRails, splitterMergers, hypertubes, hypertubeEntrances, cables, storages, tractors, explorers, vehiclePaths, spaceElevator, hub, radarTowers, resourceNodes, schematics).

Consumers read via `use-context-selector`'s `useContextSelector(ApiContext, v => ...)` so each component subscribes only to the slices it needs — this selective-subscription pattern is exactly what per-page GraphQL subscriptions/queries replace: instead of one fat context with 30 fields, each route subscribes to only the fields it renders.

**SSE event -> data-field mapping** (drives subscription design): each `SatisfactoryEvent*` is a separate live stream. Some events bundle multiple fields (`vehicles` -> trains+drones+trucks+tractors+explorers; `vehicleStations` -> 3 station types; `belts` -> belts+splitterMergers; `pipes` -> pipes+pipeJunctions; `hypertubes` -> hypertubes+hypertubeEntrances). The GraphQL subscription schema can either mirror these bundles or split per-field; bundling matches the existing poller's natural grouping.

---

## 5. History layer — `useHistoryData.ts` (hybrid REST + SSE trigger)

`hooks/useHistoryData.ts` is the only true time-series consumer. Pattern:
- Initial `historyApi.fetchHistory({sessionId, dataType, saveName})` -> `HistoryChunk { latestId, points: DataPoint[] }`.
- Then it watches the relevant live `ApiContext` slice (via `useContextSelector` on the matching field); every time that live value changes (i.e. an SSE tick), it fires an **incremental** `fetchHistory({since: latestId})` and merges new points. So history "live append" is currently driven by piggy-backing on the SSE live updates, not a dedicated history stream.
- Client-side downsampling (`downsampleDataPoints`, bucket by `gameTimeId / windowSize`) and pruning by `historyDataRange` happen in the hook.
- `dataType` is one of `'circuits' | 'generatorStats' | 'prodStats' | 'factoryStats' | 'sinkStats'` (`HistoryDataType`). These 5 are the only types with history storage.
- `DataPoint` = `{ gameTimeId, dataType, data: any }`; `HistoryChunk` = `{ dataType, saveName, latestId, points }` (`apiTypes.ts` 128-321).

Target: a `history` query for the initial chunk + a history subscription (or reuse the live subscription's `gameTimeId` to drive incremental `history` query refetches). The cleanest GraphQL-native form: subscription emits new history `DataPoint`s as the poller writes them to SQLite, so the hook stops polling-on-SSE-tick entirely. The downsampling/pruning can stay client-side or move into a query argument (`windowSize`) — open question.

---

## 6. Auth & session flow

**Auth** (`contexts/auth/AuthContext.tsx`):
- On mount, `checkAuthStatus()` -> `authApi.getStatus()` (`GET /auth/status`, cookie-based).
- `login(password)` -> `authApi.login` sets HTTP-only cookie server-side.
- Central 401 handling: every service calls `dispatchAuthExpired()` on 401 -> `window` CustomEvent `auth:expired` -> `AuthProvider` sets `sessionExpired` + clears auth. **This is the single auth-expiry choke point** to reproduce in an urql `mapExchange`/`authExchange`.
- `usedDefaultPassword` flag drives a "change your password" nudge.

**IMPORTANT auth-model divergence from the reference repo:** current dashboard uses **HTTP-only cookies** (`credentials: 'include'`) with no token visible to JS. The reference `saffron-hive` uses **Bearer tokens in JS-readable storage** + an `X-Refreshed-Token` sliding-refresh header + `graphql-ws` `connectionParams: { authToken }`. graphql-ws subscriptions cannot send custom headers from the browser, so the reference passes the token via `connectionParams`. With cookie auth, the ws handshake carries the cookie automatically (same-origin), which is actually simpler — but only works if the GraphQL ws endpoint is same-origin (it will be, once deployment is consolidated into one container, plan 01). **Plan authors must pick: keep cookie auth (works once single-origin) or switch to the reference's Bearer-token model.** This is the biggest frontend auth decision. (Flag for 99-open-questions.)

**Sessions** (`contexts/sessions/SessionProvider.tsx`):
- `refreshSessions()` -> `sessionApi.list()` on mount; auto-selects first session; persists `selectedSessionId` in `localStorage` (`satisfactory-dashboard-selected-session`).
- Polls `sessionApi.list()` every 20s (`refreshSessionStatuses`) to update `isOnline`/`sessionName`/`stage` — replace with a `sessions` subscription or rely on the `sessionUpdate` event already coming over the live stream.
- `updateSessionFromEvent` receives session metadata pushed over the SSE `sessionUpdate` event (see §4.6).
- All CRUD (`create`/`update`/`delete`/`preview`) -> sessionApi -> mutations.

**Debug** (`contexts/debug/DebugContext.tsx`): pure `localStorage` toggle (`satisfactory-dashboard-debug-mode`), no network. Gates the debug pages. No GraphQL impact.

---

## 7. Per-page data needs (the smart-fetch table)

Pages (`pages/*.tsx`) are thin Helmet wrappers delegating to a `sections/<feature>/view/<feature>-view.tsx`. The view is where data is consumed. Routes from nav/router (see `layouts/dashboard/`).

| Route | View file | Live (subscription) | Snapshot (query) | Historical (query/sub) | Other |
| --- | --- | --- | --- | --- | --- |
| `/` (home) | overview-analytics-view.tsx | circuits, prodStats, sinkStats, generatorStats, factoryStats, spaceElevator, hub, isLoading, isOnline | — | history: circuits, prodStats, sinkStats (via `useHistoryData`, driven by `selectedSession`+local settings) | uses `useSession`, local `useSettings` |
| `/power` | power-view.tsx | circuits | — | — | minimal; only `v.circuits` |
| `/production` | production-view.tsx | prodStats, isLoading, isOnline | — | history: prodStats | `useSession`, local `useSettings` (incl. `saveSettings`) |
| `/trains` | trains-view.tsx | trains, trainStations, isLoading, isOnline | — | — | local status-filter state |
| `/drones` | drones-view.tsx | drones, droneStations, isLoading, isOnline | — | — | `useUnlockables` (reads `schematics`); locked-feature gate |
| `/players` | players-view.tsx | players | — | — | — |
| `/map` | map-view.tsx | factoryStats, generatorStats, machines, trainStations, droneStations, truckStations, trains, drones, trucks, tractors, explorers, vehiclePaths, players, belts, pipes, pipeJunctions, trainRails, splitterMergers, cables, storages, spaceElevator, hub, radarTowers, resourceNodes, hypertubes, hypertubeEntrances, isLoading, isOnline | — | — | **heaviest consumer** — nearly the entire live state. Subscribes to ~26 fields. Map mostly needs static-ish infra (belts/pipes/rails/cables) once + moving vehicles live. Good candidate for splitting "infra snapshot query" vs "vehicle-position subscription". |
| `/milestones` | milestones-view.tsx | schematics, hub, isLoading | — | — | — |
| `/settings` | settings-view.tsx | — | server `settingsApi.get` (log level) | — | mutations: `settingsApi.update`, `authApi.changePassword`; also local `useSettings` for client prefs |
| `/debug` | debug-view.tsx | EVERY live field (full `ApiData` dump) + satisfactoryApiStatus | — | — | `useSession`; diagnostic view |
| `/debug/nodes` | debug-nodes-view.tsx | — | `nodesApi.getNodes` (lease ownership) | — | **DELETE with distributed polling removal** |
| `/login` | login-view.tsx | — | — | — | `useAuth().login` mutation only |

`useUnlockables` (`hooks/use-unlockables.ts`) reads `schematics` from the live context and is consumed by nav/route guards (trains, drones). In GraphQL terms, `schematics` is a live subscription field that several routes + the sidebar depend on; consider a small shared `schematics` subscription/query at the layout level.

### Per-page fetch strategy implications
- Most pages need 1-4 live fields -> small per-page `subscription` documents (codegen client-preset `graphql()` tagged docs colocated in each view).
- `/map` and `/debug` are the fat consumers. `/map` is the prime candidate for the live-vs-snapshot split: query the geometry/infrastructure (belts, pipes, rails, cables, splitterMergers, resourceNodes, stations, hub, spaceElevator, radarTowers) once as a snapshot, and subscribe only to fast-moving vehicle positions + stats. `/debug` can keep one fat subscription (diagnostic only).
- History (`/`, `/production`) -> initial `history` query + incremental, ideally a history subscription so the SSE-tick-driven refetch in `useHistoryData` disappears.
- `schematics` (milestones, drones, trains gating, sidebar) -> shared subscription.

---

## 8. apiTypes.ts (tygo-generated) and codegen replacement

`dashboard/src/apiTypes.ts` is generated by `tygo` from Go structs (per CLAUDE.md `make generate`). It is consumed everywhere via `import * as API from 'src/apiTypes'` or named imports. It contains:
- All domain types (Circuit, Drone, Train, Player, FactoryStats, etc.).
- SSE event constant strings (`SatisfactoryEvent*`, lines 659-685) and `SseSatisfactoryEvent`.
- History types (`DataPoint` 131, `HistoryChunk` 316).
- Session/auth DTOs (`SessionDTO`, `SessionStage*`, `LoginRequest`, etc.).

In the target, `@graphql-codegen/client-preset` generates types from the GraphQL schema, **replacing tygo for frontend types** (plan 08 owns the model->type mapping). The SSE event constants disappear (replaced by typed subscription documents). `src/types.ts` (map `SelectableEntity`, client `Settings`, `HistoryDataRange`/`HistoryWindowSize` presets) is hand-written client-side types and largely survives, though it imports domain types from `apiTypes` that will come from codegen instead.

---

## 9. Concrete removal/replacement checklist for the plan author

Delete outright:
- `contexts/api/ApiProvider.tsx` (EventSource + dataRef + 2s interval).
- `contexts/api/SessionAwareApiProvider.tsx` (remount-on-key hack — urql cache + variables handle session switching).
- `contexts/api/useApi.ts` `ApiContext`/`ApiData` fat context.
- `services/nodesApi.ts` + `/debug/nodes` page + `debug-nodes-view.tsx` (distributed-polling artifact).
- All `services/*.ts` `fetch` wrappers (replaced by urql).
- The `setInterval` poll in `SessionProvider` and the 2s snapshot tick.

Rewire (keep the component, swap the data source):
- `AuthProvider`: keep state machine; move `getStatus`/`login`/`logout`/`changePassword` to urql; reproduce the `auth:expired` 401 choke point in an urql exchange.
- `SessionProvider`: keep selection/localStorage; move CRUD + status to urql query/mutation/subscription.
- `useHistoryData`: rebuild on `history` query + (ideally) history subscription; drop SSE-tick-driven refetch.
- `ConnectionCheckerProvider` / `useUnlockables`: re-point from `ApiContext` to subscription-backed hooks (`isOnline`, `schematics`).

Reference patterns to copy (from `saffron-hive`):
- `web/codegen.ts` — `client` preset, `documents` glob, `useTypeImports`. (React equivalent: same `@graphql-codegen/client-preset`, output consumed by `@urql/exchange-graphcache`-free `urql` React bindings.)
- `web/src/lib/graphql/client.ts` — urql `Client` with `fetchExchange` + `subscriptionExchange` bridged to `graphql-ws createClient`, plus a `mapExchange` that handles 401/`UNAUTHENTICATED` -> redirect to login. Translate `@urql/svelte` -> `urql` (React) and `goto('/login')` -> `react-router` navigate.

---

## 10. Open questions (for 99-open-questions.md)

1. **Auth transport for ws**: keep HTTP-only cookie (works once single-origin per plan 01) or adopt the reference's Bearer-token + `connectionParams` + `X-Refreshed-Token` sliding refresh? Cookie is simpler post-consolidation but the reference repo we are told to emulate uses Bearer.
2. **History live-append**: dedicated history subscription, or keep the "live tick triggers history query" pattern (just over GraphQL)? Reference doesn't have an exact analog.
3. **Downsampling/pruning** (`downsampleDataPoints`, `historyDataRange`): stay client-side, or push `windowSize`/`since` as query args so SQLite does it?
4. **Client-local `Settings`** (`use-settings.ts`, localStorage: productionView/historyDataRange/windowSize): keep in localStorage or move to SQLite-backed per-user settings (refactor goal says user/settings in SQLite — but these are view prefs, ambiguous)?
5. **Map live-vs-snapshot split**: is infrastructure (belts/pipes/rails) truly static per save, allowing a one-shot query, or does it change mid-session enough to need a subscription?
6. **Subscription field granularity**: mirror the existing bundled SSE events (vehicles, vehicleStations, belts, pipes, hypertubes group multiple fields) or split per-field? Bundling matches the poller; per-field matches per-page smart fetch.
7. **Session selection without remount**: current code force-remounts `ApiProvider` on session/save change to clear state. With urql, switching `sessionId` subscription variables should reset cleanly — confirm cache eviction behavior on save-name change.
