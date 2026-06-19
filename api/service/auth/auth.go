package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"

	"api/internal/auth"
	"api/internal/store"
	"api/pkg/config"
	"api/pkg/db"
)

const (
	tokenLength = 32

	bcryptCost = 12
)

// TokenData is the metadata returned for a validated token.
type TokenData struct {
	CreatedAt int64
	LastUsed  int64
	ClientIP  string
}

// Service handles authentication operations backed by the SQLite store: shared
// password hashing/validation and access-token issuance, validation, and
// sliding expiry.
type Service struct {
	store *store.DB
}

// NewService creates an authentication service over the process-wide SQLite store.
func NewService() *Service {
	return &Service{store: db.DB.Store}
}

// InitializePassword seeds the bootstrap password row if none exists yet.
// Returns true if the bootstrap password was used (first-time setup).
func (s *Service) InitializePassword() (bool, error) {
	_, err := s.store.GetAuthPassword(context.Background())
	if err == nil {
		return false, nil
	}
	if !errors.Is(err, store.ErrNotFound) {
		return false, fmt.Errorf("failed to check password existence: %w", err)
	}

	bootstrapPassword := config.Config.Auth.BootstrapPassword
	if bootstrapPassword == "" {
		bootstrapPassword = "change-me"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(bootstrapPassword), bcryptCost)
	if err != nil {
		return false, fmt.Errorf("failed to hash bootstrap password: %w", err)
	}
	if err := s.store.UpsertAuthPassword(context.Background(), string(hash), true); err != nil {
		return false, fmt.Errorf("failed to store password hash: %w", err)
	}
	return true, nil
}

// ValidatePassword reports whether the provided password matches the stored hash.
func (s *Service) ValidatePassword(password string) (bool, error) {
	pw, err := s.store.GetAuthPassword(context.Background())
	if errors.Is(err, store.ErrNotFound) {
		return false, fmt.Errorf("no password configured")
	}
	if err != nil {
		return false, fmt.Errorf("failed to get stored password: %w", err)
	}

	err = bcrypt.CompareHashAndPassword([]byte(pw.Hash), []byte(password))
	if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to compare password: %w", err)
	}
	return true, nil
}

// IsUsingDefaultPassword reports whether the stored password is still the
// bootstrap default.
func (s *Service) IsUsingDefaultPassword() bool {
	isDefault, err := s.store.IsUsingDefaultPassword(context.Background())
	if err != nil {
		return false
	}
	return isDefault
}

// ChangePassword updates the stored password hash after verifying the current one.
func (s *Service) ChangePassword(currentPassword, newPassword string) error {
	valid, err := s.ValidatePassword(currentPassword)
	if err != nil {
		return fmt.Errorf("failed to validate current password: %w", err)
	}
	if !valid {
		return fmt.Errorf("current password is incorrect")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcryptCost)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}
	if err := s.store.UpsertAuthPassword(context.Background(), string(hash), false); err != nil {
		return fmt.Errorf("failed to store new password hash: %w", err)
	}
	return nil
}

// GenerateToken creates a new cryptographically secure access token.
func (s *Service) GenerateToken() (string, error) {
	bytes := make([]byte, tokenLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

// StoreToken persists a freshly issued token with sliding-expiry metadata.
func (s *Service) StoreToken(token, clientIP string) error {
	expiresAt := time.Now().Add(store.TokenTTL)
	if err := s.store.InsertToken(context.Background(), auth.Token(token), expiresAt, clientIP); err != nil {
		return fmt.Errorf("failed to store token: %w", err)
	}
	return nil
}

// ValidateToken returns the token metadata if the token exists and has not
// expired, applying sliding expiration on each successful read. It returns
// (nil, nil) when the token is unknown or expired.
func (s *Service) ValidateToken(token string) (*TokenData, error) {
	t, err := s.store.GetValidToken(context.Background(), auth.Token(token), time.Now())
	if errors.Is(err, store.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get token: %w", err)
	}

	expiresAt := time.Now().Add(store.TokenTTL)
	if err := s.store.TouchToken(context.Background(), auth.Token(token), expiresAt, t.ClientIP); err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}

	return &TokenData{
		CreatedAt: t.CreatedAt.Unix(),
		LastUsed:  t.LastUsed.Unix(),
		ClientIP:  t.ClientIP,
	}, nil
}

// DeleteToken removes a token (logout).
func (s *Service) DeleteToken(token string) error {
	if err := s.store.DeleteToken(context.Background(), auth.Token(token)); err != nil {
		return fmt.Errorf("failed to delete token: %w", err)
	}
	return nil
}

// GetTokenTTL returns the token TTL duration for cookie configuration.
func GetTokenTTL() time.Duration {
	return store.TokenTTL
}
