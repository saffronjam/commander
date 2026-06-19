package graph

import (
	"context"

	"api/internal/auth"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

// AuthDirective enforces @auth: it rejects the field unless an authenticated
// caller is present in the context (injected by the HTTP middleware or the WS
// init func). The same directive guards queries, mutations, and subscriptions.
func AuthDirective(ctx context.Context, _ any, next graphql.Resolver) (any, error) {
	if _, ok := auth.UserFromContext(ctx); !ok {
		return nil, &gqlerror.Error{
			Message:    "authentication required",
			Extensions: map[string]any{"code": "UNAUTHENTICATED"},
		}
	}
	return next(ctx)
}
