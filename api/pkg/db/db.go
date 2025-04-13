package db

import (
	"api/pkg/log"
	"github.com/redis/go-redis/v9"
)

var DB Context

// Context is the database context for the application.
// It is used as a singleton, and should be initialized with
// the Setup() function.
type Context struct {
	RedisClient *redis.Client
}

// Setup initializes the database context.
// It should be called once at the start of the application.
func Setup() error {
	DB = Context{}

	err := DB.setupRedis()
	if err != nil {
		return err
	}

	return nil
}

// Shutdown closes the database connections.
// It should be called once at the end of the application.
func Shutdown() {
	err := DB.shutdownRedis()
	if err != nil {
		log.Fatalln(err)
	}
}
