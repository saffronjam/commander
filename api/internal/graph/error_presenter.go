package graph

import (
	"context"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

// ErrorPresenter passes resolver errors through with their extensions intact.
func ErrorPresenter(ctx context.Context, e error) *gqlerror.Error {
	return graphql.DefaultErrorPresenter(ctx, e)
}

// RecoverFunc scrubs panics into a generic internal error.
func RecoverFunc(_ context.Context, _ any) error {
	return gqlerror.Errorf("internal server error")
}
