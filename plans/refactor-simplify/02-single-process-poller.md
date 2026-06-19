# 02 — Single-process poller

## Context

The backend was built (spec `002-redis-poll-lease`) to run as several scaled
replicas that split polling work between them. The machinery for that is
threefold and all of it is dead weight once there is a single process:

- **`api/service/lease/`** — a Redis-backed distributed-lock package
  (`poll:lease:<sessionID>` lease keys + `poll:node:<id>` heartbeat keys,
  owner-checked Lua `renewScript`/`releaseScript`, FNV-1a rendezvous hashing to
  pick a session's "preferred owner", `init`→`online` status transition,
  heartbeat/renewal/discovery loops). Its core invariant is "exactly one API
  instance holds the lease for each session." With one process that invariant is
  satisfied by construction.
- **The `-api` / `-publisher` / `-settings-listener` worker-flag split** in
  `api/cmd/flag.go` + `api/cmd/app.go` — lets you boot the HTTP server and the
  poller and the settings listener as separately-scaled processes. With one
  process they always run together.
- **Node identity** — `SD_NODE_NAME` (`config.NodeName`) feeds
  `lease.GenerateInstanceID`; a single process has no node identity. A pile of
  Makefile targets (`backend-2`, `backend-api`, `backend-poller`,
  `backend-api-2`, `backend-poller-2`) exist only to launch the multi-instance
  topology, plus a `/v1/nodes` endpoint + debug view to visualize the cluster.

The actual poller — `api/worker/session_manager.go` — must SURVIVE. It is the
thing being de-leased and simplified, not deleted. It owns the per-session
goroutine lifecycle (`Start` → `StartSession` → `publishLoop` →
FRM `SetupEventStream`/`SetupLightPolling`), the connected/disconnected
transitions, `monitorSessionInfo` (save-name + game-time tracking), per-event
history storage, latest-state caching, and event publish. Today every one of
those poll results is gated by `leaseManager.IsOwned`/`IsUncertain`/
`IsOwnedStrict`; those gates come out and the loop simply runs for the lifetime
of its context.

This document covers ONLY the collapse to a single in-process poller: deleting
the lease subsystem, the worker-flag split, node identity, the cluster view, and
the multi-instance Makefile targets, and defining the new poller supervisor
lifecycle. The Redis touchpoints that survive inside the poller (state cache,
SSE pub/sub, history ZSETs, session store) are re-pointed to the eventbus (doc
05) and SQLite (doc 04) by those documents; here they are left as-is except
where lease coupling forces a change. This doc is the *structural* simplification
that docs 03/04/05 build their data-plane changes on top of.

There is **NO mock mode and no mock poller** (decision D-D). `Config.Mock` never
existed in code; the only references are stale lines in `CLAUDE.md`
("Set `mock: true`") and `api/CLAUDE.md` (`service/mock_client`, `Config.Mock`),
which 06 deletes. This doc therefore never branches the supervisor on a
mock/real flag — there is exactly one real poller supervising every session.

## Capacity envelope — why one in-process poller is enough (decision D-B)

The target is **up to ~10 concurrent game sessions**. A single in-process
poller with no sharding is justified at this scale, and this is the explicit
reason the lease subsystem is deleted rather than re-implemented:

- **Poll/write load.** ~10 sessions × ~12 live data types on the fast tier
  (polled every few seconds) plus ~5 history writes per session feed a bounded
  SQLite write rate. Under WAL with a single writer (`_txlock=immediate`, see
  doc 04) the upsert rate is comfortable; one in-process writer is never the
  bottleneck at this scale.
- **Fan-out load.** The eventbus (doc 05) fans out to a handful of subscribers
  per session — one browser tab opens a few `<domain>Changed` streams — which is
  comfortable for the drop-on-full channel bus.
- **Goroutine load.** One supervisor goroutine plus a small fixed set of
  goroutines per session (`publishLoop`, `monitorSessionInfo`, the FRM request
  queue worker) for ~10 sessions is a few dozen goroutines total — trivial.

Beyond a few dozen sessions the single-writer / single-poller model would need
revisiting (sharded pollers, a dedicated write queue). That is **explicitly out
of scope** for this refactor: the design is sized for ~10 sessions, not for
horizontal scale, and the deleted lease machinery is not coming back in another
form.

