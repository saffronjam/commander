package db

import (
	"database/sql"
	"fmt"

	"api/internal/migrate"
	"api/internal/store"
	"api/pkg/config"

	_ "modernc.org/sqlite"
)

// serveDSN adds WAL + foreign keys + immediate-tx locking for the serve path so
// the poller's writes and the resolvers' reads coexist under SQLITE_BUSY pressure.
const serveDSN = "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)&_txlock=immediate"

func (dbCtx *Context) setupSQLite() error {
	path := config.Config.DBPath
	if path == "" {
		path = "satisfactory-dashboard.db"
	}
	sqlDB, err := sql.Open("sqlite", path+serveDSN)
	if err != nil {
		return fmt.Errorf("failed to open sqlite database: %w", err)
	}
	if err := migrate.Up(sqlDB); err != nil {
		return fmt.Errorf("failed to migrate sqlite database: %w", err)
	}
	dbCtx.sqlDB = sqlDB
	dbCtx.Store = store.New(sqlDB)
	return nil
}

func (dbCtx *Context) shutdownSQLite() error {
	if dbCtx.sqlDB != nil {
		return dbCtx.sqlDB.Close()
	}
	return nil
}
