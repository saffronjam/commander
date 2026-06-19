# API - Satisfactory Dashboard Backend

This document provides guidance for working with the Go backend.

> **Architecture note (current).** The backend is a single Go binary built on the stdlib
> `net/http` `ServeMux` (NO Gin) exposing one same-origin GraphQL endpoint (gqlgen) at `/graphql`
> — HTTP for queries/mutations, websocket (graphql-ws) for subscriptions — plus `/healthz`, the
> embedded SPA, and the seeded assets dir. There is **no REST, no SSE, no Redis, no Swagger**.
> Durable state is **SQLite** (`internal/store`, sqlc + golang-migrate); live data fans out
> in-process over the **Go-channel eventbus** (`pkg/eventbus`). A single in-process poller
> (`worker/session_manager.go`) owns one poll loop per active session and is the sole producer
> onto the eventbus + LatestStore, also writing history to SQLite.
>
> Sections below that describe Gin handlers, the `RoutingGroup` pattern, `RequestContext`, SSE,
> or Redis caching are **historical** and no longer reflect the code — follow the architecture
> note and the live packages (`cmd`, `internal/graph`, `internal/store`, `pkg/eventbus`, `worker`).

## Overview

The Go binary serves the embedded React SPA, the map/icon assets, and a single same-origin
GraphQL API. It polls the Ficsit Remote Monitoring (FRM) mod per session, fans live data out over
Go channels to GraphQL subscriptions, and persists sessions/settings/auth/history in SQLite.

## Go Coding Standards

Follow idiomatic Go practices:

- Use `gofmt` and `goimports` for formatting
- Check all errors immediately
- Keep the happy path left-aligned (return early)
- Document all exported symbols
- Use proper naming conventions (mixedCaps, avoid underscores)
- **NEVER maintain backward compatibility** - Always do the correct fix for a better system. Clean breaks are preferred over legacy code paths.

## Architecture

### Clean Architecture Layers

**Domain Layer** (`models/`)

- Data models representing Satisfactory entities
- DTOs for API responses
- No external dependencies

**Service Layer** (`service/`)

- Satisfactory API client abstraction
- Interface-driven design for testing
- Real and mock implementations

**Presentation Layer** (`routers/`)

- HTTP handlers and routing
- Request validation
- Response formatting

**Infrastructure Layer** (`pkg/`)

- Configuration management
- Redis connection
- Logging and metrics

### Directory Structure

```
api/
├── cmd/                       # App initialization and CLI flags
├── routers/                   # HTTP routing
│   ├── api/v1/               # Endpoint handlers
│   │   └── middleware/       # SSE and other middleware
│   └── routes/               # Route group definitions (interface pattern)
├── models/                    # Data models and DTOs
│   ├── mode/                 # Run mode definitions
│   └── models/               # Domain models (drone, train, circuit, etc.)
├── service/                   # Satisfactory API client
│   ├── client/               # Client interface
│   ├── frm_client/           # Real FRM API client implementation
│   ├── mock_client/          # Mock client for testing
│   └── session/              # Session store and cache management
├── pkg/                       # Shared packages
│   ├── config/               # YAML configuration
│   ├── db/                   # Redis setup and KV store
│   ├── log/                  # Zap structured logging
│   └── metrics/              # Prometheus metrics
├── worker/                    # Background workers (session manager)
├── docs/                      # Generated Swagger docs
├── export/                    # Tygo configuration for type generation
└── utils/                     # Utility functions
```

## Development Workflow

**Note**: All development commands should be run from the **project root** using the unified Makefile:
- `make backend` - Run backend server
- `make backend-live` - Run with hot reload
- `make lint` - Run linters
- `make format` - Format code
- `make test` - Run tests

See the root `Makefile` for all available commands.

### Running the Server Directly

```bash
cd api
go run main.go                # Run with default config
go run main.go -mode=dev      # Specify mode
go run main.go -config=config.local.yml  # Custom config
```

### Building

```bash
cd api
go build -o bin/api main.go            # Build binary
CGO_ENABLED=0 go build -o bin/api main.go  # Static binary for containers
```

Or from root: `make backend-build`

### Swagger Documentation

```bash
cd api
swag init                     # Regenerate Swagger docs
```

Swagger UI available at `/v2/docs/` when running.

### Type Generation

```bash
cd api
tygo generate --config export/tygo.yml  # Generate TypeScript types
```

Or from root: `make generate`

Config: `export/tygo.yml`
Output: `../dashboard/src/apiTypes.ts`

## Key Development Patterns

### RoutingGroup Interface

Each route group implements a consistent interface:

```go
// routes/routes.go
type RoutingGroup interface {
    PublicRoutes() []Route
    PrivateRoutes() []Route
    HookRoutes() []Route
}

// Usage in routes/circuits.go
type CircuitsRoutingGroup struct{ RoutingGroupBase }

func CircuitRoutes() *CircuitsRoutingGroup { return &CircuitsRoutingGroup{} }

func (group *CircuitsRoutingGroup) PublicRoutes() []Route {
    return []Route{
        {Method: "GET", Pattern: "/v1/circuits", HandlerFunc: v1.ListCircuits},
    }
}

// Registration in routes/routes.go
func RoutingGroups() []RoutingGroup {
    return []RoutingGroup{
        SessionRoutes(),
        CircuitRoutes(),
        // ...
    }
}
```