## Settled design decisions

- **One supervisor owns ALL sessions, unconditionally.** `SessionManager`
  survives as the in-process supervisor. On startup it loads every session from
  the store and starts one poll-loop goroutine per non-paused session. There is
  no `TryAcquire`, no preferred-owner gate, no `IsReady` init phase — every
  session is polled locally because there is exactly one process.

- **The lease package is deleted whole.** `api/service/lease/` (manager,
  instance, rendezvous, types, lua_scripts, and any `*_test.go`) is removed. It
  has no replacement — distributed coordination state ceases to exist, it is not
  re-implemented in memory or in SQLite.

- **The worker-flag concept is removed; the process always runs everything.**
  `FlagTypeWorker`, the per-flag `Run func`, `AnyWorkerFlagsPassed`, and the
  "no workers specified, start all" fallback all go away. `cmd.Create` boots,
  in order: the HTTP server, the poller supervisor, and the settings handling —
  unconditionally. Only the global `-mode` flag (and the existing `-config`)
  remains.

- **Node identity is deleted.** `config.NodeName`, the `SD_NODE_NAME` read in
  `environment.go`, and every consumer (`SessionManagerWorker` → lease,
  `GenerateInstanceID`) go away. The poller logs use the session ID; there is no
  instance ID to log.

- **The per-event ownership checks are deleted, not loosened.** `publishLoop`'s
  handler drops the `IsOwned`/`IsUncertain` block and the pre-poll
  `IsOwnedStrict` guard. The loop runs while its `ctx` is alive; it stops only on
  ctx cancellation (session paused/deleted/process shutdown) or transition
  restart. The `IsSessionDeleted` tombstone check stays for now — it is a
  delete-race guard owned by docs 03/04, not lease logic.

- **`watchForNewSessions` stays as a 5s reconcile loop for this doc.** Replacing
  the poll with an in-process "sessions changed" event (fired directly from the
  session CRUD mutations) is doc 05's call and is noted as a follow-up below; it
  is not required to land this structural change. Keeping the 5s loop keeps this
  doc a pure subtraction.

