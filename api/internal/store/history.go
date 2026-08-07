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
func (s *DB) UpsertHistoryPoint(ctx context.Context, sessionID session.ID, dataType string, gameTimeID int64, data []byte) error {
	if err := s.q.UpsertHistoryPoint(ctx, sqlite.UpsertHistoryPointParams{
		SessionID:  sessionID,
		DataType:   dataType,
		GameTimeID: gameTimeID,
		Data:       string(data),
	}); err != nil {
		return fmt.Errorf("upsert history point: %w", err)
	}
	return nil
}

// QueryHistory returns points for one series. BucketSeconds > 0 downsamples to
// the last point per bucket; otherwise raw points are returned ascending. Both
// forms keep the newest points when Limit trims the result.
func (s *DB) QueryHistory(ctx context.Context, q HistoryQuery) ([]HistoryPoint, error) {
	toID := q.ToID
	if toID <= 0 {
		toID = maxGameTimeID
	}
	if q.BucketSeconds > 0 {
		rows, err := s.q.QueryHistoryBucketed(ctx, sqlite.QueryHistoryBucketedParams{
			BucketSeconds: int64(q.BucketSeconds),
			SessionID:     q.SessionID,
			DataType:      q.DataType,
			Since:         q.Since,
			ToID:          toID,
			Lim:           int64(q.Limit),
		})
		if err != nil {
			return nil, fmt.Errorf("query history bucketed: %w", err)
		}
		return bucketedToHistoryPoints(rows), nil
	}
	rows, err := s.q.QueryHistoryRaw(ctx, sqlite.QueryHistoryRawParams{
		SessionID: q.SessionID,
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
func (s *DB) PruneHistoryOlderThan(ctx context.Context, sessionID session.ID, dataType string, cutoff int64) (int64, error) {
	n, err := s.q.PruneHistoryOlderThan(ctx, sqlite.PruneHistoryOlderThanParams{
		SessionID: sessionID,
		DataType:  dataType,
		Cutoff:    cutoff,
	})
	if err != nil {
		return 0, fmt.Errorf("prune history: %w", err)
	}
	return n, nil
}
