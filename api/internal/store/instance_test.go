package store_test

import (
	"testing"
	"time"

	"api/internal/auth"
	"api/internal/store"
)

func TestInstanceStartsUninitialized(t *testing.T) {
	st, ctx := newStore(t)

	inst, err := st.GetInstance(ctx)
	if err != nil {
		t.Fatalf("get instance: %v", err)
	}
	if inst.Initialized {
		t.Fatal("a fresh instance must not report initialized")
	}
	if inst.AuthMode != store.AuthModePassword {
		t.Fatalf("want password as the pre-setup default, got %q", inst.AuthMode)
	}
	if inst.BootstrapTokenHash != "" {
		t.Fatalf("want no bootstrap hash before one is set, got %q", inst.BootstrapTokenHash)
	}
}

func TestCompleteInstanceSetupIsSingleUse(t *testing.T) {
	st, ctx := newStore(t)

	if err := st.SetBootstrapTokenHash(ctx, "deadbeef"); err != nil {
		t.Fatal(err)
	}

	ok, err := st.CompleteInstanceSetup(ctx, store.AuthModeOpen)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("first setup must succeed")
	}

	inst, err := st.GetInstance(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !inst.Initialized || inst.InitializedAt.IsZero() {
		t.Fatal("setup must stamp initialized_at")
	}
	if inst.AuthMode != store.AuthModeOpen {
		t.Fatalf("want open mode, got %q", inst.AuthMode)
	}
	if inst.BootstrapTokenHash != "" {
		t.Fatalf("setup must clear the bootstrap token, got %q", inst.BootstrapTokenHash)
	}

	ok, err = st.CompleteInstanceSetup(ctx, store.AuthModePassword)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("a second setup must be refused so the instance cannot be re-claimed")
	}
}

func TestSetAuthModeAfterSetup(t *testing.T) {
	st, ctx := newStore(t)

	if _, err := st.CompleteInstanceSetup(ctx, store.AuthModeOpen); err != nil {
		t.Fatal(err)
	}
	if err := st.SetAuthMode(ctx, store.AuthModePassword); err != nil {
		t.Fatal(err)
	}

	inst, err := st.GetInstance(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if inst.AuthMode != store.AuthModePassword {
		t.Fatalf("want password mode, got %q", inst.AuthMode)
	}
	if !inst.Initialized {
		t.Fatal("switching mode must not clear initialized_at")
	}
}

func TestAuthPasswordLifecycle(t *testing.T) {
	st, ctx := newStore(t)

	if _, err := st.GetAuthPassword(ctx); err != store.ErrNotFound {
		t.Fatalf("want ErrNotFound with no password configured, got %v", err)
	}
	if err := st.UpsertAuthPassword(ctx, "hash-1"); err != nil {
		t.Fatal(err)
	}
	pw, err := st.GetAuthPassword(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if pw.Hash != "hash-1" {
		t.Fatalf("want hash-1, got %q", pw.Hash)
	}
	if err := st.DeleteAuthPassword(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := st.GetAuthPassword(ctx); err != store.ErrNotFound {
		t.Fatalf("want ErrNotFound after delete, got %v", err)
	}
}

func TestTokensArePersistedHashedOnly(t *testing.T) {
	st, db, ctx := newStoreAndDB(t)
	const raw = auth.Token("a-secret-token")
	now := time.Now()

	if err := st.InsertToken(ctx, raw.Hash(), now.Add(time.Hour), "1.2.3.4"); err != nil {
		t.Fatal(err)
	}

	// A database read must not be enough to impersonate a session, so the raw
	// token must appear nowhere in the table.
	var found int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM auth_tokens WHERE token_hash = ?`, string(raw),
	).Scan(&found); err != nil {
		t.Fatal(err)
	}
	if found != 0 {
		t.Fatal("the raw token must never be persisted")
	}

	if _, err := st.GetValidToken(ctx, raw.Hash(), now); err != nil {
		t.Fatalf("lookup by hash must succeed: %v", err)
	}
}

func TestDeleteAllTokens(t *testing.T) {
	st, ctx := newStore(t)
	now := time.Now()

	for _, tok := range []auth.Token{"one", "two"} {
		if err := st.InsertToken(ctx, tok.Hash(), now.Add(time.Hour), ""); err != nil {
			t.Fatal(err)
		}
	}
	if err := st.DeleteAllTokens(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := st.GetValidToken(ctx, auth.Token("one").Hash(), now); err != store.ErrNotFound {
		t.Fatalf("want every token revoked, got %v", err)
	}
}
