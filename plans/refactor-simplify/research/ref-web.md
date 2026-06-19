# Reference: saffron-hive Frontend GraphQL Client Pattern (and React/urql translation)

Scope: how saffron-hive's SvelteKit web app talks to its gqlgen GraphQL server via
urql + graphql-codegen client-preset + graphql-ws, including auth on HTTP and WS,
typed-document usage, and per-route fetch strategy. Then the React 18 + shadcn + Vite
+ Bun translation for `dashboard/`.

All reference paths are under `/Users/emikar/repos/saffron-hive/web/`.

---

## 1. codegen config (client-preset)

File: `codegen.ts`

```ts
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../api/schema.graphql",
  documents: ["src/**/*.{svelte,ts}", "e2e/**/*.ts"],
  generates: {
    "src/lib/gql/": {
      preset: "client",
      config: { useTypeImports: true },
    },
  },
};
export default config;
```

Key points:
- Single `client` preset output into one directory `src/lib/gql/`.
- `schema` points at the SDL the gqlgen server emits (`../api/schema.graphql`). The
  GraphQL server is the source of truth for the SDL; codegen consumes it.
- `documents` globs all source files; inline `graphql(\`...\`)` template-literal
  operations are scraped out of `.svelte`/`.ts` and `e2e/*.ts`.
- Run via `npm run codegen` -> `graphql-codegen --config codegen.ts`. AGENTS.md notes
  it is wired as `make codegen` and the output is generated, never hand-edited.

The preset produces 4 files in `src/lib/gql/`:
- `gql.ts` — the `graphql()` function and a `Documents` map from query-string ->
  `TypedDocumentNode`. (`index.ts` re-exports `gql` + `fragment-masking`.)
- `graphql.ts` — all generated TS types (`Scalars`, input types, enums, operation
  result/variables types, and exported `...Document` typed nodes).
- `fragment-masking.ts` — `FragmentType<>` + `useFragment()` helpers.
- `index.ts` — `export * from "./fragment-masking"; export * from "./gql";`.

Scalar typing (from `graphql.ts`): `DateTime` is mapped to `any` (no custom scalar
config). For our refactor we should consider a `scalars` mapping (e.g.
`DateTime: string`) in codegen `config` to avoid `any` on time fields used heavily by
history charts.

---

## 2. urql client + exchanges + graphql-ws wiring

File: `src/lib/graphql/client.ts` (the single load-bearing file for the whole pattern).

```ts
import { Client, fetchExchange, mapExchange, subscriptionExchange } from "@urql/svelte";
import { createClient as createWSClient } from "graphql-ws";

function getWSUrl(httpUrl: string): string {
  const url = new URL(httpUrl, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

async function authenticatedFetch(input, init?) {
  const headers = new Headers(init?.headers);
  const token = auth.token;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  const refreshed = response.headers.get("X-Refreshed-Token");
  if (refreshed) auth.setToken(refreshed);     // sliding-session token rotation
  if (response.status === 401) { auth.clearToken(); /* redirect /login */ }
  return response;
}

export function createGraphQLClient(endpoint = "/graphql"): Client {
  const wsClient = createWSClient({
    url: getWSUrl(endpoint),
    connectionParams: () => {
      const token = auth.token;
      return token ? { authToken: token } : {};
    },
  });

  return new Client({
    url: endpoint,
    fetch: authenticatedFetch as typeof fetch,
    exchanges: [
      mapExchange({ onError(error) { /* clear token + redirect on UNAUTHENTICATED/401 */ } }),
      fetchExchange,
      subscriptionExchange({
        forwardSubscription(request) {
          const input = { ...request, query: request.query || "" };
          return { subscribe(sink) { return { unsubscribe: wsClient.subscribe(input, sink) }; } };
        },
      }),
    ],
  });
}
```

Critical design facts to carry over:
- ONE `Client` per app, created once at the root, injected through context. AGENTS.md:
  "Only call `createGraphQLClient()` from `routes/+layout.svelte`. Every other file
  uses `getContextClient()`."
- Exchange order: `mapExchange` (error side-effects) -> `fetchExchange` (HTTP
  queries/mutations) -> `subscriptionExchange` (routes subscription operations to the
  WS client). NOTE: this client uses the DEFAULT urql exchanges only implicitly — it
  does NOT add `cacheExchange` explicitly, so it relies on urql's document cache being
  part of the default set ONLY if defaults are spread. Here `exchanges` is fully
  explicit and OMITS `cacheExchange`/`dedupExchange` — meaning this app runs
  effectively cache-light and re-fetches on each query. For our refactor we should
  decide explicitly whether to add `cacheExchange` (document cache) — see open
  questions.
- Same `/graphql` endpoint for HTTP and WS; WS URL is derived by swapping
  `http->ws`/`https->wss`.

