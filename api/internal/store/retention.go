package store

import (
	"context"
	"log/slog"
	"strconv"
	"time"

	"api/internal/session"
)

// TokenPruneStore is the slice of the store the token pruner needs.
type TokenPruneStore interface {
	RunTokenPrune(ctx context.Context, now time.Time) (int64, error)
}

// RunTokenPrune deletes expired auth tokens on a fixed interval (~1h). Lazy
// expiry on read already rejects them; this reclaims the rows. It blocks until
// ctx is cancelled.
func RunTokenPrune(ctx context.Context, logger *slog.Logger, store TokenPruneStore, interval time.Duration) {
	if interval <= 0 {
		interval = time.Hour
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := store.RunTokenPrune(ctx, time.Now()); err != nil {
				logger.Error("token prune failed", "error", err)
			}
		}
	}
}

// HistorySeriesKey identifies one (session, save, dataType) time series.
type HistorySeriesKey struct {
	SessionID session.ID
	SaveName  string
	DataType  string
}

// HistoryFrontier reports the latest game time observed per active series. It is
// implemented by the poller, which is the only source of current game time.
type HistoryFrontier interface {
	Series() []HistorySeriesKey
	CurrentGameTime(key HistorySeriesKey) int64
}

// HistoryRetentionStore is the slice of the store the history pruner needs.
type HistoryRetentionStore interface {
	GetSetting(ctx context.Context, key string) (Setting, error)
	PruneHistoryOlderThan(ctx context.Context, sessionID session.ID, saveName, dataType string, cutoff int64) (int64, error)
}

// RunHistoryRetention prunes each active series to currentGameTime - window on a
// fixed interval. The window is re-read from settings every tick so the stored
// SD_MAX_SAMPLE_GAME_DURATION value can change without a restart. window <= 0
// disables pruning. It blocks until ctx is cancelled.
func RunHistoryRetention(ctx context.Context, logger *slog.Logger, store HistoryRetentionStore, frontier HistoryFrontier, interval time.Duration) {
	if interval <= 0 {
		interval = time.Minute
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			window := historyWindow(ctx, store)
			if window <= 0 {
				continue
			}
			for _, key := range frontier.Series() {
				cutoff := frontier.CurrentGameTime(key) - window
				if cutoff <= 0 {
					continue
				}
				if _, err := store.PruneHistoryOlderThan(ctx, key.SessionID, key.SaveName, key.DataType, cutoff); err != nil {
					logger.Error("prune history failed",
						"session", string(key.SessionID), "save", key.SaveName, "type", key.DataType, "error", err)
				}
			}
		}
	}
}

func historyWindow(ctx context.Context, store HistoryRetentionStore) int64 {
	setting, err := store.GetSetting(ctx, "history.max_sample_game_duration")
	if err != nil {
		return 0
	}
	n, err := strconv.ParseInt(setting.Value, 10, 64)
	if err != nil || n < 0 {
		return 0
	}
	return n
}
