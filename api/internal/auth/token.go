// Package auth holds the typed access-token identifier shared across the store
// and domain layers. It is a dependency-free leaf package so the sqlc-generated
// code can reference the type without an import cycle.
package auth

// Token is an opaque access token.
type Token string
