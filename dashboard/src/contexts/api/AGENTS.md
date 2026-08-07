# Live API context

Every piece of live game state enters the app here. ~32 GraphQL subscriptions fan in, get mapped from
GraphQL types to `apiTypes` domain shapes, and are published as one `ApiContext` value.

## Files

| File | Purpose |
| --- | --- |
| `useApi.ts` | the `ApiData` shape, `ApiContext` (from `use-context-selector`), and `DefaultApiContext` |
| `ApiProvider.tsx` | one `useSubscription` per domain, mapped and assembled into the context value |
| `live.ts` | core subscription documents (api status, circuits, factory/prod/sink stats, players, session) |
| `live_vehicles.ts` | vehicle documents + mappers (drones, trains, trucks, tractors, explorers, stations, paths) |
| `live_infra.ts` | infrastructure documents + mappers (machines, storages, belts, pipes, cables, rails, hypertubes) |
| `live_world.ts` | world documents + mappers (space elevator, HUB, radar towers, resource nodes, schematics, generator stats) |
| `SessionAwareApiProvider.tsx` | binds the provider to the selected session and remounts it on a session switch |
| `ConnectionChecker.tsx` | renders nothing; toasts on `isOnline` transitions |

## How a domain flows through

1. **Document** — declared in `live.ts` or a `live_<group>.ts` with `graphql(\`...\`)`. Selections use
   the GraphQL schema's field names; every document takes `$sessionId: ID!`.
2. **Subscription** — `ApiProvider` calls `useSubscription({ query, variables: { sessionId }, pause })`.
   `pause` is `!sessionId`, so with no session selected nothing subscribes.
3. **Mapper** — a `map<Domain>_<group>` function in the same `live_<group>.ts` converts the GraphQL
   result into the `apiTypes` shape. This is where GraphQL SCREAMING_SNAKE enums become the domain's
   lowercase string unions, and where derived fields (Fuel, generator stats) are reconciled.
4. **Context** — the assembled object is handed to `ApiContext.Provider`. A domain that has not yet
   emitted falls back to `[]`, `undefined`, or its `DefaultApiContext` value.

Components must never subscribe directly or import from `src/gql` for live data — they read
`ApiContext` and see domain types only.

## Adding a domain

1. Add the subscription document to the matching `live_<group>.ts`.
2. Add a `map<Domain>_<group>` mapper beside it.
3. Add the field to `ApiData` and `DefaultApiContext` in `useApi.ts`.
4. Add the `useSubscription` call and the mapped entry in `ApiProvider.tsx`, keeping it in its group's
   block.
5. `just codegen`.

## Two things that will bite

**Read with `useContextSelector`, not `useContext`.** The context value is rebuilt on every
subscription tick — roughly once per second across all domains. `useContext` would re-render every
consumer each time; `useContextSelector` re-renders only components whose selected slices changed.

**A session switch must remount, not update.** `SessionAwareApiProvider` keys `ApiProvider` on
`session.id`, so selecting a different session unmounts and remounts the whole provider, dropping
every subscription and all accumulated state. Without that, the previous session's data would linger
in the context until each domain happened to emit again.

A session is pinned to one save for its lifetime, so nothing below the session can invalidate the
context. When the server has a different save loaded the backend reports
`connectionState: SAVE_MISMATCH` and stops ingesting; the overlay covers the page and the last-known
values are deliberately kept, so loading the pinned save back re-renders instantly.