### RequestContext Pattern

Consistent response handling:

```go
// routers/api/v1/request_context.go
type RequestContext struct {
    ctx *gin.Context
}

func NewRequestContext(ctx *gin.Context) *RequestContext {
    return &RequestContext{ctx: ctx}
}

func (r *RequestContext) Success(data interface{}) {
    r.ctx.JSON(http.StatusOK, data)
}

func (r *RequestContext) Error(code int, message string) {
    r.ctx.JSON(code, models.ErrorResponse{Message: message})
}

// Usage in handler
func GetCircuits(svc *service.Service) gin.HandlerFunc {
    return func(c *gin.Context) {
        rc := NewRequestContext(c)
        circuits, err := svc.Client.GetCircuits()
        if err != nil {
            rc.Error(http.StatusInternalServerError, err.Error())
            return
        }
        rc.Success(circuits)
    }
}
```

### Server-Sent Events

Real-time updates via SSE:

```go
// routers/api/v1/events_sse.go
func GetEvents(svc *service.Service) gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("Content-Type", "text/event-stream")
        c.Header("Cache-Control", "no-cache")
        c.Header("Connection", "keep-alive")

        // Subscribe to Redis pub/sub
        pubsub := svc.Redis.Subscribe(c, "events")
        defer pubsub.Close()

        for msg := range pubsub.Channel() {
            c.SSEvent("message", msg.Payload)
            c.Writer.Flush()
        }
    }
}
```

### Service Layer

Interface-driven for testing:

```go
// service/client/client.go
type Client interface {
    GetCircuits() ([]models.Circuit, error)
    GetDrones() ([]models.Drone, error)
    GetTrains() ([]models.Train, error)
    GetPlayers() ([]models.Player, error)
    // ...
}

// service/frm_client/client.go - Real implementation
// service/mock_client/client.go - Mock for testing
```

### Configuration

YAML-based with environment support:

```go
// pkg/config/config.go
type Config struct {
    Port              int    `yaml:"port"`
    Mode              string `yaml:"mode"`
    ExternalURL       string `yaml:"externalUrl"`
    SatisfactoryAPIURL string `yaml:"satisfactoryApiUrl"`
    RedisURL          string `yaml:"redisUrl"`
    Mock              bool   `yaml:"mock"`
}
```

## Adding New Endpoints

1. **Create model** in `models/models/` if needed:

   ```go
   type NewEntity struct {
       ID   string `json:"id"`
       Name string `json:"name"`
   }
   ```

2. **Add client method** in `service/client/client.go`:

   ```go
   GetNewEntities() ([]models.NewEntity, error)
   ```

3. **Implement** in `service/implClient/` and `service/mockClient/`

4. **Create handler** in `routers/api/v1/`:

   ```go
   // @Summary Get new entities
   // @Tags entities
   // @Produce json
   // @Success 200 {array} models.NewEntity
   // @Router /v1/entities [get]
   func GetNewEntities(svc *service.Service) gin.HandlerFunc {
       return func(c *gin.Context) {
           rc := NewRequestContext(c)
           entities, err := svc.Client.GetNewEntities()
           if err != nil {
               rc.Error(http.StatusInternalServerError, err.Error())
               return
           }
           rc.Success(entities)
       }
   }
   ```

5. **Create route group** in `routers/routes/`:

   ```go
   type EntitiesRoutingGroup struct{ RoutingGroupBase }

   func EntityRoutes() *EntitiesRoutingGroup { return &EntitiesRoutingGroup{} }

   func (group *EntitiesRoutingGroup) PublicRoutes() []Route {
       return []Route{
           {Method: "GET", Pattern: "/v1/entities", HandlerFunc: v1.GetNewEntities},
       }
   }
   ```

6. **Register** in `routes/routes.go`:

   ```go
   func RoutingGroups() []RoutingGroup {
       return []RoutingGroup{
           // ... existing routes
           EntityRoutes(),
       }
   }
   ```

7. **Regenerate docs**:

   ```bash
   swag init
   ```

8. **Generate TypeScript types**:
   ```bash
   tygo generate
   ```

## Middleware Stack

Default middleware applied to all routes:

```go
// routers/router.go
router.Use(cors.Default())           // CORS handling
router.Use(ginzap.Ginzap(logger, time.RFC3339, true))  // Request logging
router.Use(ginzap.RecoveryWithZap(logger, true))       // Panic recovery
router.Use(metrics.Middleware())     // Prometheus metrics
```

## Data Flow Architecture

The API uses a polling-based architecture with Redis caching to provide real-time data to clients.

### Session-Based Polling

Each Satisfactory server connection is managed as a **Session**. The `SessionManager` (`worker/session_manager.go`) handles the lifecycle:

