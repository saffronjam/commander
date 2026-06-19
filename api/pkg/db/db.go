package db

import (
	"database/sql"

	"api/internal/store"
	"api/pkg/log"
)

var DB Context

// Context is the database context for the application.
// It is used as a singleton, and should be initialized with
// the Setup() function.
type Context struct {
	Store *store.DB
	sqlDB *sql.DB
}

// Setup initializes the database context.
// It should be called once at the start of the application.
func Setup() error {
	DB = Context{}

	if err := DB.setupSQLite(); err != nil {
		return err
	}

	return nil
}

// Shutdown closes the database connections.
// It should be called once at the end of the application.
func Shutdown() {
	if err := DB.shutdownSQLite(); err != nil {
		log.Fatalln(err)
	}
}
