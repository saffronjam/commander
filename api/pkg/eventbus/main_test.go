package eventbus_test

import (
	"os"
	"testing"

	"api/models/mode"
	"api/pkg/log"
)

func TestMain(m *testing.M) {
	_ = log.SetupLogger(mode.Test)
	os.Exit(m.Run())
}
