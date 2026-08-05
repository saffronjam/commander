-- Restore is_default on auth_password. Anything still holding a password was
-- set deliberately, so it comes back as non-default.
CREATE TABLE auth_password_old (
    id         INTEGER   PRIMARY KEY CHECK (id = 1),
    hash       TEXT      NOT NULL,
    is_default INTEGER   NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO auth_password_old (id, hash, is_default, updated_at)
    SELECT id, hash, 0, updated_at FROM auth_password;
DROP TABLE auth_password;
ALTER TABLE auth_password_old RENAME TO auth_password;

-- Tokens are hashed and cannot be recovered, so the table comes back empty.
DROP INDEX IF EXISTS idx_auth_tokens_expires_at;
CREATE TABLE auth_tokens_old (
    token      TEXT      PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    client_ip  TEXT      NOT NULL DEFAULT ''
);
DROP TABLE auth_tokens;
ALTER TABLE auth_tokens_old RENAME TO auth_tokens;
CREATE INDEX idx_auth_tokens_expires_at ON auth_tokens(expires_at);

DROP TABLE IF EXISTS instance;
