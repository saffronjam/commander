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
		s.ConnectionState = cs.State
		s.OfflineReason = cs.Reason
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
	state := r.Auth.State()
	return &model.AuthStatus{
		Initialized:   state.Initialized,
		AuthRequired:  state.AuthRequired(),
		Authenticated: ok && caller.Authenticated,
	}, nil
}

func (r *queryResolver) ClientIP(ctx context.Context) (string, error) {
	return ClientIPFromContext(ctx), nil
}

// --- Mutation (config + auth) ---

func (r *mutationResolver) Login(ctx context.Context, input model.LoginInput) (*model.LoginResult, error) {
	token, err := r.Auth.Login(ClientIPFromContext(ctx), input.Password)
	if err != nil {
		return &model.LoginResult{Success: false, Message: err.Error()}, nil
	}
	if token == "" {
		return &model.LoginResult{Success: false, Message: "Incorrect access key"}, nil
	}
	setAuthCookie(ctx, token, authsvc.GetTokenTTL())
	return &model.LoginResult{Success: true, Message: ""}, nil
}

func (r *mutationResolver) Logout(ctx context.Context) (*model.LogoutResult, error) {
	if c := accessTokenFromContext(ctx); c != "" {
		if err := r.Auth.DeleteToken(c); err != nil {
			log.Warnf("failed to revoke token on logout: %s", err.Error())
		}
	}
	clearAuthCookie(ctx)
	return &model.LogoutResult{Success: true}, nil
}

// CompleteSetup claims an instance that has not been set up. It is deliberately
// unguarded — there is no way to authenticate before setup — so the setup token,
// the single-use check, and the rate limiter carry the whole burden.
func (r *mutationResolver) CompleteSetup(ctx context.Context, input model.CompleteSetupInput) (*model.SetupResult, error) {
	password := input.Password.Value()
	if password != nil && *password == "" {
		password = nil
	}

	if err := r.Auth.CompleteSetup(ClientIPFromContext(ctx), input.SetupToken, password); err != nil {
		return &model.SetupResult{Success: false, Message: err.Error()}, nil
	}

	// Setting a key during setup means the operator wants to be logged in with
	// it, rather than bounced to a login screen straight after.
	if password != nil {
		token, err := r.Auth.Login(ClientIPFromContext(ctx), *password)
		if err == nil && token != "" {
			setAuthCookie(ctx, token, authsvc.GetTokenTTL())
		}
	}
	return &model.SetupResult{Success: true, Message: ""}, nil
}

func (r *mutationResolver) EnableAuth(ctx context.Context, input model.EnableAuthInput) (*model.ChangePasswordResult, error) {
	if err := r.Auth.EnableAuth(input.Password); err != nil {
		return &model.ChangePasswordResult{Success: false, Message: err.Error()}, nil
	}
	// Enabling auth revoked every session including this one, so hand the caller
	// a token for the key they just set.
	if token, err := r.Auth.Login(ClientIPFromContext(ctx), input.Password); err == nil && token != "" {
		setAuthCookie(ctx, token, authsvc.GetTokenTTL())
	}
	return &model.ChangePasswordResult{Success: true, Message: "access key set"}, nil
}

func (r *mutationResolver) DisableAuth(ctx context.Context, input model.DisableAuthInput) (*model.ChangePasswordResult, error) {
	if err := r.Auth.DisableAuth(input.CurrentPassword); err != nil {
		return &model.ChangePasswordResult{Success: false, Message: err.Error()}, nil
	}
	clearAuthCookie(ctx)
	return &model.ChangePasswordResult{Success: true, Message: "access key removed"}, nil
}

func (r *mutationResolver) ChangePassword(ctx context.Context, input model.ChangePasswordInput) (*model.ChangePasswordResult, error) {
	if err := r.Auth.ChangePassword(input.CurrentPassword, input.NewPassword); err != nil {
		return &model.ChangePasswordResult{Success: false, Message: err.Error()}, nil
	}
	// The change revoked every session, so re-issue one for this caller.
	if token, err := r.Auth.Login(ClientIPFromContext(ctx), input.NewPassword); err == nil && token != "" {
		setAuthCookie(ctx, token, authsvc.GetTokenTTL())
	}
	return &model.ChangePasswordResult{Success: true, Message: "access key changed"}, nil
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
	// Pointing a session at a different server has to drop the old connection
	// and dial the new one; the poller decides whether anything actually changed.
	if r.Poller != nil {
		r.Poller.RestartSession(session.ID(id))
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