- **`save_name` isolation is preserved in the in-memory `LatestStore`
  (decision E-11).** The supervisor already tracks the current save name per
  session (`publisherState.currentSaveName`, maintained by `monitorSessionInfo`).
  That save name remains a mandatory key segment in the in-memory `LatestStore`
  snapshot key — exactly as commit `0a12da8` ("include save name in state cache
  keys") established — and matches the `history_points` composite PK and the
  per-`(session, save, dataType)` eventbus topic (docs 04/05/08). De-leasing
  must not drop the save-name from any cache/topic key; this doc only removes the
  ownership gates, never the save-name partitioning.

- **Shutdown is ctx-cancel + WaitGroup, sized for goroutine drain only (R3).**
  The current `app.Stop()` waits up to 10s on `workerWg` specifically so the
  lease manager can release leases. With leases gone, the only thing to wait for
  is the per-session poll goroutines exiting. Shutdown ordering is fixed and
  deterministic: **stop the poller first, then shut the HTTP server down.**
  `App.Stop()` cancels the root ctx, calls the supervisor's blocking
  `Stop(timeout)` (which cancels all per-session contexts and waits for the poll
  goroutines to drain), and only then calls `httpServer.Shutdown`. The 10s grace
  window shrinks to a small drain timeout (5s) for poll goroutines to unwind
  their FRM request queues.

- **The poller is owned by `App`, not started fire-and-forget.** Instead of a
  free `SessionManagerWorker(ctx)` goroutine, `App` holds a
  `*worker.SessionManager` field, starts it in `Create`, and calls its `Stop()`
  in `App.Stop()`. This gives the deterministic, ordered shutdown above
  (stop poller → shutdown HTTP server) and a single place to wire it to the
  eventbus/store in docs 04/05.

- **The HTTP server is stdlib `net/http`, not Gin (decision E-1).** `App` builds
  an `*http.Server` around a stdlib `http.ServeMux` (constructed by the router
  setup in docs 01/06); there is no `gin.SetMode`, no `routers.NewRouter()` Gin
  engine, and no `GIN_MODE` env read. Gin is removed from the project entirely;
  this doc's `app.go` reflects that. The mux's handlers (`/graphql`, `/healthz`,
  `/internal/metrics`, embedded-SPA + asset static serving with an `index.html`
  SPA fallback) are registered by docs 01 (static/SPA) and 06 (GraphQL +
  health/metrics); this doc only consumes the resulting `http.Handler`.

## Architecture

### Process shape — before / after

Before (multi-instance capable):

```
go run main.go -api -publisher -settings-listener   (or no flags => all)
  └─ cmd.Create
       ├─ for each FlagTypeWorker flag == true (except api): go flag.Run(ctx)
       │     ├─ -publisher          => worker.SessionManagerWorker(ctx)
       │     │      └─ lease.NewLeaseManager(node=SD_NODE_NAME) -> Start
       │     │           ├─ heartbeatLoop / renewalLoop / nodeDiscoveryLoop / statusTransitionLoop
       │     │           └─ SessionManager{leaseManager}.Start -> per-session publishLoop (lease-gated)
       │     └─ -settings-listener  => worker.SettingsListenerWorker(ctx)
       └─ if -api: start gin HTTP server
```

After (single process, no flags, stdlib HTTP):

```
go run main.go
  └─ cmd.Create
       ├─ start *http.Server over the stdlib mux (handler built by docs 01/06; no Gin)
       ├─ poller = worker.NewSessionManager(); poller.Start(ctx)   (owns ALL sessions, no leases)
       │     └─ per-session publishLoop (runs for ctx lifetime)
       └─ start settings handling (in-process; doc 03/05 detail)
  └─ App.Stop (R3 ordering): cancel ctx -> poller.Stop(5s) (drain poll goroutines) -> httpServer.Shutdown
```

### `cmd/flag.go` — collapse to a flag struct

The whole worker-flag abstraction (`FlagType`, `FlagDefinition.Run`,
`FlagDefinitionList`, `AnyWorkerFlagsPassed`, the passed-value reflection in
`ParseFlags`) exists to enable the split. Replace it with a flat options struct
and ordinary `flag` parsing.

```go
package cmd

import (
	"api/models/mode"
	argFlag "flag"
)

type Options struct {
	Mode   string
	Config string
}

func ParseFlags() *Options {
	opts := &Options{}
	argFlag.StringVar(&opts.Mode, "mode", mode.Dev, "Application mode: prod, dev, or test")
	argFlag.StringVar(&opts.Config, "config", "", "Path to a config file override")
	argFlag.Parse()

	if opts.Mode != mode.Test && opts.Mode != mode.Prod && opts.Mode != mode.Dev {
		panic("Invalid mode specified. Valid options are: test, dev, prod")
	}

	return opts
}
```

(If `-config` is not currently parsed via this list, keep it wherever it is read
today; the point is only that `-api`/`-publisher`/`-settings-listener` are gone.)
`api/cmd/flag.go` collapses to this; the `worker` import that the old `Run`
closures pulled in is dropped from this file.

### `cmd/app.go` — unconditional startup + poller-owning App, stdlib HTTP

`App` gains a poller field and drops the worker loop, the `api`-flag gate, the
lease-sized grace window, and **all Gin coupling** (decision E-1): no
`gin.SetMode`, no `GIN_MODE` read, no `routers.NewRouter()` Gin engine. The
HTTP handler is the stdlib `http.Handler` (a `*http.ServeMux`) assembled by the
router setup in docs 01/06.

```go
type App struct {
	httpServer *http.Server
	poller     *worker.SessionManager
	ctx        context.Context
	cancel     context.CancelFunc
}

func Create(opts *Options) *App {
	if err := log.SetupLogger(opts.Mode); err != nil {
		panic(fmt.Sprintf("Failed to set up logger: %s", err))
	}

	initTasks := []InitTask{
		{Name: "Setup environment", Task: func() error { return config.SetupEnvironment(opts.Mode) }},
		{Name: "Setup DB", Task: func() error { return db.Setup() }},
		{Name: "Initialize auth", Task: initializeAuth},
	}
	runInitTasks(initTasks)

	ctx, cancel := context.WithCancel(context.Background())
	app := &App{ctx: ctx, cancel: cancel}

	app.httpServer = &http.Server{
		Addr:    fmt.Sprintf("0.0.0.0:%d", config.Config.Port),
		Handler: routers.NewHandler(), // stdlib *http.ServeMux built by docs 01/06 — NOT a gin.Engine
	}
	go func() {
		log.Printf("%sHTTP server listening on %s0.0.0.0:%d%s", log.Bold, log.Orange, config.Config.Port, log.Reset)
		if err := app.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalln(fmt.Errorf("failed to start http server: %w", err))
		}
	}()

	app.poller = worker.NewSessionManager()
	go app.poller.Start(ctx)

	startSettingsHandling(ctx)

	return app
}

func (app *App) Stop() {
	app.cancel()

	if app.poller != nil {
		app.poller.Stop(5 * time.Second)
	}

	if app.httpServer != nil {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := app.httpServer.Shutdown(shutdownCtx); err != nil {
			log.Fatalln(fmt.Errorf("failed to shutdown server: %w", err))
		}
	}

	log.Println("Server exited successfully")
}
```

Notes:
- **Gin is gone (E-1).** The old `gin.SetMode(ginMode)` block and the
  `GIN_MODE` env lookup are deleted; `routers.NewRouter()` (which returned a
  `*gin.Engine`) is replaced by a stdlib handler constructor (named here
  `routers.NewHandler()` — the exact name and body are owned by docs 01/06,
  which build the `http.ServeMux`, register `/graphql` + `/healthz` +
  `/internal/metrics`, and register the embedded-SPA + asset static serving with
  an `index.html` SPA fallback last). This doc only wires the resulting
  `http.Handler` into the `*http.Server`. The `gin` and `gin-contrib/cors`
  imports leave `app.go`.
- **Shutdown ordering is explicit (R3).** `app.cancel()` signals every
  ctx-derived goroutine; `poller.Stop(5s)` blocks until the poll goroutines
  drain (or the 5s timeout); only then is `httpServer.Shutdown` called. Stopping
  the poller before the HTTP server means no `<domain>Changed` events are
  produced into a closing server, and in-flight GraphQL/subscription handlers get
  the standard `http.Server.Shutdown` graceful drain.
- `validateApp` is deleted (it only existed to default the worker flags on).
- `startSettingsHandling(ctx)` is a thin in-process replacement for the old
  `SettingsListenerWorker` goroutine; its body (subscribe to settings changes /
  apply log level) is doc 03/05's concern — here it is just started
  unconditionally instead of being a flaggable worker. If doc 03 makes settings
  changes a direct in-process call, `startSettingsHandling` may disappear
  entirely; this doc only removes its flag.
- `initializeAuth`'s doc comment that says "checks if a password exists in
  Redis" is reworded to drop the Redis reference (the auth store move to the
  `auth_password`/`auth_tokens` SQLite tables is doc 04's; the comment fix rides
  along here since the function is touched). The clean-wipe auth bootstrap
  (decision D-A) is owned by docs 01/06 and the release note; this doc does not
  branch on it.

