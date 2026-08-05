# FRM client

The translation layer between the Ficsit Remote Monitoring (FRM) mod's HTTP API and this app's
domain models. It fetches, converts, and polls; it does not cache, store, or publish.

```
FRM mod (game) ──HTTP──> frm_models.*  ──convert──> models.*  ──> worker.SessionManager
                         (FRM's JSON)              (domain)
```

## Files

| File | Purpose |
| --- | --- |
| `client.go` | the `Client`, HTTP helpers, connection health, `SetupEventStream` polling table |
| `request_queue.go` | sequential processing + in-flight deduplication per endpoint |
| `frm_models/models.go` | raw FRM response structs — field names match FRM's JSON exactly |
| `utils.go` | `parseLocation`, `parseBoundingBox`, coordinate helpers |
| `session.go` | session info / save name probe |
| `stats.go` | factory, production and sink stats |
| `power.go` | circuits, cables, generator stats |
| `machines.go` | machines, storages |
| `trains.go` | trains, train stations |
| `drones.go` | drones, drone stations |
| `vehicles.go` | trucks, tractors, explorers, vehicle paths |
| `infra.go` | belts, pipes, rails, hypertubes |
| `misc.go` | space elevator, HUB, radar towers |
| `world.go` | resource nodes |
| `players.go` | players |
| `schematics.go` | schematics / milestones |

FRM's field naming is inconsistent — some fields are `PascalCase`, some `camelCase`, and the bounding
box arrives as `features`. Match what FRM actually returns rather than what looks right, and keep the
raw struct in `frm_models` so the irregularity stays contained there.

## Adding an endpoint

1. Add the raw response struct to `frm_models/models.go` if the shape is new.
2. Add a `func (client *Client) GetX(ctx context.Context) (*models.X, error)` to the domain file. Use
   `client.makeSatisfactoryCallWithTimeout(ctx, "/getX", &raw, apiTimeout)`, then convert to
   `models.X`. Single-item endpoints return a list — treat an empty list, or a record with an empty
   ID, as `nil, nil` rather than an error.
3. Register it in the `endpoints` slice in `SetupEventStream` with a `models.SatisfactoryEventX` type
   and an interval.
4. Continue with step 4 of "Adding an FRM-backed domain" in `api/AGENTS.md`.

## Poll intervals

`SetupEventStream` picks the interval per endpoint; the tiers in use are:

| Interval | Data |
| --- | --- |
| 4s | live state: circuits, stats, players, machines, vehicles and their stations, radar towers |
| 5s | API status |
| 20s | resource nodes |
| 30s | semi-static: space elevator, HUB, vehicle paths, schematics |
| 120s | infrastructure: belts, pipes, rails, cables, hypertubes, storages |

Every interval is a poll against a running game. Adding a 4s endpoint costs the game server real
work, so default to the slowest tier the UI can tolerate.

## Connection health

The client counts consecutive failures and reports `IsDisconnected()` once the threshold (5) is hit,
firing the callback set by `SetDisconnectedCallback()`. `incrementFailureCount` /
`resetFailureCount` bracket every request. `RequestQueue` serialises requests and skips an endpoint
that is already in flight, so a stalled game cannot pile up work.

FRM endpoint reference: <https://docs.ficsit.app/ficsitremotemonitoring/latest/>
