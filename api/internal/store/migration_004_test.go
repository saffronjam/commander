package store_test

import (
	"database/sql"
	"testing"
)

func seedLegacySession(t *testing.T, db *sql.DB, id, saveName string) {
	t.Helper()
	if _, err := db.Exec(
		`INSERT INTO sessions (id, name, address, session_name) VALUES (?, ?, '127.0.0.1:8080', ?)`,
		id, "Session "+id, saveName,
	); err != nil {
		t.Fatalf("seed session %s: %v", id, err)
	}
}

func seedLegacyHistory(t *testing.T, db *sql.DB, sessionID, saveName, dataType string, gameTimeID int64, data string) {
	t.Helper()
	if _, err := db.Exec(
		`INSERT INTO history_points (session_id, save_name, data_type, game_time_id, data) VALUES (?, ?, ?, ?, ?)`,
		sessionID, saveName, dataType, gameTimeID, data,
	); err != nil {
		t.Fatalf("seed history point: %v", err)
	}
}

// history_points references sessions ON DELETE CASCADE, and DROP TABLE fires
// cascades while foreign keys are on, so a careless rebuild of sessions empties
// the history. The pinned save's rows must survive untouched.
func TestMigration004PreservesHistoryForPinnedSave(t *testing.T) {
	db := openTestDB(t)
	migrateTo(t, db, 3)
	seedLegacySession(t, db, "s1", "alpha")
	for i := int64(1); i <= 25; i++ {
		seedLegacyHistory(t, db, "s1", "alpha", "circuits", i, `{}`)
	}
	migrateTo(t, db, 4)

	if n := countRows(t, db, "history_points"); n != 25 {
		t.Fatalf("want all 25 pinned-save rows kept, got %d", n)
	}
	if n := countRows(t, db, "sessions"); n != 1 {
		t.Fatalf("want the session kept, got %d rows", n)
	}
}

// Only the session's own save survives. The overlapping (data_type,
// game_time_id) is the case that would collide under the new primary key if the
// other save's rows were copied.
func TestMigration004DropsOtherSaves(t *testing.T) {
	db := openTestDB(t)
	migrateTo(t, db, 3)
	seedLegacySession(t, db, "s1", "alpha")
	seedLegacyHistory(t, db, "s1", "alpha", "circuits", 1, `{"save":"alpha"}`)
	seedLegacyHistory(t, db, "s1", "beta", "circuits", 1, `{"save":"beta"}`)
	seedLegacyHistory(t, db, "s1", "beta", "circuits", 2, `{"save":"beta"}`)
	migrateTo(t, db, 4)

	if n := countRows(t, db, "history_points"); n != 1 {
		t.Fatalf("want only the pinned save's row, got %d", n)
	}
	var data string
	if err := db.QueryRow(`SELECT data FROM history_points WHERE game_time_id = 1`).Scan(&data); err != nil {
		t.Fatalf("read surviving row: %v", err)
	}
	if data != `{"save":"alpha"}` {
		t.Fatalf("want the pinned save's data to win, got %s", data)
	}
}

// An empty session_name means the poller never read getSessionInfo from that
// address, so there is no save to pin the session to.
func TestMigration004DeletesUnpinnableSessions(t *testing.T) {
	db := openTestDB(t)
	migrateTo(t, db, 3)
	seedLegacySession(t, db, "s1", "")
	seedLegacyHistory(t, db, "s1", "orphaned", "circuits", 1, `{}`)
	seedLegacySession(t, db, "s2", "alpha")
	seedLegacyHistory(t, db, "s2", "alpha", "circuits", 1, `{}`)
	migrateTo(t, db, 4)

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sessions WHERE id = 's1'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("want the unpinnable session deleted")
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM history_points WHERE session_id = 's1'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("want the unpinnable session's history deleted, got %d rows", n)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM history_points WHERE session_id = 's2'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("want the pinnable sibling untouched, got %d rows", n)
	}
}

func TestMigration004RewritesTableShapes(t *testing.T) {
	db := openTestDB(t)
	migrateTo(t, db, 4)

	if _, err := db.Exec(`SELECT session_name FROM sessions`); err == nil {
		t.Fatal("want sessions.session_name renamed away")
	}
	if _, err := db.Exec(`SELECT save_name FROM sessions`); err != nil {
		t.Fatalf("want sessions.save_name present: %v", err)
	}
	if _, err := db.Exec(`SELECT save_name FROM history_points`); err == nil {
		t.Fatal("want history_points.save_name gone")
	}
}

func TestMigration004RejectsEmptySaveName(t *testing.T) {
	db := openTestDB(t)
	migrateTo(t, db, 4)

	if _, err := db.Exec(
		`INSERT INTO sessions (id, name, address, save_name) VALUES ('s1', 'Test', '127.0.0.1:8080', '')`,
	); err == nil {
		t.Fatal("want an empty save name rejected by the CHECK constraint")
	}
}

func TestMigration004NewPrimaryKey(t *testing.T) {
	db := openTestDB(t)
	migrateTo(t, db, 4)
	if _, err := db.Exec(
		`INSERT INTO sessions (id, name, address, save_name) VALUES ('s1', 'Test', '127.0.0.1:8080', 'alpha')`,
	); err != nil {
		t.Fatalf("seed session: %v", err)
	}
	if _, err := db.Exec(
		`INSERT INTO history_points (session_id, data_type, game_time_id, data) VALUES ('s1', 'circuits', 1, '{}')`,
	); err != nil {
		t.Fatalf("first insert: %v", err)
	}
	if _, err := db.Exec(
		`INSERT INTO history_points (session_id, data_type, game_time_id, data) VALUES ('s1', 'circuits', 1, '{}')`,
	); err == nil {
		t.Fatal("want (session_id, data_type, game_time_id) to be unique")
	}
}

// Down must restore save_name from the pin rather than leaving it empty, so the
// series stay addressable under the old key.
func TestMigration004Down(t *testing.T) {
	db := openTestDB(t)
	migrateTo(t, db, 3)
	seedLegacySession(t, db, "s1", "alpha")
	seedLegacyHistory(t, db, "s1", "alpha", "circuits", 7, `{}`)
	migrateTo(t, db, 4)
	migrateTo(t, db, 3)

	var sessionName string
	if err := db.QueryRow(`SELECT session_name FROM sessions WHERE id = 's1'`).Scan(&sessionName); err != nil {
		t.Fatalf("read restored session: %v", err)
	}
	if sessionName != "alpha" {
		t.Fatalf("want session_name restored to the pin, got %q", sessionName)
	}
	var saveName string
	if err := db.QueryRow(`SELECT save_name FROM history_points WHERE game_time_id = 7`).Scan(&saveName); err != nil {
		t.Fatalf("read restored history point: %v", err)
	}
	if saveName != "alpha" {
		t.Fatalf("want history save_name restored to the pin, got %q", saveName)
	}
}