### `worker/session_manager.go` — de-leasing

The supervisor keeps its structure; the lease coupling is excised. Field/struct
changes:

```go
type SessionManager struct {
	store      *session.Store
	kvClient   *key_value.Client
	publishers map[string]*publisherState
	mu         sync.RWMutex
	wg         sync.WaitGroup
}

func NewSessionManager() *SessionManager {
	return &SessionManager{
		store:      session.NewStore(),
		kvClient:   key_value.New(),
		publishers: make(map[string]*publisherState),
	}
}
```

Deletions in this file:
- Package globals `globalLeaseManager`, `globalLeaseManagerMu`,
  `SetGlobalLeaseManager`, `GetGlobalLeaseManager` (only consumer is the deleted
  `nodes.go`).
- The `leaseManager lease.LeaseManager` field and the `NewSessionManager`
  parameter.
- In `StartSession`: the `leaseManager.TryAcquire` call and the
  not-acquired/early-return branch. Starting a publisher becomes unconditional
  (after the already-running check).
- In `publishLoop`'s handler: the entire `IsOwned`/`IsUncertain` block
  (`session_manager.go:273-286`).
- In `publishLoop`: the pre-poll `IsOwnedStrict` guard
  (`session_manager.go:353-366`) and the `Poll start: instance=...` log line
  that calls `sm.leaseManager.InstanceID()`.
