-- Instance-wide meta. initialized_at is NULL until first-run setup completes,
-- which is what distinguishes "never set up" from "set up and deliberately
-- open". auth_mode decides whether the @auth directive requires a caller.
CREATE TABLE instance (
    id                   INTEGER   PRIMARY KEY CHECK (id = 1),
    initialized_at       TIMESTAMP,
    auth_mode            TEXT      NOT NULL DEFAULT 'password'
                                   CHECK (auth_mode IN ('open', 'password')),
    bootstrap_token_hash TEXT,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO instance (id) VALUES (1);

-- An instance whose password was never changed off the shipped default was
-- never really configured: drop the password so first-run setup claims it.
-- One whose password was changed is carried over as initialized.
UPDATE instance
SET initialized_at = CURRENT_TIMESTAMP,
    auth_mode      = 'password'
WHERE EXISTS (SELECT 1 FROM auth_password WHERE id = 1 AND is_default = 0);

DELETE FROM auth_password WHERE is_default = 1;

-- Tokens were stored in plaintext, so none of them can be carried forward.
DELETE FROM auth_tokens;

-- Rebuild auth_password without is_default.
CREATE TABLE auth_password_new (
    id         INTEGER   PRIMARY KEY CHECK (id = 1),
    hash       TEXT      NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO auth_password_new (id, hash, updated_at)
    SELECT id, hash, updated_at FROM auth_password;
DROP TABLE auth_password;
ALTER TABLE auth_password_new RENAME TO auth_password;

-- Rebuild auth_tokens so the primary key holds a SHA-256 digest of the token
-- rather than the token itself.
DROP INDEX IF EXISTS idx_auth_tokens_expires_at;
CREATE TABLE auth_tokens_new (
    token_hash TEXT      PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    client_ip  TEXT      NOT NULL DEFAULT ''
);
DROP TABLE auth_tokens;
ALTER TABLE auth_tokens_new RENAME TO auth_tokens;
CREATE INDEX idx_auth_tokens_expires_at ON auth_tokens(expires_at);
