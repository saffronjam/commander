// Package auth holds the typed access-token identifiers shared across the store
// and domain layers. It is a dependency-free leaf package so the sqlc-generated
// code can reference the types without an import cycle.
package auth

import (
	"crypto/sha256"
	"encoding/hex"
)

// Token is an opaque access token. It is handed to the client in a cookie and
// never persisted — only its Hash is.
type Token string

// TokenHash is the stored form of a Token. Keeping it a distinct type makes it
// a compile error to persist or look up by a raw Token.
type TokenHash string

// Hash returns the digest used as the token's storage key. Access tokens are
// 256-bit random values, so a plain SHA-256 is the right primitive here; bcrypt
// exists to slow down guessing of low-entropy human input.
func (t Token) Hash() TokenHash {
	sum := sha256.Sum256([]byte(t))
	return TokenHash(hex.EncodeToString(sum[:]))
}