### Auth on HTTP vs WS
- HTTP: per-request `Authorization: Bearer <token>` via a custom `fetch` wrapper.
- WS: `graphql-ws` `connectionParams` callback returns `{ authToken }` — sent in the
  `connection_init` payload, evaluated lazily per (re)connect so token rotation is
  picked up on reconnect.
- Sliding sessions: server returns `X-Refreshed-Token` response header; the fetch
  wrapper hot-swaps the stored token. 401 / `extensions.code === "UNAUTHENTICATED"`
  both clear the token and redirect to `/login`.

### Auth store
File: `src/lib/stores/auth.svelte.ts`. Token kept in `localStorage` (`hive.token`),
JWT decoded client-side (`jwt-decode`) for a synchronous `isAuthenticated()` expiry
check used by the layout gate BEFORE any GraphQL call. `setToken`/`clearToken` mutate
both the in-memory state and localStorage.

---

## 3. Typed-document usage pattern

Operations are authored INLINE with the generated `graphql()` tag, never as separate
`.graphql` files:

```ts
import { graphql } from "$lib/gql";

const ROOMS_QUERY = graphql(`
  query Rooms { rooms { id name icon members { id memberType ... } } }
`);
```

`graphql("...")` returns a `TypedDocumentNode<Result, Variables>` (looked up in the
`Documents` map in `gql.ts`). Passing it to `client.query` / `client.mutation` /
`client.subscription` makes both the result data and the variables fully typed — no
manual generics needed. Where the Svelte code DOES annotate generics
(`queryStore<{ rooms: RoomData[] }>(...)`) it is supplying hand-written interfaces; the
typed-document already carries the types, so in React we should rely on the inferred
types from `graphql()` and skip the manual interfaces.

Operation naming convention: every operation has a unique name (e.g. `Rooms`,
`DevicesInit`, `DeviceStoreStateChanged`, `login`). Page-local helper queries get
page-prefixed names to avoid collisions (`RoomsPageGroups`, `RoomsPageRoomById`). E2E
ops are prefixed `E2E*`. This matters because client-preset keys the `Documents` map by
the raw query string and requires unique operation names across the whole project.

---

## 4. Per-route fetch patterns (consumption)

There are three consumption styles, all going through `getContextClient()`:

1. Reactive query store (declarative, auto-subscribes to cache/refetch):
   `src/routes/rooms/+page.svelte`, `src/routes/+page.svelte`
   ```ts
   const client = getContextClient();
   const roomsQuery = queryStore<{ rooms: RoomData[] }>({ client, query: ROOMS_QUERY });
   const rooms = $derived($roomsQuery.data?.rooms ?? []);
   ```
   `queryStore` returns a readable store of `{ data, fetching, error }`; Svelte's `$`
   auto-subscribes and re-renders. This is the urql-Svelte equivalent of React's
   `useQuery`.

2. Imperative one-shot query/mutation (`.toPromise()`):
   - Login (`src/routes/login/+page.svelte`):
     `await client.mutation(LOGIN, { input: { username, password } }).toPromise()` then
     `auth.setToken(result.data.login.token)`.
   - History fetch with variables (`src/lib/components/state-history-chart.svelte`):
     inside an `$effect`, for each selected source, build a filter
     (`{ deviceIds, fields, from: fromIso, to: toIso, bucketSeconds }`) and
     `client.query(STATE_HISTORY_QUERY, { filter }).toPromise()`. Time range +
     bucketing are query VARIABLES; the effect re-runs and re-fetches when the
     reactive inputs (sources/from/to/bucket) change, then merges results into local
     state. This is the canonical "history is a parameterized GraphQL query" pattern we
     want for our history charts.

3. Subscription-backed live store (initial query then stream deltas): the central
   live-data pattern, in `src/lib/stores/devices.ts`. Documented below.

### Live-data store (the key pattern for our LIVE refactor)
`createDeviceStore()` exposes `start(client)` / `stop()`:
```ts
async start(client) {
  const res = await client.query(DEVICES_QUERY, {}).toPromise();   // 1. initial snapshot
  if (res.data?.devices) hydrate(res.data.devices);
  devicesHydrated.set(true);

  const s1 = client.subscription(DEVICE_STATE_CHANGED, {}).subscribe(r => {  // 2. stream deltas
    if (!r.data) return;
    const { deviceId, state } = r.data.deviceStateChanged;
    updateState(deviceId, state);
  });
  // ... DEVICE_AVAILABILITY_CHANGED, DEVICE_ADDED, DEVICE_REMOVED
  unsubFns = [s1.unsubscribe, ...];
}
stop() { for (const u of unsubFns) u(); /* reset */ }
```
Pattern = "fetch full state once, then apply granular subscription deltas to an
in-memory map." Each domain event is its OWN subscription operation
(`deviceStateChanged`, `deviceAvailabilityChanged`, `deviceAdded`, `deviceRemoved`),
not one mega-stream. Updates are merge-with-equality-guard (`statesEqual`) to avoid
needless re-renders. `start`/`stop` are lifecycle-managed (from the root layout) so the
WS subscriptions exist for the whole authenticated session, NOT per route. The dashboard
page (`src/routes/+page.svelte`) reads `$deviceStore` plus its own `queryStore`s and a
page-scoped subscription (`sceneActiveChanged`) created in `onMount` / torn down in
`onDestroy`.