- In `Stop`: the `sm.leaseManager.Stop()` call and its doc-comment mention of
  releasing leases/heartbeat.
- `SessionManagerWorker` (the whole function) is removed; `App` calls
  `NewSessionManager()` + `Start`/`Stop` directly. The `api/service/lease`
  import is dropped from this file.

`StartSession` after de-leasing (note `currentSaveName` is retained on
`publisherState` — it remains the mandatory save-name key segment for the
`LatestStore` snapshot key and the eventbus topic, decision E-11):

```go
func (sm *SessionManager) StartSession(parentCtx context.Context, sess *models.Session) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if _, exists := sm.publishers[sess.ID]; exists {
		log.Warnf("Publisher for session %s already running", sess.ID)
		return
	}

	ctx, cancel := context.WithCancel(parentCtx)
	state := &publisherState{
		cancel:          cancel,
		isDisconnected:  sess.IsDisconnected,
		currentSaveName: sess.SessionName,
		gameTimeTracker: session.NewGameTimeTracker(),
	}
	sm.publishers[sess.ID] = state

	log.Infof("Starting publisher for session: %s (%s)", sess.Name, sess.ID)
	go sm.publishLoop(ctx, sess, state)
}
```

`Stop` after de-leasing — cancel all per-session contexts and wait for the poll
goroutines (now tracked by `sm.wg`) to drain, bounded by a timeout:

```go
func (sm *SessionManager) Stop(timeout time.Duration) {
	log.Infoln("Stopping session manager...")

	sm.mu.Lock()
	for sessionID, state := range sm.publishers {
		state.cancel()
		delete(sm.publishers, sessionID)
	}
	sm.mu.Unlock()

	done := make(chan struct{})
	go func() {
		sm.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Infoln("Session manager stopped gracefully")
	case <-time.After(timeout):
		log.Warnln("Timed out waiting for poll goroutines to stop")
	}
}
```

To make `Stop` deterministic, `publishLoop` and `monitorSessionInfo` (and the
`watchForNewSessions` goroutine) are wrapped with `sm.wg.Add(1)` /
`defer sm.wg.Done()`. `Start` no longer blocks on `<-ctx.Done()` (the App owns
the lifetime); it loads sessions, starts publishers, launches
`watchForNewSessions` and returns:

```go
func (sm *SessionManager) Start(ctx context.Context) {
	log.Infoln("Starting session manager...")

	sessions, err := sm.store.List()
	if err != nil {
		log.PrettyError(fmt.Errorf("failed to load sessions: %w", err))
		return
	}

	log.Infof("Found %d existing sessions", len(sessions))
	for _, sess := range sessions {
		if sess.IsPaused {
			log.Infof("Skipping paused session: %s (%s)", sess.Name, sess.ID)
			continue
		}
		sm.StartSession(ctx, sess)
	}

	sm.wg.Add(1)
	go func() {
		defer sm.wg.Done()
		sm.watchForNewSessions(ctx)
	}()
}
```

Everything else in the file is preserved verbatim: `watchForNewSessions`
reconcile logic, `StopSession`, `monitorSessionInfo`, `transitionToDisconnected`/
`transitionToConnected`, `restartPublisherLocked`, the history-store +
state-cache + publish work inside the handler. Those touch Redis and are
re-pointed to channels/SQLite by docs 03/04/05 — out of scope here. The
save-name partitioning inside that work (the `currentSaveName` segment of the
cache key and the publish topic, commit `0a12da8`) is preserved as-is; doc 04/05
carry it into the `LatestStore` key, the `history_points` PK, and the eventbus
topic (decision E-11).

### `/v1/nodes` cluster view — deleted

