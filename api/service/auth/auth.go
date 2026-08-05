// Package auth owns the instance's authorization state: whether first-run setup
// has completed, whether an access token is required at all, the shared password,
// and access-token issuance and validation.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync/atomic"
	"time"

	"golang.org/x/crypto/bcrypt"

	"api/internal/auth"
	"api/internal/store"
	"api/pkg/config"
	"api/pkg/db"
	"api/pkg/log"
)

const (
	tokenLength = 32
	bcryptCost  = 12

	// bootstrapTokenFile is written inside the data directory so an operator can
	// read the first-run claim token without scraping logs.
	bootstrapTokenFile = "bootstrap.token"

	minPasswordLength = 8
)

// ErrAlreadyInitialized is returned when setup is attempted on a claimed instance.
var ErrAlreadyInitialized = errors.New("This instance is already set up")

// ErrInvalidBootstrapToken is returned when the first-run claim token is wrong.
var ErrInvalidBootstrapToken = errors.New("That setup token is not valid")

// ErrRateLimited is returned when too many attempts came from one client.
var ErrRateLimited = errors.New("Too many attempts. Try again shortly")

// ErrAuthNotRequired is returned by password operations on an open instance.
var ErrAuthNotRequired = errors.New("This instance has no access key")

// ErrPasswordTooShort is returned when a new password fails the length floor.
var ErrPasswordTooShort = fmt.Errorf("Access key must be at least %d characters", minPasswordLength)

// TokenData is the metadata returned for a validated token.
type TokenData struct {
	CreatedAt int64
	LastUsed  int64
	ClientIP  string
}

// State is the cached instance authorization state. It is read on every request,
// so it is served from memory and refreshed whenever it changes.
type State struct {
	Initialized bool
	AuthMode    store.AuthMode
}

// AuthRequired reports whether callers must present a valid access token.
func (s State) AuthRequired() bool { return s.AuthMode == store.AuthModePassword }

// Service handles the instance lifecycle and authentication operations backed by
// the SQLite store.
type Service struct {
	store   *store.DB
	limiter *RateLimiter
	state   atomic.Pointer[State]
}

// NewService creates an authentication service over the process-wide SQLite
// store. Exactly one instance should exist per process: it owns the cached
// instance state and the per-IP rate limiter.
func NewService() *Service {
	return NewServiceWithStore(db.DB.Store)
}

// NewServiceWithStore builds a service over an explicit store.
func NewServiceWithStore(st *store.DB) *Service {
	s := &Service{store: st, limiter: NewRateLimiter()}
	s.state.Store(&State{AuthMode: store.AuthModePassword})
	return s
}

// State returns the cached instance authorization state.
func (s *Service) State() State { return *s.state.Load() }

// refreshState reloads the cached state from the store.
func (s *Service) refreshState(ctx context.Context) error {
	inst, err := s.store.GetInstance(ctx)
	if err != nil {
		return fmt.Errorf("load instance state: %w", err)
	}
	s.state.Store(&State{Initialized: inst.Initialized, AuthMode: inst.AuthMode})
	return nil
}

// EnsureInstance creates the singleton instance row on first boot and, while the
// instance is still unclaimed, makes sure a first-run token exists and is
// discoverable. It is safe to call on every boot.
func (s *Service) EnsureInstance() error {
	ctx := context.Background()

	if err := s.store.EnsureInstance(ctx); err != nil {
		return err
	}
	inst, err := s.store.GetInstance(ctx)
	if err != nil {
		return err
	}

	if !inst.Initialized {
		if err := s.ensureBootstrapToken(ctx, inst); err != nil {
			return err
		}
	}

	return s.refreshState(ctx)
}

// ensureBootstrapToken issues a first-run claim token when none is stored, or
// when the file holding it has gone missing. Rotating an unclaimed token is
// harmless and keeps the operator from being locked out of their own setup.
func (s *Service) ensureBootstrapToken(ctx context.Context, inst store.Instance) error {
	path := filepath.Join(config.Config.DataDir, bootstrapTokenFile)

	if inst.BootstrapTokenHash != "" {
		if _, err := os.Stat(path); err == nil {
			log.Printf("%sSetup pending. The setup token is saved at %s%s", log.Orange, path, log.Reset)
			return nil
		}
	}

	token, err := s.GenerateToken()
	if err != nil {
		return err
	}
	if err := s.store.SetBootstrapTokenHash(ctx, string(auth.Token(token).Hash())); err != nil {
		return err
	}
	if err := os.MkdirAll(config.Config.DataDir, 0o755); err != nil {
		return fmt.Errorf("create data directory: %w", err)
	}
	if err := os.WriteFile(path, []byte(token+"\n"), 0o600); err != nil {
		return fmt.Errorf("write setup token: %w", err)
	}

	log.Printf("%s%sThis dashboard is not set up yet.%s", log.Bold, log.Orange, log.Reset)
	log.Printf("%sOpen it in a browser and enter this setup token: %s%s", log.Orange, token, log.Reset)
	log.Printf("%sIt is also saved at %s%s", log.Grey, path, log.Reset)
	return nil
}

