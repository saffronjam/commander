// Package session holds the typed session identifier shared across the store
// and domain layers. It is a dependency-free leaf package so the sqlc-generated
// code can reference the type without an import cycle.
package session

// ID is a session identifier.
type ID string
