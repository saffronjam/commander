package auth_test

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	migsqlite "github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "modernc.org/sqlite"

	"api/internal/store"
	"api/pkg/config"
	svcauth "api/service/auth"
)

const testPragmas = "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)"

// newService builds a service over a migrated temp database, with the data
// directory pointed at the same temp dir so the setup token lands there.
func newService(t *testing.T) (*svcauth.Service, string) {
	t.Helper()

	dir := t.TempDir()
	db, err := sql.Open("sqlite", filepath.Join(dir, "test.db")+testPragmas)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })

	src, err := iofs.New(store.Migrations, "migrations")
	if err != nil {
		t.Fatalf("iofs: %v", err)
	}
	drv, err := migsqlite.WithInstance(db, &migsqlite.Config{})
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "sqlite", drv)
	if err != nil {
		t.Fatalf("migrator: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("migrate up: %v", err)
	}

	config.Config = &config.Type{DataDir: dir}
	return svcauth.NewServiceWithStore(store.New(db)), dir
}

// readSetupToken returns the token EnsureInstance wrote to the data directory.
func readSetupToken(t *testing.T, dir string) string {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(dir, "bootstrap.token"))
	if err != nil {
		t.Fatalf("read setup token: %v", err)
	}
	return strings.TrimSpace(string(raw))
}

func TestEnsureInstanceIssuesSetupToken(t *testing.T) {
	svc, dir := newService(t)

	if err := svc.EnsureInstance(); err != nil {
		t.Fatalf("ensure instance: %v", err)
	}

	if state := svc.State(); state.Initialized {
		t.Fatal("a fresh instance must not report initialized")
	}
	if token := readSetupToken(t, dir); len(token) != 64 {
		t.Fatalf("want a 32-byte hex setup token, got %d chars", len(token))
	}

	info, err := os.Stat(filepath.Join(dir, "bootstrap.token"))
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Fatalf("the setup token must not be world readable, got %o", perm)
	}
}

func TestEnsureInstanceIsIdempotent(t *testing.T) {
	svc, dir := newService(t)

	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}
	first := readSetupToken(t, dir)
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}
	if second := readSetupToken(t, dir); second != first {
		t.Fatal("a reboot before setup must not rotate the setup token")
	}
}

// A deleted token file would otherwise lock the operator out of their own setup,
// so an unclaimed instance reissues one.
func TestEnsureInstanceReissuesWhenTokenFileLost(t *testing.T) {
	svc, dir := newService(t)

	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}
	first := readSetupToken(t, dir)
	if err := os.Remove(filepath.Join(dir, "bootstrap.token")); err != nil {
		t.Fatal(err)
	}
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}
	if second := readSetupToken(t, dir); second == first {
		t.Fatal("want a fresh token after the file was lost")
	}
}

func TestCompleteSetupOpenMode(t *testing.T) {
	svc, dir := newService(t)
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}

	if err := svc.CompleteSetup("1.2.3.4", readSetupToken(t, dir), nil); err != nil {
		t.Fatalf("setup without an access key must succeed: %v", err)
	}

	state := svc.State()
	if !state.Initialized {
		t.Fatal("want initialized after setup")
	}
	if state.AuthRequired() {
		t.Fatal("want an open instance when no access key was given")
	}
	if _, err := os.Stat(filepath.Join(dir, "bootstrap.token")); !os.IsNotExist(err) {
		t.Fatal("want the setup token file removed once claimed")
	}
}

func TestCompleteSetupWithAccessKey(t *testing.T) {
	svc, dir := newService(t)
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}
	key := "a-good-access-key"

	if err := svc.CompleteSetup("1.2.3.4", readSetupToken(t, dir), &key); err != nil {
		t.Fatal(err)
	}

	if state := svc.State(); !state.AuthRequired() {
		t.Fatal("want password mode when an access key was given")
	}
	ok, err := svc.ValidatePassword(key)
	if err != nil || !ok {
		t.Fatalf("want the access key accepted, got ok=%v err=%v", ok, err)
	}
}

func TestCompleteSetupRejectsWrongToken(t *testing.T) {
	svc, _ := newService(t)
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}

	err := svc.CompleteSetup("1.2.3.4", "not-the-token", nil)
	if err != svcauth.ErrInvalidBootstrapToken {
		t.Fatalf("want ErrInvalidBootstrapToken, got %v", err)
	}
	if svc.State().Initialized {
		t.Fatal("a rejected setup must leave the instance unclaimed")
	}
}

func TestCompleteSetupIsSingleUse(t *testing.T) {
	svc, dir := newService(t)
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}
	token := readSetupToken(t, dir)

	if err := svc.CompleteSetup("1.2.3.4", token, nil); err != nil {
		t.Fatal(err)
	}
	if err := svc.CompleteSetup("1.2.3.4", token, nil); err != svcauth.ErrAlreadyInitialized {
		t.Fatalf("want ErrAlreadyInitialized on a second claim, got %v", err)
	}
}