// CompleteSetup claims an unclaimed instance. A nil password leaves the instance
// open; a non-nil one switches it to password mode. It is single-use.
func (s *Service) CompleteSetup(clientIP, bootstrapToken string, password *string) error {
	if !s.limiter.Allow(clientIP) {
		return ErrRateLimited
	}

	ctx := context.Background()
	inst, err := s.store.GetInstance(ctx)
	if err != nil {
		return err
	}
	if inst.Initialized {
		return ErrAlreadyInitialized
	}
	if inst.BootstrapTokenHash == "" {
		return ErrInvalidBootstrapToken
	}

	given := string(auth.Token(bootstrapToken).Hash())
	if subtle.ConstantTimeCompare([]byte(given), []byte(inst.BootstrapTokenHash)) != 1 {
		return ErrInvalidBootstrapToken
	}

	mode := store.AuthModeOpen
	if password != nil {
		if len(*password) < minPasswordLength {
			return ErrPasswordTooShort
		}
		hash, herr := bcrypt.GenerateFromPassword([]byte(*password), bcryptCost)
		if herr != nil {
			return fmt.Errorf("hash access key: %w", herr)
		}
		if err := s.store.UpsertAuthPassword(ctx, string(hash)); err != nil {
			return err
		}
		mode = store.AuthModePassword
	}

	claimed, err := s.store.CompleteInstanceSetup(ctx, mode)
	if err != nil {
		return err
	}
	if !claimed {
		return ErrAlreadyInitialized
	}

	_ = os.Remove(filepath.Join(config.Config.DataDir, bootstrapTokenFile))
	return s.refreshState(ctx)
}

// EnableAuth turns an open instance into a password-protected one.
func (s *Service) EnableAuth(password string) error {
	ctx := context.Background()
	if len(password) < minPasswordLength {
		return ErrPasswordTooShort
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return fmt.Errorf("hash access key: %w", err)
	}
	if err := s.store.UpsertAuthPassword(ctx, string(hash)); err != nil {
		return err
	}
	if err := s.store.SetAuthMode(ctx, store.AuthModePassword); err != nil {
		return err
	}
	// Nobody holds a token yet, and any stale ones must not outlive the switch.
	if err := s.store.DeleteAllTokens(ctx); err != nil {
		return err
	}
	return s.refreshState(ctx)
}

// DisableAuth drops the access key and opens the instance up, after verifying
// the caller knows the current key.
func (s *Service) DisableAuth(currentPassword string) error {
	ctx := context.Background()
	if !s.State().AuthRequired() {
		return ErrAuthNotRequired
	}
	valid, err := s.ValidatePassword(currentPassword)
	if err != nil {
		return err
	}
	if !valid {
		return errors.New("Current access key is incorrect")
	}
	if err := s.store.DeleteAuthPassword(ctx); err != nil {
		return err
	}
	if err := s.store.SetAuthMode(ctx, store.AuthModeOpen); err != nil {
		return err
	}
	if err := s.store.DeleteAllTokens(ctx); err != nil {
		return err
	}
	return s.refreshState(ctx)
}

// ChangePassword replaces the access key after verifying the current one, and
// revokes every existing session.
func (s *Service) ChangePassword(currentPassword, newPassword string) error {
	ctx := context.Background()
	if !s.State().AuthRequired() {
		return ErrAuthNotRequired
	}
	if len(newPassword) < minPasswordLength {
		return ErrPasswordTooShort
	}
	valid, err := s.ValidatePassword(currentPassword)
	if err != nil {
		return err
	}
	if !valid {
		return errors.New("Current access key is incorrect")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcryptCost)
	if err != nil {
		return fmt.Errorf("hash access key: %w", err)
	}
	if err := s.store.UpsertAuthPassword(ctx, string(hash)); err != nil {
		return err
	}
	return s.store.DeleteAllTokens(ctx)
}

// ValidatePassword reports whether the provided access key matches the stored hash.
func (s *Service) ValidatePassword(password string) (bool, error) {
	pw, err := s.store.GetAuthPassword(context.Background())
	if errors.Is(err, store.ErrNotFound) {
		return false, ErrAuthNotRequired
	}
	if err != nil {
		return false, fmt.Errorf("failed to get stored access key: %w", err)
	}

	err = bcrypt.CompareHashAndPassword([]byte(pw.Hash), []byte(password))
	if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to compare access key: %w", err)
	}
	return true, nil
}

// Login validates the access key and, on success, issues a token. The returned
// token is empty when the key was wrong.
func (s *Service) Login(clientIP, password string) (string, error) {
	if !s.limiter.Allow(clientIP) {
		return "", ErrRateLimited
	}
	valid, err := s.ValidatePassword(password)
	if err != nil {
		return "", err
	}
	if !valid {
		return "", nil
	}
	token, err := s.GenerateToken()
	if err != nil {
		return "", err
	}
	if err := s.StoreToken(token, clientIP); err != nil {
		return "", err
	}
	return token, nil
}

// GenerateToken creates a new cryptographically secure token.
func (s *Service) GenerateToken() (string, error) {
	bytes := make([]byte, tokenLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

// StoreToken persists a freshly issued token by its hash, with sliding-expiry
// metadata.
func (s *Service) StoreToken(token, clientIP string) error {
	expiresAt := time.Now().Add(store.TokenTTL)
	if err := s.store.InsertToken(context.Background(), auth.Token(token).Hash(), expiresAt, clientIP); err != nil {
		return fmt.Errorf("failed to store token: %w", err)
	}
	return nil
}

// ValidateToken returns the token metadata if the token exists and has not
// expired, applying sliding expiration on each successful read. It returns
// (nil, nil) when the token is unknown or expired.
func (s *Service) ValidateToken(token string) (*TokenData, error) {
	hash := auth.Token(token).Hash()
	t, err := s.store.GetValidToken(context.Background(), hash, time.Now())
	if errors.Is(err, store.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get token: %w", err)
	}

	expiresAt := time.Now().Add(store.TokenTTL)
	if err := s.store.TouchToken(context.Background(), hash, expiresAt, t.ClientIP); err != nil {
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
	if err := s.store.DeleteToken(context.Background(), auth.Token(token).Hash()); err != nil {
		return fmt.Errorf("failed to delete token: %w", err)
	}
	return nil
}

// GetTokenTTL returns the token TTL duration for cookie configuration.
func GetTokenTTL() time.Duration {
	return store.TokenTTL
}
