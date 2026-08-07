package graph

import (
	"context"
	"errors"
	"fmt"

	"github.com/vektah/gqlparser/v2/gqlerror"

	"api/service/frm_client"

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
		s.MismatchedSaveName = cs.MismatchedSaveName
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

// probeError converts a failed probe into a client-renderable error. The reason
// is the same enum a live session reports, so the client reuses one set of copy
// instead of showing a Go error string; the technical cause rides along in
// detail for the browser console.
func probeError(address string, err error) error {
	reason := models.ConnectivityReasonNoResponse
	var probeErr *frm_client.ProbeError
	if errors.As(err, &probeErr) {
		reason = probeErr.Reason
	}
	return &gqlerror.Error{
		Message: fmt.Sprintf("could not reach FRM at %s", address),
		Extensions: map[string]any{
			"code":   "FRM_UNREACHABLE",
			"reason": toConnectivityReasonEnum(reason).String(),
			"detail": err.Error(),
		},
	}
}

func (r *queryResolver) PreviewSession(ctx context.Context, address string) (*model.SessionInfo, error) {
	info, err := r.Poller.PreviewSession(ctx, address)
	if err != nil {
		return nil, probeError(address, err)
	}
	return toSessionInfo(info), nil
}

// discoveryError names why a sweep could not run, so the client can explain it
// rather than showing a bare message.
func discoveryError(err error) error {
	code := "DISCOVERY_FAILED"
	switch {
	case errors.Is(err, frm_client.ErrNoPrivateNetwork):
		code = "DISCOVERY_NO_NETWORK"
	case errors.Is(err, frm_client.ErrScanTooLarge):
		code = "DISCOVERY_TOO_LARGE"
	}
	return &gqlerror.Error{
		Message:    err.Error(),
		Extensions: map[string]any{"code": code},
	}
}

// DiscoverSessions sweeps the caller's network for FRM servers.
//
// alreadyAdded is decided here rather than by the client because addresses are
// stored exactly as they were typed, so the same server may already be recorded
// under a different spelling; both sides are normalized before comparing.
func (r *queryResolver) DiscoverSessions(ctx context.Context) ([]*model.DiscoveredSession, error) {
	sessions, err := r.Store.ListSessions(ctx)
	if err != nil {
		return nil, err
	}

	existing, ports := discoveryInputs(sessions)

	found, err := r.Poller.DiscoverSessions(ctx, ClientIPFromContext(ctx), ports)
	if err != nil {
		return nil, discoveryError(err)
	}
	return markDiscovered(found, existing), nil
}

// discoveryInputs derives what the sweep needs from the sessions that exist: the
// ports worth trying alongside the default, and the addresses a result should be
// marked against.
func discoveryInputs(sessions []models.Session) (map[string]struct{}, []int) {
	existing := make(map[string]struct{}, len(sessions))
	var ports []int
	for _, s := range sessions {
		existing[frm_client.NormalizeAddress(s.Address)] = struct{}{}
		if port := frm_client.PortOf(s.Address); port > 0 {
			ports = append(ports, port)
		}
	}
	return existing, ports
}

// markDiscovered flags the servers a session already covers.
func markDiscovered(found []models.DiscoveredServer, existing map[string]struct{}) []*model.DiscoveredSession {
	out := make([]*model.DiscoveredSession, 0, len(found))
	for _, server := range found {
		_, added := existing[frm_client.NormalizeAddress(server.Address)]
		out = append(out, &model.DiscoveredSession{
			Address:      server.Address,
			Info:         toSessionInfo(server.Info),
			AlreadyAdded: added,
		})
	}
	return out
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

// saveNameMismatchError reports that the server is not running the save the
// client confirmed. The code lets the client branch without matching on prose.
func saveNameMismatchError(expected, observed string) error {
	return &gqlerror.Error{
		Message: fmt.Sprintf("the server is running %q, not %q", observed, expected),
		Extensions: map[string]any{
			"code":             "SAVE_NAME_MISMATCH",
			"observedSaveName": observed,
		},
	}
}

// pinnedSaveName re-probes the address and confirms it still has the save the
// client saw. Probing server-side closes the window between the client's probe
// and this mutation, so a session can never be pinned to a save nobody confirmed.
func (r *mutationResolver) pinnedSaveName(ctx context.Context, address, expected string) (string, error) {
	info, err := r.Poller.PreviewSession(ctx, address)
	if err != nil {
		return "", probeError(address, err)
	}
	if info.SaveName != expected {
		return "", saveNameMismatchError(expected, info.SaveName)
	}
	return info.SaveName, nil
}

func (r *mutationResolver) CreateSession(ctx context.Context, input model.CreateSessionInput) (*model.Session, error) {
	saveName, err := r.pinnedSaveName(ctx, input.Address, input.ExpectedSaveName)
	if err != nil {
		return nil, err
	}
	s, err := r.Store.CreateSession(ctx, models.CreateSessionRequest{
		Name:     input.Name,
		Address:  input.Address,
		SaveName: saveName,
	})
	if err != nil {
		return nil, err
	}
	if r.Poller != nil {
		r.Poller.StartSession(session.ID(s.ID))
	}
	return r.sessionWithStatus(*s), nil
}

func (r *mutationResolver) UpdateSession(ctx context.Context, id string, input model.UpdateSessionInput) (*model.Session, error) {
	// A session is pinned to one save, so repointing it at a server running a
	// different save is rejected rather than silently re-pinning it.
	if address := input.Address.Value(); address != nil {
		current, err := r.Store.GetSession(ctx, session.ID(id))
		if err != nil {
			return nil, err
		}
		if current == nil {
			return nil, fmt.Errorf("session %s not found", id)
		}
		if *address != current.Address {
			if _, err := r.pinnedSaveName(ctx, *address, current.SaveName); err != nil {
				return nil, err
			}
		}
	}

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
