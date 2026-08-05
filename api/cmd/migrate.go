package cmd

import (
	"context"

	"api/internal/migrate"
	"api/pkg/config"
	"api/pkg/db"
)

// RunMigrate executes the `migrate` subcommand against the configured database
// on its own connection, without starting the server or the poller.
func RunMigrate(opts *Options) error {
	if err := config.SetupEnvironment(opts.Mode); err != nil {
		return err
	}

	return migrate.Run(context.Background(), db.Path(), opts.Migrate, opts.MigrateSteps)
}
