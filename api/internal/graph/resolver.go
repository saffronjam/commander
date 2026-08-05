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

	ListHistorySaves(ctx context.Context, sessionID session.ID) ([]string, error)
	QueryHistory(ctx context.Context, q store.HistoryQuery) ([]store.HistoryPoint, error)
}

// Snapshotter reads the poller's in-memory latest state and derived status.
type Snapshotter interface {
	Latest(sessionID session.ID, dataType string) (any, bool)
	CurrentSaveName(sessionID session.ID) string
	Stage(sessionID session.ID) models.SessionStage
	Connectivity(sessionID session.ID) models.ConnectivityStatus
}

// Poller covers lifecycle + live-probe operations.
type Poller interface {
	PreviewSession(ctx context.Context, address string) (models.SessionInfo, error)
	ValidateSession(ctx context.Context, id session.ID) (models.SessionInfo, error)
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
