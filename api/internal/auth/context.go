package auth

import "context"

// Caller is the authorized principal attached to a request context. There is no
// user identity: a caller is present either because a valid access token was
// presented or because the instance runs in open mode.
type Caller struct {
	Authenticated bool
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
