package store

import (
	"time"

	"api/internal/auth"
	"api/internal/session"
)

// Session is the durable session configuration. Runtime status (online,
// disconnected, stage) is poller in-memory state, not stored here. SaveName is
// the save the session is pinned to, fixed when the session is created.
type Session struct {
	ID        session.ID
	Name      string
	Address   string
	SaveName  string
	IsPaused  bool
	CreatedAt time.Time
}

// Setting is a single key/value configuration row.
type Setting struct {
	Key   string
	Value string
}

// AuthMode decides whether requests need an access token to be authorized.
type AuthMode string

const (
	// AuthModeOpen authorizes every request without a token.
	AuthModeOpen AuthMode = "open"
	// AuthModePassword requires a valid access token.
	AuthModePassword AuthMode = "password"
)

// Instance is the singleton instance-wide configuration. Initialized reports
// whether first-run setup has completed, which is what separates a fresh
// install from one deliberately running in open mode.
type Instance struct {
	Initialized        bool
	InitializedAt      time.Time
	AuthMode           AuthMode
	BootstrapTokenHash string
	CreatedAt          time.Time
}

// AuthPassword is the singleton shared-password row. It exists only while the
// instance runs in password mode.
type AuthPassword struct {
	Hash      string
	UpdatedAt time.Time
}

// Token is a stored access token with sliding-expiry metadata. Only the hash is
// persisted; the token itself lives in the client's cookie.
type Token struct {
	TokenHash auth.TokenHash
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

// HistoryQuery selects one (session, dataType) series. BucketSeconds > 0
// downsamples to the last point per bucket; Limit <= 0 means unlimited. When
// Limit trims the result the newest points are kept.
type HistoryQuery struct {
	SessionID     session.ID
	DataType      string
	Since         int64
	ToID          int64
	Limit         int
	BucketSeconds int
}
