-- A session is pinned to exactly one save. history_points loses save_name, and
-- sessions.session_name becomes the pinned save_name.
--
-- The staging table has no foreign key on purpose. history_points references
-- sessions ON DELETE CASCADE, and with foreign_keys(ON) SQLite's DROP TABLE
-- performs an implicit DELETE FROM that fires cascades, so rebuilding sessions
-- while history_points still exists would empty it. Staging outside the FK
-- graph is what makes the rebuild below safe.
CREATE TABLE history_stage (
    session_id   TEXT    NOT NULL,
    data_type    TEXT    NOT NULL,
    game_time_id INTEGER NOT NULL,
    data         TEXT    NOT NULL
);

-- Admitting only the session's own save makes (session_id, data_type,
-- game_time_id) unique by construction: the old primary key already included
-- save_name, so fixing save_name to one value cannot collide. Every other
-- save's history is left behind rather than copied and deleted.
INSERT INTO history_stage (session_id, data_type, game_time_id, data)
SELECT h.session_id, h.data_type, h.game_time_id, h.data
FROM history_points h
JOIN sessions s ON s.id = h.session_id
WHERE s.session_name <> ''
  AND h.save_name = s.session_name;

-- An empty session_name means the poller never once read getSessionInfo from
-- this address, so there is no save to pin it to.
DELETE FROM sessions WHERE session_name = '';

DROP TABLE history_points;

CREATE TABLE sessions_new (
    id         TEXT      PRIMARY KEY,
    name       TEXT      NOT NULL,
    address    TEXT      NOT NULL,
    save_name  TEXT      NOT NULL CHECK (save_name <> ''),
    is_paused  INTEGER   NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sessions_new (id, name, address, save_name, is_paused, created_at)
SELECT id, name, address, session_name, is_paused, created_at FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

CREATE TABLE history_points (
    session_id   TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    data_type    TEXT    NOT NULL,
    game_time_id INTEGER NOT NULL,
    data         TEXT    NOT NULL,
    PRIMARY KEY (session_id, data_type, game_time_id)
);

-- Nothing guarantees every historical write ran with the foreign key pragma
-- set, so an orphaned row would otherwise abort the insert.
INSERT INTO history_points (session_id, data_type, game_time_id, data)
SELECT session_id, data_type, game_time_id, data
FROM history_stage
WHERE session_id IN (SELECT id FROM sessions);

DROP TABLE history_stage;
