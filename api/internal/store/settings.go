package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"api/internal/store/sqlite"
)

// GetSetting returns one setting by key, or ErrNotFound.
func (s *DB) GetSetting(ctx context.Context, key string) (Setting, error) {
	row, err := s.q.GetSetting(ctx, key)
	if errors.Is(err, sql.ErrNoRows) {
		return Setting{}, ErrNotFound
	}
	if err != nil {
		return Setting{}, fmt.Errorf("get setting: %w", err)
	}
	return Setting{Key: row.Key, Value: row.Value}, nil
}

// ListSettings returns all settings.
func (s *DB) ListSettings(ctx context.Context) ([]Setting, error) {
	rows, err := s.q.ListSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("list settings: %w", err)
	}
	out := make([]Setting, len(rows))
	for i, r := range rows {
		out[i] = Setting{Key: r.Key, Value: r.Value}
	}
	return out, nil
}

// UpsertSetting inserts or updates a setting.
func (s *DB) UpsertSetting(ctx context.Context, key, value string) error {
	if err := s.q.UpsertSetting(ctx, sqlite.UpsertSettingParams{Key: key, Value: value}); err != nil {
		return fmt.Errorf("upsert setting: %w", err)
	}
	return nil
}
