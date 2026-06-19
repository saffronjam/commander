package store

import (
	"time"

	"api/internal/auth"
	"api/internal/session"
)

// Session is the durable session configuration. Runtime status (online,
// disconnected, stage) is poller in-memory state, not stored here.
type Session struct {
	ID          session.ID
	Name        string
	Address     string
	SessionName string
	IsPaused    bool
	CreatedAt   time.Time
}

// Setting is a single key/value configuration row.
type Setting struct {
	Key   string
	Value string
}

// AuthPassword is the singleton shared-password row.
type AuthPassword struct {
	Hash      string
	IsDefault bool
	UpdatedAt time.Time
}

// Token is a stored access token with sliding-expiry metadata.
type Token struct {
	Token     auth.Token
	CreatedAt time.Time
	LastUsed  time.Time
	ExpiresAt time.Time
	ClientIP  string
}

// HistoryPoint is one time-series sample: a game-time id and the opaque JSON
// payload. The resolver decodes Data per data_type into a typed point.
type HistoryPoint struct {
	GameTimeID int64
	Data       []byte
}

// HistoryQuery selects one (session, save, dataType) series. BucketSeconds > 0
// downsamples to the last point per bucket; Limit <= 0 means unlimited.
type HistoryQuery struct {
	SessionID     session.ID
	SaveName      string
	DataType      string
	Since         int64
	ToID          int64
	Limit         int
	BucketSeconds int
}
