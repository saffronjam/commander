package graph

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"api/internal/session"
	"api/internal/store"
	"api/models/models"
)

const settingsLogLevelKey = "log_level"

// StoreAdapter backs the GraphStore interface with the SQLite store, converting
// between the durable store types and the domain models the resolvers use.
type StoreAdapter struct {
	DB *store.DB
}

// NewStoreAdapter wraps a store.DB.
func NewStoreAdapter(db *store.DB) *StoreAdapter {
	return &StoreAdapter{DB: db}
}

func toModelsSession(s store.Session) models.Session {
	return models.Session{
		ID:        string(s.ID),
		Name:      s.Name,
		Address:   s.Address,
		SaveName:  s.SaveName,
		IsPaused:  s.IsPaused,
		CreatedAt: s.CreatedAt,
	}
}

// ListSessions returns the durable config for every session.
func (a *StoreAdapter) ListSessions(ctx context.Context) ([]models.Session, error) {
	rows, err := a.DB.ListSessions(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]models.Session, len(rows))
	for i, s := range rows {
		out[i] = toModelsSession(s)
	}
	return out, nil
}

// GetSession returns one session, or (nil, nil) if it does not exist.
func (a *StoreAdapter) GetSession(ctx context.Context, id session.ID) (*models.Session, error) {
	s, err := a.DB.GetSession(ctx, id)
	if errors.Is(err, store.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	m := toModelsSession(s)
	return &m, nil
}

// CreateSession generates an id, persists the config, and returns it.
func (a *StoreAdapter) CreateSession(ctx context.Context, in models.CreateSessionRequest) (*models.Session, error) {
	id := session.ID(uuid.New().String())
	if err := a.DB.CreateSession(ctx, id, in.Name, in.Address, in.SaveName); err != nil {
		return nil, err
	}
	return a.GetSession(ctx, id)
}

// UpdateSession applies the optional patch fields over the current config.
func (a *StoreAdapter) UpdateSession(ctx context.Context, id session.ID, in models.UpdateSessionRequest) (*models.Session, error) {
	cur, err := a.DB.GetSession(ctx, id)
	if errors.Is(err, store.ErrNotFound) {
		return nil, fmt.Errorf("session %s: %w", id, store.ErrNotFound)
	}
	if err != nil {
		return nil, err
	}
	name, address, isPaused := cur.Name, cur.Address, cur.IsPaused
	if in.Name != nil {
		name = *in.Name
	}
	if in.Address != nil {
		address = *in.Address
	}
	if in.IsPaused != nil {
		isPaused = *in.IsPaused
	}
	if err := a.DB.UpdateSession(ctx, id, name, address, isPaused); err != nil {
		return nil, err
	}
	return a.GetSession(ctx, id)
}

// DeleteSession removes a session (history cascades via FK).
func (a *StoreAdapter) DeleteSession(ctx context.Context, id session.ID) error {
	return a.DB.DeleteSession(ctx, id)
}

// GetSettings reads the log-level setting into a Settings value.
func (a *StoreAdapter) GetSettings(ctx context.Context) (*models.Settings, error) {
	s, err := a.DB.GetSetting(ctx, settingsLogLevelKey)
	if errors.Is(err, store.ErrNotFound) {
		return models.DefaultSettings(), nil
	}
	if err != nil {
		return nil, err
	}
	lvl := models.LogLevel(s.Value)
	if !lvl.IsValid() {
		lvl = models.LogLevelInfo
	}
	return &models.Settings{LogLevel: lvl}, nil
}

// UpdateSettings persists the log-level setting.
func (a *StoreAdapter) UpdateSettings(ctx context.Context, s models.Settings) (*models.Settings, error) {
	if err := a.DB.UpsertSetting(ctx, settingsLogLevelKey, string(s.LogLevel)); err != nil {
		return nil, err
	}
	return &s, nil
}

// QueryHistory passes through to the store's history query.
func (a *StoreAdapter) QueryHistory(ctx context.Context, q store.HistoryQuery) ([]store.HistoryPoint, error) {
	return a.DB.QueryHistory(ctx, q)
}
