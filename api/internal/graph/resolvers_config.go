package graph

import (
	"context"

	authctx "api/internal/auth"
	"api/internal/graph/model"
	"api/internal/session"
	"api/models/models"
	"api/pkg/log"
	authsvc "api/service/auth"
)

func (r *Resolver) sessionWithStatus(s models.Session) *model.Session {
	stage := models.SessionStageInit
	if r.Snapshot != nil {
		cs := r.Snapshot.Connectivity(session.ID(s.ID))
		s.IsOnline = cs.IsOnline
		s.IsDisconnected = cs.IsDisconnected
		stage = cs.Stage
	}
	return toSession(s, stage)
}

// --- Query (config) ---

func (r *queryResolver) Sessions(ctx context.Context) ([]*model.Session, error) {
	sessions, err := r.Store.ListSessions(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*model.Session, 0, len(sessions))
	for _, s := range sessions {
		out = append(out, r.sessionWithStatus(s))
	}
	return out, nil
}

func (r *queryResolver) Session(ctx context.Context, id string) (*model.Session, error) {
	s, err := r.Store.GetSession(ctx, session.ID(id))
	if err != nil {
		return nil, err
	}
	if s == nil {
		return nil, nil
	}
	return r.sessionWithStatus(*s), nil
}

func (r *queryResolver) PreviewSession(ctx context.Context, address string) (*model.SessionInfo, error) {
	info, err := r.Poller.PreviewSession(ctx, address)
	if err != nil {
		return nil, err
	}
	return toSessionInfo(info), nil
}

func (r *queryResolver) Settings(ctx context.Context) (*model.Settings, error) {
	s, err := r.Store.GetSettings(ctx)
	if err != nil {
		return nil, err
	}
	return toSettings(*s), nil
}

func (r *queryResolver) AuthStatus(ctx context.Context) (*model.AuthStatus, error) {
	caller, ok := authctx.UserFromContext(ctx)
	usedDefault := false
	if r.Auth != nil {
		usedDefault = r.Auth.IsUsingDefaultPassword()
	}
	return &model.AuthStatus{
		Authenticated:       ok && caller.Authenticated,
		UsedDefaultPassword: usedDefault,
	}, nil
}

func (r *queryResolver) ClientIP(ctx context.Context) (string, error) {
	return ClientIPFromContext(ctx), nil
}

// --- Mutation (config + auth) ---

func (r *mutationResolver) Login(ctx context.Context, input model.LoginInput) (*model.LoginResult, error) {
	valid, err := r.Auth.ValidatePassword(input.Password)
	if err != nil {
		return nil, err
	}
	if !valid {
		return &model.LoginResult{Success: false, UsedDefaultPassword: false}, nil
	}
	token, err := r.Auth.GenerateToken()
	if err != nil {
		return nil, err
	}
	if err := r.Auth.StoreToken(token, ClientIPFromContext(ctx)); err != nil {
		return nil, err
	}
	setAuthCookie(ctx, token, authsvc.GetTokenTTL())
	return &model.LoginResult{Success: true, UsedDefaultPassword: r.Auth.IsUsingDefaultPassword()}, nil
}

func (r *mutationResolver) Logout(ctx context.Context) (*model.LogoutResult, error) {
	clearAuthCookie(ctx)
	return &model.LogoutResult{Success: true}, nil
}

func (r *mutationResolver) ChangePassword(ctx context.Context, input model.ChangePasswordInput) (*model.ChangePasswordResult, error) {
	if err := r.Auth.ChangePassword(input.CurrentPassword, input.NewPassword); err != nil {
		return &model.ChangePasswordResult{Success: false, Message: err.Error()}, nil
	}
	return &model.ChangePasswordResult{Success: true, Message: "password changed"}, nil
}

func (r *mutationResolver) CreateSession(ctx context.Context, input model.CreateSessionInput) (*model.Session, error) {
	s, err := r.Store.CreateSession(ctx, models.CreateSessionRequest{Name: input.Name, Address: input.Address})
	if err != nil {
		return nil, err
	}
	if r.Poller != nil {
		r.Poller.StartSession(session.ID(s.ID))
	}
	return r.sessionWithStatus(*s), nil
}

func (r *mutationResolver) UpdateSession(ctx context.Context, id string, input model.UpdateSessionInput) (*model.Session, error) {
	s, err := r.Store.UpdateSession(ctx, session.ID(id), models.UpdateSessionRequest{
		Name:     input.Name.Value(),
		IsPaused: input.IsPaused.Value(),
		Address:  input.Address.Value(),
	})
	if err != nil {
		return nil, err
	}
	return r.sessionWithStatus(*s), nil
}

func (r *mutationResolver) DeleteSession(ctx context.Context, id string) (bool, error) {
	if r.Poller != nil {
		r.Poller.StopSession(session.ID(id))
	}
	if err := r.Store.DeleteSession(ctx, session.ID(id)); err != nil {
		return false, err
	}
	return true, nil
}

func (r *mutationResolver) ValidateSession(ctx context.Context, id string) (*model.SessionInfo, error) {
	info, err := r.Poller.ValidateSession(ctx, session.ID(id))
	if err != nil {
		return nil, err
	}
	return toSessionInfo(info), nil
}

func (r *mutationResolver) UpdateSettings(ctx context.Context, input model.UpdateSettingsInput) (*model.Settings, error) {
	s, err := r.Store.UpdateSettings(ctx, models.Settings{LogLevel: fromLogLevelEnum(input.LogLevel)})
	if err != nil {
		return nil, err
	}
	if zapLevel, lerr := s.LogLevel.ToZapLevel(); lerr == nil {
		log.SetLogLevel(zapLevel)
	}
	return toSettings(*s), nil
}