func TestCompleteSetupRejectsShortKey(t *testing.T) {
	svc, dir := newService(t)
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}
	short := "abc"

	if err := svc.CompleteSetup("1.2.3.4", readSetupToken(t, dir), &short); err != svcauth.ErrPasswordTooShort {
		t.Fatalf("want ErrPasswordTooShort, got %v", err)
	}
	if svc.State().Initialized {
		t.Fatal("a rejected setup must leave the instance unclaimed")
	}
}

func TestEnableAndDisableAuth(t *testing.T) {
	svc, dir := newService(t)
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}
	if err := svc.CompleteSetup("1.2.3.4", readSetupToken(t, dir), nil); err != nil {
		t.Fatal(err)
	}

	const key = "later-added-key"
	if err := svc.EnableAuth(key); err != nil {
		t.Fatalf("enable auth: %v", err)
	}
	if !svc.State().AuthRequired() {
		t.Fatal("want password mode after enabling auth")
	}

	if err := svc.DisableAuth("wrong-key"); err == nil {
		t.Fatal("want disable refused without the current key")
	}
	if err := svc.DisableAuth(key); err != nil {
		t.Fatalf("disable auth: %v", err)
	}
	if svc.State().AuthRequired() {
		t.Fatal("want open mode after disabling auth")
	}
	if _, err := svc.ValidatePassword(key); err != svcauth.ErrAuthNotRequired {
		t.Fatalf("want the access key gone, got %v", err)
	}
}

func TestLoginIssuesTokenAndChangeRevokesIt(t *testing.T) {
	svc, dir := newService(t)
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}
	const key = "first-access-key"
	k := key
	if err := svc.CompleteSetup("1.2.3.4", readSetupToken(t, dir), &k); err != nil {
		t.Fatal(err)
	}

	token, err := svc.Login("1.2.3.4", key)
	if err != nil {
		t.Fatal(err)
	}
	if token == "" {
		t.Fatal("want a token for the correct key")
	}
	if td, verr := svc.ValidateToken(token); verr != nil || td == nil {
		t.Fatalf("want the token to validate, got td=%v err=%v", td, verr)
	}

	if err := svc.ChangePassword(key, "second-access-key"); err != nil {
		t.Fatal(err)
	}
	if td, _ := svc.ValidateToken(token); td != nil {
		t.Fatal("changing the access key must revoke existing sessions")
	}
}

func TestLoginRejectsWrongKeyWithoutError(t *testing.T) {
	svc, dir := newService(t)
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}
	k := "the-real-key"
	if err := svc.CompleteSetup("1.2.3.4", readSetupToken(t, dir), &k); err != nil {
		t.Fatal(err)
	}

	token, err := svc.Login("1.2.3.4", "not-the-key")
	if err != nil {
		t.Fatalf("a wrong key is not an error, got %v", err)
	}
	if token != "" {
		t.Fatal("want no token for a wrong key")
	}
}

// Guessing the setup token is rate limited per client. This exercises the same
// limiter Login uses, but without bcrypt in the loop: five bcrypt comparisons
// under -race take long enough for the limiter to refill, which would make the
// assertion depend on wall-clock speed.
func TestSetupGuessingIsRateLimitedPerClient(t *testing.T) {
	svc, _ := newService(t)
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}

	const attacker = "9.9.9.9"
	for i := 0; i < 5; i++ {
		if err := svc.CompleteSetup(attacker, "guess", nil); err != svcauth.ErrInvalidBootstrapToken {
			t.Fatalf("attempt %d: want a rejected guess, got %v", i+1, err)
		}
	}
	if err := svc.CompleteSetup(attacker, "guess", nil); err != svcauth.ErrRateLimited {
		t.Fatalf("want ErrRateLimited on the sixth attempt, got %v", err)
	}

	// A different client must not be punished for the attacker's attempts.
	if err := svc.CompleteSetup("5.5.5.5", "guess", nil); err != svcauth.ErrInvalidBootstrapToken {
		t.Fatalf("want other clients unaffected, got %v", err)
	}
}

// Login goes through the same limiter, so exhausting it blocks sign-in too.
func TestLoginConsultsTheRateLimiter(t *testing.T) {
	svc, dir := newService(t)
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}
	k := "the-real-key"
	if err := svc.CompleteSetup("1.2.3.4", readSetupToken(t, dir), &k); err != nil {
		t.Fatal(err)
	}

	const attacker = "8.8.8.8"
	for i := 0; i < 5; i++ {
		_ = svc.CompleteSetup(attacker, "guess", nil)
	}

	if _, err := svc.Login(attacker, k); err != svcauth.ErrRateLimited {
		t.Fatalf("want the correct key refused while rate limited, got %v", err)
	}
}

func TestDeleteTokenRevokesSession(t *testing.T) {
	svc, dir := newService(t)
	if err := svc.EnsureInstance(); err != nil {
		t.Fatal(err)
	}
	k := "the-real-key"
	if err := svc.CompleteSetup("1.2.3.4", readSetupToken(t, dir), &k); err != nil {
		t.Fatal(err)
	}

	token, err := svc.Login("1.2.3.4", k)
	if err != nil || token == "" {
		t.Fatalf("login: %v", err)
	}
	if err := svc.DeleteToken(token); err != nil {
		t.Fatal(err)
	}
	if td, _ := svc.ValidateToken(token); td != nil {
		t.Fatal("want the token revoked after logout")
	}
}
