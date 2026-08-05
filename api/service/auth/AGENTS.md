# Auth service

Owns the instance's authorization state: whether first-run setup has completed, whether an access key
is required at all, the shared key itself, and access-token issuance and validation.

There is no user model. A caller is either authorized or not.

## State machine

```
                    EnsureInstance (every boot)
                             │
                             ▼
              ┌──────────────────────────────┐
              │ uninitialized                │  auth_mode = password, so
              │ setup token issued + logged  │  nothing guarded is readable
              └──────────────────────────────┘
                             │ CompleteSetup(token, password?)
              ┌──────────────┴──────────────┐
              ▼                             ▼
   ┌─────────────────────┐       ┌─────────────────────┐
   │ open                │◄─────►│ password            │
   │ every caller allowed│       │ token required      │
   └─────────────────────┘       └─────────────────────┘
        DisableAuth(current)  ▲      EnableAuth(new)
                              └── ChangePassword(current, new)
```

`Service.State()` serves `{Initialized, AuthMode}` from an `atomic.Pointer`, refreshed by every
mutation that changes it. It is read on every request, so it must never hit the database.

**Exactly one Service per process.** It caches that state and owns the per-IP rate limiter, so a
second instance would both go stale and hand out a fresh limiter. `cmd/app.go` builds it once during
init and passes it to `buildHandler`.

## First-run claim

`EnsureInstance` creates the singleton row and, while unclaimed, makes sure a setup token exists:
the digest goes in `instance.bootstrap_token_hash`, the plaintext is logged and written to
`$SD_DATA_DIR/bootstrap.token` at 0600. It reissues if the file has gone missing, because a deleted
file would otherwise lock the operator out of their own setup; rotating an unclaimed token is
harmless.

`CompleteSetup` is the only unguarded mutation, which is unavoidable — there is nothing to
authenticate against before setup. Three things carry that weight: the token is compared in constant
time, `CompleteInstanceSetup` only updates `WHERE initialized_at IS NULL` so a second claim is
refused by the database rather than by a read-then-write check, and attempts are rate limited per IP.

An instance that is uninitialized still reports `auth_mode = password`, so a stranger who finds the
URL first cannot read anything either.

## Secrets

| Secret | Stored as | Why |
| --- | --- | --- |
| access key | bcrypt, cost 12 | low-entropy human input, needs to be slow to guess |
| access token | SHA-256 of a 256-bit random value | high entropy, so a fast digest is correct; bcrypt would only slow down every request |
| setup token | SHA-256, same reasoning | |

`auth.Token` and `auth.TokenHash` are distinct types precisely so persisting or looking up by a raw
token is a compile error. Nothing but the cookie ever holds the plaintext.

Every operation that changes the key — `EnableAuth`, `DisableAuth`, `ChangePassword` — revokes all
tokens. The resolvers re-issue one for the caller who made the change, so they are not signed out of
their own settings page.

## Rate limiting

`RateLimiter` is per-IP, 5 requests/minute with a burst of 5, entries expiring after 10 minutes of
disuse. It guards `Login` and `CompleteSetup`. The client IP comes from `ClientIPFromContext`, set by
the middleware from `X-Forwarded-For` / `X-Real-IP` / `RemoteAddr` — so behind a proxy it is only as
trustworthy as that proxy.

## Adding an operation that changes authorization

1. Do the write through `internal/store`.
2. Call `refreshState(ctx)` before returning, or the middleware keeps using the stale mode.
3. Decide whether existing tokens survive. If the change touches the key, they must not.