So there are TWO subscription scopes:
- App-lifetime live stores (devices) started in the layout.
- Page-scoped subscriptions (scene-active) created/destroyed with the route.

---

## 5. REACT / urql translation (target for `dashboard/`)

Dashboard today: React 18.3 + Vite 5 + shadcn + Bun, data via a hand-rolled
`ApiProvider` using `EventSource` (SSE) and REST `services/*.ts`
(`historyApi`, `nodesApi`, `sessionApi`, `settingsApi`, `authApi`), auth via
`contexts/auth/AuthContext`. Root providers are nested in `dashboard/src/main.tsx`.
All of this REST+SSE plumbing is what GraphQL replaces.

### 5.1 Packages
Add (Bun): `urql @urql/core graphql graphql-ws` and dev
`@graphql-codegen/cli @graphql-codegen/client-preset`. (`@urql/svelte` -> `urql`, the
React bindings. `urql` re-exports core + React hooks/Provider.) `jwt-decode` if we keep
the client-side expiry gate.

### 5.2 codegen.ts (React)
Same client-preset, just React document globs and a scalar mapping:
```ts
import type { CodegenConfig } from "@graphql-codegen/cli";
const config: CodegenConfig = {
  schema: "../api/graph/schema.graphqls",      // wherever gqlgen SDL lands
  documents: ["src/**/*.{ts,tsx}"],
  generates: {
    "src/gql/": {
      preset: "client",
      config: { useTypeImports: true, scalars: { DateTime: "string" } },
    },
  },
};
export default config;
```
Wire `make generate` to run `graphql-codegen` (replaces the current `tygo`/`apiTypes.ts`
generation — see 08-data-model doc). `graphql()` tag imported from `src/gql`.

### 5.3 Client + Provider (translate `client.ts` + layout)
```tsx
// src/gql/client.ts
import { Client, fetchExchange, mapExchange, subscriptionExchange, cacheExchange } from "urql";
import { createClient as createWSClient } from "graphql-ws";
import { authStore } from "@/contexts/auth";

const wsClient = createWSClient({
  url: wsUrl("/graphql"),
  connectionParams: () => {
    const token = authStore.getToken();
    return token ? { authToken: token } : {};
  },
});

export function createGraphQLClient() {
  return new Client({
    url: "/graphql",
    fetch: authenticatedFetch,            // same Bearer + X-Refreshed-Token + 401 wrapper
    exchanges: [
      mapExchange({ onError });
      cacheExchange,                       // decide: include document cache (recommended)
      fetchExchange,
      subscriptionExchange({
        forwardSubscription(request) {
          const input = { ...request, query: request.query || "" };
          return { subscribe(sink) { return { unsubscribe: wsClient.subscribe(input, sink) }; } };
        },
      }),
    ],
  });
}
```
```tsx
// src/main.tsx
import { Provider as UrqlProvider } from "urql";
const gqlClient = createGraphQLClient();
// wrap App: <UrqlProvider value={gqlClient}> ... </UrqlProvider>
```
`UrqlProvider` replaces the SSE-based `ApiProvider`/`SessionAwareApiProvider`. The
`subscriptionExchange.forwardSubscription` body is IDENTICAL to Svelte (it is
framework-agnostic urql core). `getContextClient()` -> React `useClient()` when an
imperative client is needed.

### 5.4 Hooks (replace queryStore / imperative calls)
- `queryStore({ client, query })` -> `useQuery({ query })`:
  ```tsx
  const [{ data, fetching, error }] = useQuery({ query: RoomsDocument /* graphql(`...`) */ });
  const rooms = data?.rooms ?? [];
  ```
- imperative mutation (login) -> `useMutation`:
  ```tsx
  const [, login] = useMutation(LOGIN);
  const res = await login({ input: { username, password } });
  if (res.data) authStore.setToken(res.data.login.token);
  ```
  (`useMutation` returns `[state, execute]`; `execute(vars)` returns a promise — direct
  analogue of `client.mutation(...).toPromise()`.)
- subscription -> `useSubscription` with a reducer (handler) for delta accumulation:
  ```tsx
  const [{ data }] = useSubscription(
    { query: DEVICE_STATE_CHANGED },
    (prev, ev) => ({ ...prev, [ev.deviceStateChanged.deviceId]: ev.deviceStateChanged.state }),
  );
  ```
  The `(prev, next) => acc` handler arg is urql-React's built-in equivalent of the
  Svelte store's manual `updateState` merge.

