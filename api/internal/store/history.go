package store

import (
	"context"
	"fmt"

	"api/internal/session"
	"api/internal/store/sqlite"
)

const maxGameTimeID = int64(1) << 62

// UpsertHistoryPoint writes one history sample, overwriting any existing point
// at the same game time (save-rollback dedup).
func (s *DB) UpsertHistoryPoint(ctx context.Context, sessionID session.ID, saveName, dataType string, gameTimeID int64, data []byte) error {
	if err := s.q.UpsertHistoryPoint(ctx, sqlite.UpsertHistoryPointParams{
		SessionID:  sessionID,
		SaveName:   saveName,
		DataType:   dataType,
		GameTimeID: gameTimeID,
		Data:       string(data),
	}); err != nil {
		return fmt.Errorf("upsert history point: %w", err)
	}
	return nil
}

// ListHistorySaves returns the distinct save names recorded for a session.
func (s *DB) ListHistorySaves(ctx context.Context, sessionID session.ID) ([]string, error) {
	saves, err := s.q.ListHistorySaves(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("list history saves: %w", err)
	}
	return saves, nil
}

// GetLatestGameTimeID returns the highest game-time id stored for one series,
// or 0 if the series is empty.
func (s *DB) GetLatestGameTimeID(ctx context.Context, sessionID session.ID, saveName, dataType string) (int64, error) {
	latest, err := s.q.GetLatestGameTimeId(ctx, sqlite.GetLatestGameTimeIdParams{
		SessionID: sessionID,
		SaveName:  saveName,
		DataType:  dataType,
	})
	if err != nil {
		return 0, fmt.Errorf("get latest game time id: %w", err)
	}
	return latest, nil
}

// QueryHistory returns points for one series. BucketSeconds > 0 downsamples to
// the last point per bucket; otherwise raw points are returned ascending.
func (s *DB) QueryHistory(ctx context.Context, q HistoryQuery) ([]HistoryPoint, error) {
	toID := q.ToID
	if toID <= 0 {
		toID = maxGameTimeID
	}
	if q.BucketSeconds > 0 {
		rows, err := s.q.QueryHistoryBucketed(ctx, sqlite.QueryHistoryBucketedParams{
			BucketSeconds: int64(q.BucketSeconds),
			SessionID:     q.SessionID,
			SaveName:      q.SaveName,
			DataType:      q.DataType,
			Since:         q.Since,
			ToID:          toID,
		})
		if err != nil {
			return nil, fmt.Errorf("query history bucketed: %w", err)
		}
		return bucketedToHistoryPoints(rows), nil
	}
	rows, err := s.q.QueryHistoryRaw(ctx, sqlite.QueryHistoryRawParams{
		SessionID: q.SessionID,
		SaveName:  q.SaveName,
		DataType:  q.DataType,
		Since:     q.Since,
		ToID:      toID,
		Lim:       int64(q.Limit),
	})
	if err != nil {
		return nil, fmt.Errorf("query history raw: %w", err)
	}
	return rawToHistoryPoints(rows), nil
}

// PruneHistoryOlderThan deletes points below the game-time cutoff for one
// series and returns the number removed.
func (s *DB) PruneHistoryOlderThan(ctx context.Context, sessionID session.ID, saveName, dataType string, cutoff int64) (int64, error) {
	n, err := s.q.PruneHistoryOlderThan(ctx, sqlite.PruneHistoryOlderThanParams{
		SessionID: sessionID,
		SaveName:  saveName,
		DataType:  dataType,
		Cutoff:    cutoff,
	})
	if err != nil {
		return 0, fmt.Errorf("prune history: %w", err)
	}
	return n, nil
}
