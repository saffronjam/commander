package graph

import (
	"api/internal/graph/model"
	"api/models/models"
)

func toSession(in models.Session, stage models.SessionStage) *model.Session {
	return &model.Session{
		ID:              in.ID,
		Name:            in.Name,
		Address:         in.Address,
		SessionName:     in.SessionName,
		IsPaused:        in.IsPaused,
		CreatedAt:       in.CreatedAt,
		ConnectionState: toConnectionStateEnum(in.ConnectionState),
		Stage:           toSessionStageEnum(stage),
		OfflineReason:   toConnectivityReasonEnum(in.OfflineReason),
	}
}

func toSessionInfo(in models.SessionInfo) *model.SessionInfo {
	return &model.SessionInfo{
		SessionName:                in.SessionName,
		IsPaused:                   in.IsPaused,
		DayLength:                  in.DayLength,
		NightLength:                in.NightLength,
		PassedDays:                 in.PassedDays,
		NumberOfDaysSinceLastDeath: in.NumberOfDaysSinceLastDeath,
		Hours:                      in.Hours,
		Minutes:                    in.Minutes,
		Seconds:                    in.Seconds,
		IsDay:                      in.IsDay,
		TotalPlayDuration:          in.TotalPlayDuration,
		TotalPlayDurationText:      in.TotalPlayDurationText,
	}
}

func toSatisfactoryApiStatus(in models.SatisfactoryApiStatus) *model.SatisfactoryAPIStatus {
	return &model.SatisfactoryAPIStatus{
		Running: in.Running,
		PingMs:  in.PingMS,
	}
}

func toConnectivityStatus(state models.ConnectionState, stage models.SessionStage, reason models.ConnectivityReason) *model.ConnectivityStatus {
	return &model.ConnectivityStatus{
		ConnectionState: toConnectionStateEnum(state),
		Stage:           toSessionStageEnum(stage),
		Reason:          toConnectivityReasonEnum(reason),
	}
}

func toConnectionStateEnum(in models.ConnectionState) model.ConnectionState {
	switch in {
	case models.ConnectionStateOnline:
		return model.ConnectionStateOnline
	case models.ConnectionStateOffline:
		return model.ConnectionStateOffline
	default:
		return model.ConnectionStateConnecting
	}
}

func toConnectivityReasonEnum(in models.ConnectivityReason) model.ConnectivityReason {
	switch in {
	case models.ConnectivityReasonNoResponse:
		return model.ConnectivityReasonNoResponse
	case models.ConnectivityReasonBadResponse:
		return model.ConnectivityReasonBadResponse
	default:
		return model.ConnectivityReasonNone
	}
}

func toSettings(in models.Settings) *model.Settings {
	return &model.Settings{
		LogLevel: toLogLevelEnum(in.LogLevel),
	}
}

func toSessionStageEnum(in models.SessionStage) model.SessionStage {
	switch in {
	case models.SessionStageInit:
		return model.SessionStageInit
	case models.SessionStageReady:
		return model.SessionStageReady
	default:
		return model.SessionStageInit
	}
}

func toLogLevelEnum(in models.LogLevel) model.LogLevel {
	switch in {
	case models.LogLevelTrace:
		return model.LogLevelTrace
	case models.LogLevelDebug:
		return model.LogLevelDebug
	case models.LogLevelInfo:
		return model.LogLevelInfo
	case models.LogLevelWarning:
		return model.LogLevelWarning
	case models.LogLevelError:
		return model.LogLevelError
	default:
		return model.LogLevelInfo
	}
}

func fromLogLevelEnum(in model.LogLevel) models.LogLevel {
	switch in {
	case model.LogLevelTrace:
		return models.LogLevelTrace
	case model.LogLevelDebug:
		return models.LogLevelDebug
	case model.LogLevelInfo:
		return models.LogLevelInfo
	case model.LogLevelWarning:
		return models.LogLevelWarning
	case model.LogLevelError:
		return models.LogLevelError
	default:
		return models.LogLevelInfo
	}
}