1. **Session Creation**: When a session is created via `POST /v1/sessions`, it's stored in Redis
2. **Publisher Startup**: The SessionManager starts a publisher goroutine for each active (non-paused) session
3. **FRM Client Polling**: The `frm_client` polls various FRM (Ficsit Remote Monitoring) mod endpoints at configured intervals

### Polling Configuration

The FRM client (`service/frm_client/client.go`) polls endpoints at different intervals:

| Endpoint | Event Type | Interval | Description |
|----------|------------|----------|-------------|
| `/` (status) | `satisfactoryApiCheck` | 5s | API health check |
| `/getPower` | `circuits` | 4s | Power circuit data |
| `/getFactory` + `/getExtractor` | `factoryStats` | 4s | Machine efficiency |
| `/getProdStats` + `/getWorldInv` + `/getCloudInv` | `prodStats` | 4s | Production statistics |
| `/getResourceSink` | `sinkStats` | 4s | Awesome sink stats |
| `/getPlayer` | `players` | 4s | Player data |
| `/getGenerators` | `generatorStats` | 4s | Generator details |
| `/getTrains` + `/getDrones` + `/getTrucks` | `vehicles` | 4s | Vehicle positions |
| `/getTrainStation` + `/getDroneStation` + `/getTruckStation` | `vehicleStations` | 4s | Station data |
| `/getBelts` | `belts` | 120s | Belt infrastructure |
| `/getPipes` | `pipes` | 120s | Pipe infrastructure |
| `/getTrainRails` | `trainRails` | 120s | Rail network |
| `/getCables` | `cables` | 120s | Power cables |

### Redis Caching Strategy

When data is received from the FRM API:

1. **Cache Storage**: Data is cached in Redis with key pattern `state:{sessionID}:{eventType}`
   - Example: `state:abc123:circuits` contains circuit data for session abc123
   - No expiration - updated on each poll cycle

2. **Pub/Sub Publishing**: Events are published to `satisfactory_events:{sessionID}` channel
   - SSE clients subscribe to this channel for real-time updates

### GET Endpoint Data Source

**All GET endpoints read from Redis cache**, not directly from the FRM API:

```go
// Example: session/cache.go
func GetCachedState(sessionID string) *models.State {
    kvClient := key_value.New()
    // Load each field from cache
    getCached(models.SatisfactoryEventCircuits, &state.Circuits)
    getCached(models.SatisfactoryEventProdStats, &state.ProdStats)
    // ... etc
}
```

This design provides:
- **Consistent data**: All clients see the same cached data
- **Fast responses**: No blocking calls to external API
- **Offline resilience**: Cache serves stale data if FRM API is down

### Session Stage Tracking

Sessions have two stages (`models/session.go`):
- `init`: Session created but not all required data cached yet
- `ready`: All required event types have been cached at least once

```go
// session/cache.go
func GetSessionStage(sessionID string) models.SessionStage {
    for _, eventType := range models.RequiredEventTypes {
        key := fmt.Sprintf("state:%s:%s", sessionID, eventType)
        exists, _ := kvClient.IsSet(key)
        if !exists {
            return models.SessionStageInit
        }
    }
    return models.SessionStageReady
}
```

### Request Queue

The FRM client uses a `RequestQueue` (`service/frm_client/request_queue.go`) to prevent overwhelming the FRM API:
- Sequential request processing
- Deduplication of in-flight requests
- Graceful handling of slow endpoints

## Background Workers

**Session Manager** (`worker/session_manager.go`):

- Manages publisher lifecycle for all sessions
- Starts publishers for existing sessions on startup
- Watches for new/deleted/paused sessions every 5s
- Monitors session info changes (game session name updates)

```go
// Start session manager in main.go
go worker.SessionManagerWorker(ctx)
```

The SessionManager creates per-session polling loops that:
1. Create FRM client (real or mock based on session type)
2. Call `SetupEventStream` with callback handler
3. Cache received data and publish to Redis pub/sub

## Testing

Use mock client for testing:

```yaml
# config.local.yml
mock: true
```

```go
// service/mock_client provides static test data
svc := service.NewService(config)  // Uses mock_client when mock=true
```

## Logging

Structured logging with Zap:

```go
import "api/pkg/log"

log.Info("Processing request", zap.String("endpoint", "/circuits"))
log.Error("Failed to fetch data", zap.Error(err))
```

## Metrics

Prometheus metrics at `/internal/metrics`:

- HTTP request duration
- Request count by status
- Active connections

## Docker Build

```dockerfile
# Multi-stage build
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o main .

FROM alpine:latest
COPY --from=builder /app/main /app/
COPY --from=builder /app/docs /app/docs
COPY --from=builder /app/config.docker.yml /app/
CMD ["/app/main"]
```

## Related Documentation

- **Root CLAUDE.md**: Full-stack architecture overview
- **dashboard/CLAUDE.md**: Frontend architecture
- **Swagger UI**: `/v2/docs/` for API documentation