With one process the cluster view is meaningless (always one node owning
everything). Delete the backend handler (`routers/api/v1/nodes.go`), the routing
group (`routers/routes/nodes.go`) and its registration in
`routers/routes/routes.go`, and the model (`models/models/nodes.go` —
`NodeInfo`, `SessionLease`, `NodesResponse`; doc 08 confirms these are DELETE,
not migrated). On the frontend, delete `services/nodesApi.ts`,
`sections/debug/view/debug-nodes-view.tsx` (and its `index.ts` export),
`pages/debug-nodes.tsx`, the nodes route entry in `routes/sections.tsx`, and the
lease-node nav entry in `layouts/config-nav-dashboard.tsx`. Because tygo and
`dashboard/src/apiTypes.ts` are deleted entirely (decision E-8, doc 08), the
`NodeInfo`/`SessionLease`/`NodesResponse` TS types simply never exist after the
migration — there is no generated artifact to clean up and, crucially, these
internal types never appear in the GraphQL SDL (doc 08), so they cannot leak to
the client.

> Disambiguation: `config-nav-dashboard.tsx` also contains unrelated "nodes"
> (resource nodes on the map). Only the *lease-cluster* debug view is removed;
> resource-node code stays.

### Node identity / `SD_NODE_NAME` — deleted

- `api/pkg/config/config.go` — remove the `NodeName string` field.
- `api/pkg/config/environment.go` — remove the `SD_NODE_NAME` read block
  (~lines 40-43).
- The only consumers were `SessionManagerWorker` (deleted) and
  `lease.GenerateInstanceID` (deleted with the package).

### Makefile — single invocation

Delete the multi-instance targets and their `help` lines: `backend-2`,
`backend-api`, `backend-poller`, `backend-api-2`, `backend-poller-2` (plus
removing them from the `.PHONY` line and the help block at lines ~27-31). Reduce
`backend` and `backend-live` to flagless, `SD_NODE_NAME`-free invocations:

```make
backend:
	@echo "Starting backend server..."
	cd api && go run main.go

backend-live:
	@echo "Starting backend server with hot reload..."
	cd api && $(shell go env GOPATH)/bin/air
```

(`air`'s configured run command, if it passes `-api -publisher`, is updated to a
bare `go run main.go` / `./tmp/main` as well — check `api/.air.toml`.)

## Files to ADD / CHANGE / DELETE

ADD:
- (none — this doc is a pure subtraction; the SQLite store, eventbus, and
  GraphQL surface are added by docs 04/05/06, and the stdlib mux/handler
  constructor consumed by `app.go` is built by docs 01/06.)

CHANGE:
- `api/cmd/flag.go` — replace the worker-flag machinery with a flat `Options`
  + `ParseFlags`; keep `-mode` (and `-config`).
- `api/cmd/app.go` — unconditional startup; `App` owns `*worker.SessionManager`;
  drop the worker loop, the `api`-flag gate, `validateApp`, the lease-sized 10s
  grace window; **remove `gin.SetMode`, the `GIN_MODE` read, and the
  `routers.NewRouter()` Gin engine in favor of an `*http.Server` over the stdlib
  handler built by docs 01/06 (E-1)**; enforce the R3 shutdown ordering (cancel →
  poller.Stop → httpServer.Shutdown); reword `initializeAuth` doc comment.
- `api/worker/session_manager.go` — remove all lease coupling (globals, field,
  constructor param, `TryAcquire`, `IsOwned`/`IsUncertain`/`IsOwnedStrict`,
  lease shutdown, `SessionManagerWorker`); add `sync.WaitGroup` tracking; make
  `Start` non-blocking and `Stop(timeout)` drain poll goroutines; preserve the
  `currentSaveName` save-name key segment (E-11).
- `api/pkg/config/config.go` — remove `NodeName`.
- `api/pkg/config/environment.go` — remove `SD_NODE_NAME` read.
- `api/routers/routes/routes.go` — remove `NodesRoutingGroup` from the
  registration list.
- `Makefile` — flagless `backend`/`backend-live`; delete the five multi-instance
  targets and their help/`.PHONY` entries.
- `api/.air.toml` — bare `go run`/binary invocation (verify it referenced the
  flags).
- `dashboard/src/routes/sections.tsx` — remove nodes route.
- `dashboard/src/layouts/config-nav-dashboard.tsx` — remove lease-node nav entry.

DELETE:
- `api/service/lease/` (entire package: `manager.go`, `instance.go`,
  `rendezvous.go`, `types.go`, `lua_scripts.go`, and any `*_test.go`).
- `api/routers/api/v1/nodes.go`
- `api/routers/routes/nodes.go`
- `api/models/models/nodes.go`
- `dashboard/src/services/nodesApi.ts`
- `dashboard/src/sections/debug/view/debug-nodes-view.tsx` (+ its export in the
  sibling `index.ts`)
