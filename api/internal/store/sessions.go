package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"api/internal/session"
	"api/internal/store/sqlite"
)

// CreateSession inserts a new session configuration row.
func (s *DB) CreateSession(ctx context.Context, id session.ID, name, address string) error {
	if err := s.q.CreateSession(ctx, sqlite.CreateSessionParams{ID: id, Name: name, Address: address}); err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

// GetSession returns one session by id, or ErrNotFound.
func (s *DB) GetSession(ctx context.Context, id session.ID) (Session, error) {
	row, err := s.q.GetSession(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return Session{}, ErrNotFound
	}
	if err != nil {
		return Session{}, fmt.Errorf("get session: %w", err)
	}
	return sessionFromRow(row), nil
}

// ListSessions returns all sessions ordered by creation time.
func (s *DB) ListSessions(ctx context.Context) ([]Session, error) {
	rows, err := s.q.ListSessions(ctx)
	if err != nil {
		return nil, fmt.Errorf("list sessions: %w", err)
	}
	out := make([]Session, len(rows))
	for i, r := range rows {
		out[i] = sessionFromRow(r)
	}
	return out, nil
}

// UpdateSession applies the user-facing config patch.
func (s *DB) UpdateSession(ctx context.Context, id session.ID, name, address string, isPaused bool) error {
	if err := s.q.UpdateSession(ctx, sqlite.UpdateSessionParams{
		Name:     name,
		Address:  address,
		IsPaused: boolToInt64(isPaused),
		ID:       id,
	}); err != nil {
		return fmt.Errorf("update session: %w", err)
	}
	return nil
}

// UpdateSessionSaveName persists the active save name observed by the poller.
func (s *DB) UpdateSessionSaveName(ctx context.Context, id session.ID, saveName string) error {
	if err := s.q.UpdateSessionSaveName(ctx, sqlite.UpdateSessionSaveNameParams{
		SessionName: saveName,
		ID:          id,
	}); err != nil {
		return fmt.Errorf("update session save name: %w", err)
	}
	return nil
}

// DeleteSession removes a session; its history cascades away via the FK.
func (s *DB) DeleteSession(ctx context.Context, id session.ID) error {
	if err := s.q.DeleteSession(ctx, id); err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func sessionFromRow(r sqlite.Session) Session {
	return Session{
		ID:          r.ID,
		Name:        r.Name,
		Address:     r.Address,
		SessionName: r.SessionName,
		IsPaused:    int64ToBool(r.IsPaused),
		CreatedAt:   r.CreatedAt,
	}
}
