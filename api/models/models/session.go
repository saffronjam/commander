package models

import "time"

// SessionStage represents the initialization stage of a session
type SessionStage string

const (
	SessionStageInit  SessionStage = "init"
	SessionStageReady SessionStage = "ready"
)

// RequiredEventTypes lists all event types that must be cached for a session to be "ready"
var RequiredEventTypes = []SatisfactoryEventType{
	SatisfactoryEventApiStatus,
	SatisfactoryEventCircuits,
	SatisfactoryEventFactoryStats,
	SatisfactoryEventProdStats,
	SatisfactoryEventGeneratorStats,
	SatisfactoryEventSinkStats,
	SatisfactoryEventPlayers,
	SatisfactoryEventBelts,
	SatisfactoryEventPipes,
	SatisfactoryEventTrainRails,
	SatisfactoryEventCables,
}

// Session represents a Satisfactory server connection target
type Session struct {
	ID                  string             `json:"id"`                 // UUID
	Name                string             `json:"name"`               // User-provided display name
	Address             string             `json:"address"`            // IP:port (e.g., "192.168.1.100:8080")
	SaveName            string             `json:"saveName"`           // The save this session is pinned to
	IsOnline            bool               `json:"isOnline"`           // Current connection status
	ConnectionState     ConnectionState    `json:"connectionState"`    // Authoritative connection state
	MismatchedSaveName  string             `json:"mismatchedSaveName"` // Save the server has loaded instead, when it differs
	IsPaused            bool               `json:"isPaused"`           // True if polling is paused by user
	IsDisconnected      bool               `json:"isDisconnected"`     // True if session has failed to connect multiple times
	OfflineReason       ConnectivityReason `json:"offlineReason"`      // Why the session is unreachable
	ConsecutiveFailures int                `json:"-"`                  // Transient counter for consecutive connection failures
	CreatedAt           time.Time          `json:"createdAt"`
}

// SessionInfoRaw represents the raw response from Satisfactory's getSessionInfo endpoint (PascalCase)
type SessionInfoRaw struct {
	SessionName                string  `json:"SessionName"`
	IsPaused                   bool    `json:"IsPaused"`
	DayLength                  int     `json:"DayLength"`
	NightLength                int     `json:"NightLength"`
	PassedDays                 int     `json:"PassedDays"`
	NumberOfDaysSinceLastDeath int     `json:"NumberOfDaysSinceLastDeath"`
	Hours                      int     `json:"Hours"`
	Minutes                    int     `json:"Minutes"`
	Seconds                    float64 `json:"Seconds"`
	IsDay                      bool    `json:"IsDay"`
	TotalPlayDuration          int     `json:"TotalPlayDuration"`
	TotalPlayDurationText      string  `json:"TotalPlayDurationText"`
}

// SessionInfo is the normalized DTO sent to the frontend (camelCase)
type SessionInfo struct {
	SaveName                   string  `json:"saveName"`
	IsPaused                   bool    `json:"isPaused"`
	DayLength                  int     `json:"dayLength"`
	NightLength                int     `json:"nightLength"`
	PassedDays                 int     `json:"passedDays"`
	NumberOfDaysSinceLastDeath int     `json:"numberOfDaysSinceLastDeath"`
	Hours                      int     `json:"hours"`
	Minutes                    int     `json:"minutes"`
	Seconds                    float64 `json:"seconds"`
	IsDay                      bool    `json:"isDay"`
	TotalPlayDuration          int     `json:"totalPlayDuration"`
	TotalPlayDurationText      string  `json:"totalPlayDurationText"`
}

// ToDTO converts raw FRM API response to the normalized DTO
func (r *SessionInfoRaw) ToDTO() *SessionInfo {
	return &SessionInfo{
		SaveName:                   r.SessionName,
		IsPaused:                   r.IsPaused,
		DayLength:                  r.DayLength,
		NightLength:                r.NightLength,
		PassedDays:                 r.PassedDays,
		NumberOfDaysSinceLastDeath: r.NumberOfDaysSinceLastDeath,
		Hours:                      r.Hours,
		Minutes:                    r.Minutes,
		Seconds:                    r.Seconds,
		IsDay:                      r.IsDay,
		TotalPlayDuration:          r.TotalPlayDuration,
		TotalPlayDurationText:      r.TotalPlayDurationText,
	}
}

// DiscoveredServer is one FRM server found by sweeping the network.
type DiscoveredServer struct {
	Address string      `json:"address"`
	Info    SessionInfo `json:"info"`
	// AlreadyAdded is true when a session already exists for this server.
	AlreadyAdded bool `json:"alreadyAdded"`
}

// CreateSessionRequest is the request body for creating a new session
type CreateSessionRequest struct {
	Name     string `json:"name" binding:"required"`
	Address  string `json:"address" binding:"required"`
	SaveName string `json:"saveName" binding:"required"`
}

// UpdateSessionRequest is the request body for updating a session (all fields optional)
type UpdateSessionRequest struct {
	Name     *string `json:"name,omitempty"`
	IsPaused *bool   `json:"isPaused,omitempty"`
	Address  *string `json:"address,omitempty"`
}

// SessionDTO is the data transfer object for Session with computed fields
type SessionDTO struct {
	ID                 string             `json:"id"`
	Name               string             `json:"name"`
	Address            string             `json:"address"`
	SaveName           string             `json:"saveName"`
	ConnectionState    ConnectionState    `json:"connectionState"`
	MismatchedSaveName string             `json:"mismatchedSaveName"`
	IsPaused           bool               `json:"isPaused"`
	OfflineReason      ConnectivityReason `json:"offlineReason"`
	CreatedAt          time.Time          `json:"createdAt"`
	Stage              SessionStage       `json:"stage"`
}

// ToDTO converts Session to SessionDTO with computed stage field
func (s *Session) ToDTO(stage SessionStage) SessionDTO {
	return SessionDTO{
		ID:                 s.ID,
		Name:               s.Name,
		Address:            s.Address,
		SaveName:           s.SaveName,
		ConnectionState:    s.ConnectionState,
		MismatchedSaveName: s.MismatchedSaveName,
		IsPaused:           s.IsPaused,
		OfflineReason:      s.OfflineReason,
		CreatedAt:          s.CreatedAt,
		Stage:              stage,
	}
}