- `dashboard/src/pages/debug-nodes.tsx`
- `specs/002-redis-poll-lease/` (historical spec — archive/remove)

> The old `NodeInfo`/`SessionLease`/`NodesResponse` entries in
> `dashboard/src/apiTypes.ts` need no hand-edit: `apiTypes.ts` and tygo are
> deleted wholesale by the GraphQL codegen migration (decision E-8), so the file
> no longer exists after the refactor.

## Step-by-step migration

1. **Delete the cluster view first (leaf, no dependents but `nodes.go`).** Remove
   the frontend files (`nodesApi.ts`, `debug-nodes-view.tsx` + its `index.ts`
   export, `debug-nodes.tsx`), the route and nav entries. Remove the backend
   `routers/api/v1/nodes.go`, `routers/routes/nodes.go`, its registration in
   `routes.go`, and `models/models/nodes.go`. This is the only API consumer of
   `GetGlobalLeaseManager`, so removing it first unblocks the global's deletion.

2. **De-lease `session_manager.go`.** Remove the `globalLeaseManager` globals +
   getters/setters, the `leaseManager` field and constructor param, the
   `TryAcquire` gate in `StartSession`, the `IsOwned`/`IsUncertain` block and
   `IsOwnedStrict` guard in `publishLoop`, the lease `Stop()` call, and the
   `lease` import. Add `sync.WaitGroup` wrapping to `publishLoop`,
   `monitorSessionInfo`, and the `watchForNewSessions` goroutine. Make `Start`
   non-blocking, change `Stop` to `Stop(timeout time.Duration)`. Delete
   `SessionManagerWorker`. Confirm `currentSaveName` and the save-name key
   segment in the cache/publish work are left intact (E-11). Compile
   `api/worker` in isolation.

3. **Delete the lease package.** Remove `api/service/lease/` wholesale. With
   steps 1–2 done, nothing imports it. `go build ./...` confirms.

4. **Collapse the flags + App (stdlib HTTP).** Rewrite `cmd/flag.go` to the flat
   `Options`/`ParseFlags`. Rewrite `cmd/app.go`: drop `validateApp`, the worker
   loop, the `api`-flag gate; **remove `gin.SetMode`, the `GIN_MODE` lookup, and
   `routers.NewRouter()`; wire the `*http.Server.Handler` to the stdlib handler
   constructor built by docs 01/06 (E-1)**; have `App` hold and start
   `worker.NewSessionManager()`, start HTTP unconditionally, start settings
   handling unconditionally, and set `Stop()` to the R3 ordering
   (`cancel → poller.Stop(5s) → httpServer.Shutdown`). Verify `main.go` still
   compiles (it calls `ParseFlags`/`Create`/`Stop` only). The stdlib handler
   constructor itself lands with docs 01/06; this step assumes its signature.

5. **Remove node identity.** Delete `NodeName` from `config.go` and the
   `SD_NODE_NAME` read from `environment.go`.

6. **Simplify the Makefile + air.** Reduce `backend`/`backend-live` to flagless
   invocations, delete the five multi-instance targets and their `.PHONY` and
   help-block entries, and fix `api/.air.toml`'s run command.

7. **Archive the spec.** Remove/archive `specs/002-redis-poll-lease/`.

8. **Verify.** `cd api && CGO_ENABLED=0 go build ./...` (and `go vet ./...`),
   `make lint`, then a manual run of `go run main.go` with two sessions to
   confirm both poll, both transition offline/online, the per-session save-name
   isolation holds, and shutdown drains cleanly within the timeout (poller stops
   before the HTTP server, R3). (Per project rules, only the user starts
   services.) Note: there is no longer a `make generate` step that "drops the
   `Node*` types from `apiTypes.ts`" — `apiTypes.ts`/tygo are gone (E-8) and the
   node types never enter the GraphQL SDL (doc 08), so their absence is
   structural, not generator-driven.

## Risks