### 5.5 Translating the live-store pattern (devices.ts -> React)
Two viable React shapes:
1. Provider + `useSubscription` reducers: a `LiveStateProvider` does an initial
   `useQuery` for the snapshot, then several `useSubscription` calls each with a reducer
   that merges deltas into a single context value (a `Map`/record keyed by id). Exposes
   the merged state via context; pages read via a selector hook
   (`useLiveState(selector)`), keeping the existing `use-context-selector` approach to
   limit re-renders. This is the closest match to the Svelte app-lifetime store and is
   recommended for our single always-on live stream.
2. Imperative store + `useClient()`: replicate `createDeviceStore` literally with
   `client.subscription(DOC, vars).subscribe(...)` (urql core API exists in React too),
   driving a zustand/external store. Use only if we want the store outside React's
   render lifecycle.

The "fetch-once-then-stream-deltas" contract is unchanged; only the merge plumbing
moves into either `useSubscription` reducers or an external store.

### 5.6 Per-page smart fetching + loading/suspense
- Per-route: author exactly the query each page needs as a page-local `graphql()` doc
  (mirror saffron-hive's `RoomsPageGroups`-style page-prefixed naming), call `useQuery`
  in the page component. shadcn `Skeleton` components render while `fetching`. There is
  NO global mega-payload like today's `ApiData` default object — that whole-state blob
  is replaced by narrow per-page queries.
- Loading: urql React supports React Suspense via `useQuery({ query, context: { suspense: true } })`
  or `Client({ suspense: true })`, letting the existing `<Suspense>` boundary in
  `main.tsx` drive loading states. For incremental areas, prefer the explicit
  `fetching` flag + `Skeleton` (matches saffron-hive's `delayedLoading`). Pick one
  convention project-wide.
- History pages: parameterized `useQuery` with `variables: { filter: { from, to,
  bucketSeconds, ... } }`; changing the range changes variables and urql re-fetches.
  Replaces `services/historyApi.ts` + `useHistoryData.ts`.
- Auth gate: a root `useQuery` for a setup/me query (analogue of the layout `gate()` /
  `SETUP_STATUS_QUERY`) plus the synchronous JWT expiry check before rendering routes.

### 5.7 What gets deleted on the React side
- `contexts/api/ApiProvider.tsx`, `SessionAwareApiProvider.tsx`, `ConnectionChecker.tsx`,
  `useApi.ts` (SSE/EventSource + monolithic `ApiData`).
- `services/{historyApi,nodesApi,sessionApi,settingsApi,authApi}.ts` (REST fetchers).
- `apiTypes.ts` (tygo) -> replaced by codegen `src/gql/graphql.ts`.
- `hooks/useHistoryData.ts` -> per-page `useQuery`.

---

## 6. REST/SSE -> GraphQL op mapping cues (for cross-ref with 06/08)
- SSE event stream (`/v1/sessions/:id/events`, `ApiProvider` EventSource) -> a set of
  named GraphQL `subscription`s (one per live domain entity, mirroring
  `deviceStateChanged` granularity) bridged from the Go eventbus.
- REST snapshots (`/v1/state`, `/v1/circuits`, `/v1/factoryStats`, ...) -> `Query` fields
  fetched per-page via `useQuery`.
- History REST (`historyApi`) -> parameterized `Query` (filter with from/to/bucket).
- Session/settings/auth REST (`sessionApi`/`settingsApi`/`authApi`) -> `Mutation`s
  (`login`, `createSession`, `updateSettings`, ...) consumed via `useMutation`.

---

## 7. Open questions / decisions for the plan
- cacheExchange: saffron-hive's explicit exchange list OMITS `cacheExchange`
  (cache-light, refetch-heavy). Decide whether the dashboard adds the document
  `cacheExchange` (recommended for snapshot queries) or Graphcache (normalized). This
  affects how mutations invalidate query results.
- Suspense vs explicit `fetching`: pick one project-wide loading convention.
- Custom scalar mapping: map `DateTime` to `string` in codegen (reference left it as
  `any`) to keep history time handling typed.
- Live-store shape: Provider+useSubscription-reducer vs external store — needs a call,
  tied to the eventbus subscription design in 05/06.
- Operation-name uniqueness: client-preset requires globally unique operation names;
  establish the page-prefix naming convention up front.
- WS auth on reconnect/token-rotation: `connectionParams` is evaluated per connect; if
  the HTTP `X-Refreshed-Token` rotates the token mid-session, the existing WS connection
  keeps its old `connection_init` auth until it reconnects. Confirm whether the gqlgen
  server re-validates auth per subscription message or only at connect (security + UX).
