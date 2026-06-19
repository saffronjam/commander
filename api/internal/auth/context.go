package auth

import "context"

// Caller is the authenticated principal attached to a request context. Auth is
// single-shared-password, so there is no user identity beyond these flags.
type Caller struct {
	Authenticated       bool
	UsedDefaultPassword bool
}

type callerCtxKey struct{}

// WithUser attaches a Caller to the context.
func WithUser(ctx context.Context, c Caller) context.Context {
	return context.WithValue(ctx, callerCtxKey{}, c)
}

// UserFromContext returns the Caller attached to the context, if any.
func UserFromContext(ctx context.Context) (Caller, bool) {
	c, ok := ctx.Value(callerCtxKey{}).(Caller)
	return c, ok
}
