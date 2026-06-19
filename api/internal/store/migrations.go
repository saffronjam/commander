package store

import "embed"

// Migrations contains the embedded migration SQL files applied by the
// golang-migrate iofs source at startup and in tests.
//
//go:embed migrations/*.sql
var Migrations embed.FS
