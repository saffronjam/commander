package graph

import (
	"context"

	"api/internal/session"
	"api/internal/store"
	"api/models/models"
	"api/pkg/config"
	"api/pkg/eventbus"
	"api/service/auth"
)

// GraphStore is the slice of the SQLite store the resolvers call. *StoreAdapter
// (backed by *store.DB) satisfies it.
type GraphStore interface {
	ListSessions(ctx context.Context) ([]models.Session, error)
	GetSession(ctx context.Context, id session.ID) (*models.Session, error)
	CreateSession(ctx context.Context, in models.CreateSessionRequest) (*models.Session, error)
	UpdateSession(ctx context.Context, id session.ID, in models.UpdateSessionRequest) (*models.Session, error)
	DeleteSession(ctx context.Context, id session.ID) error

	GetSettings(ctx context.Context) (*models.Settings, error)
	UpdateSettings(ctx context.Context, s models.Settings) (*models.Settings, error)

	QueryHistory(ctx context.Context, q store.HistoryQuery) ([]store.HistoryPoint, error)
}

// Snapshotter reads the poller's in-memory latest state and derived status.
type Snapshotter interface {
	Latest(sessionID session.ID, dataType string) (any, bool)
	Stage(sessionID session.ID) models.SessionStage
	Connectivity(sessionID session.ID) models.ConnectivityStatus
}

// Poller covers lifecycle + live-probe operations.
type Poller interface {
	PreviewSession(ctx context.Context, address string) (models.SessionInfo, error)
	// DiscoverSessions sweeps the caller's network for FRM servers. ports carries
	// the ports already in use by existing sessions, which are swept alongside the
	// default.
	DiscoverSessions(ctx context.Context, clientIP string, ports []int) ([]models.DiscoveredServer, error)
	StartSession(id session.ID)
	StopSession(id session.ID)
	// RestartSession reconnects a session after its address changed. It is a
	// no-op when the address is unchanged.
	RestartSession(id session.ID)
}

// Resolver is the gqlgen root resolver holding all dependencies.
type Resolver struct {
	Store    GraphStore
	Snapshot Snapshotter
	Poller   Poller
	EventBus eventbus.Subscriber
	Auth     *auth.Service
	Config   *config.Type
}