- **Shutdown ordering / leaked goroutines (R3).** The new `Stop(timeout)` must
  actually account for every goroutine the supervisor spawns
  (`publishLoop`, `monitorSessionInfo` started inside it, and
  `watchForNewSessions`). Missing a `wg.Add`/`Done` pair either hangs shutdown or
  leaks a poller. The FRM `RequestQueue` worker is wired to `ctx.Done()` inside
  `SetupEventStream`, so cancelling the per-session ctx already stops it — but
  confirm the queue's `Stop()` is reached before `wg.Done()`. `App.Stop()` must
  call `poller.Stop()` BEFORE `httpServer.Shutdown()` so no events are produced
  into a closing server.

- **`restartPublisherLocked` uses `context.Background()`.** The transition
  restart path creates a fresh context detached from the supervisor's ctx
  (`session_manager.go:524`). After this refactor that goroutine would NOT be
  cancelled by `App.Stop()` and would not be tracked by `sm.wg`. This is a
  pre-existing latent bug surfaced by owning shutdown explicitly: the restart
  must derive from the supervisor ctx (store the parent ctx on `SessionManager`
  or pass it through) and participate in `sm.wg`. Flagging rather than silently
  changing semantics — confirm the intended fix with the plan owners.

- **`watchForNewSessions` vs. direct invalidation.** Keeping the 5s store poll is
  deliberate for this doc, but it still reads the session store (Redis today,
  SQLite later). If doc 05 replaces it with event-driven start/stop from the
  session mutations, the reconcile loop and its 5s latency disappear; until then
  there is a 0–5s lag between creating/pausing a session and the poller acting.

- **Settings listener residue.** `startSettingsHandling` is a placeholder for the
  old `SettingsListenerWorker`. If doc 03 collapses settings-change propagation
  to a direct call, this function should be removed rather than left as an empty
  in-process subscriber. Coordinate so it is not orphaned.

- **Stdlib handler constructor seam (E-1).** This doc's `app.go` assumes a
  stdlib `http.Handler` constructor (named here `routers.NewHandler()`) built by
  docs 01/06. If 01/06 name or shape it differently, `app.go`'s single
  `Handler:` line must match — coordinate the exact signature so `cmd` does not
  re-introduce a Gin dependency by accident. There is NO `gin.Engine`,
  `r.StaticFS`, `r.NoRoute`, or `GIN_MODE` anywhere after this change.

- **`/v1/nodes` external consumers.** Anything outside this repo scraping
  `/v1/nodes` (dashboards, monitoring) breaks. Per the clean-break refactor this
  is acceptable, but worth a release note. (The broader auth clean-wipe upgrade
  note — decision D-A — is owned by docs 01/06/08, but operators upgrading across
  this refactor should be pointed at it from the same release notes.)

## How this satisfies the done-criteria

- **No home-built distributed polling solution** — `api/service/lease/` is
  deleted in full (manager, instance, rendezvous, types, Lua scripts); rendezvous
  hashing, heartbeats, lease acquire/renew/release, uncertain-state pausing, and
  node discovery cease to exist. The poller owns every session unconditionally in
  one process, justified by the ~10-session capacity envelope (D-B).
- **No `SD_NODE_NAME` / node identity** — removed from config, environment, and
  every consumer; the multi-instance Makefile targets and the `/v1/nodes`
  cluster view are deleted.
- **No Gin** — `cmd/app.go` builds an `*http.Server` over the stdlib mux
  handler from docs 01/06; `gin.SetMode`, `GIN_MODE`, and `routers.NewRouter()`
  are gone (E-1).
- **No mock mode** — there is one real poller supervising every session; no
  mock branch exists anywhere in this doc (D-D).
- **Single process always runs API + poller + background work** — the
  `-api`/`-publisher`/`-settings-listener` flag split is removed; `cmd.Create`
  starts the HTTP server, the poller supervisor, and settings handling
  unconditionally, with deterministic ctx-driven shutdown (stop poller → shut
  down HTTP server, R3).
- This doc deliberately leaves the surviving Redis touchpoints inside the poller
  in place; their removal (channels for live data, SQLite for history/state) is
  the contract fulfilled by docs 03 (redis-removal), 04 (sqlite store), and 05
  (eventbus), which build directly on the single-supervisor shape defined here.
  The save-name key segment those docs carry forward into the `LatestStore`,
  `history_points`, and the eventbus topic is preserved by this doc (E-11).
```
