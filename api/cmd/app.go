package cmd

import (
	"api/internal/store"
	"api/models/models"
	"api/pkg/config"
	"api/pkg/db"
	"api/pkg/eventbus"
	"api/pkg/log"
	"api/service/auth"
	"api/worker"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// App is the running process: an HTTP server plus the single poller supervisor.
type App struct {
	httpServer *http.Server
	poller     *worker.SessionManager
	bus        *eventbus.ChannelBus
	latest     *eventbus.LatestStore
	ctx        context.Context
	cancel     context.CancelFunc
}

// InitTask is a named startup step.
type InitTask struct {
	Name string
	Task func() error
}

// Begin logs the start of an init task.
func (it *InitTask) Begin(prefix string) {
	log.Infof("%s %s%s%s %s...%s ", prefix, log.Orange, it.Name, log.Reset, log.Grey, log.Reset)
}

// Create initializes the application, starts the HTTP server, the poller
// supervisor, and the settings listener — all unconditionally.
func Create(opts *Options) *App {
	if err := log.SetupLogger(opts.Mode); err != nil {
		panic(fmt.Sprintf("Failed to set up logger. details: %s", err.Error()))
	}

	initTasks := []InitTask{
		{Name: "Setup environment", Task: func() error { return config.SetupEnvironment(opts.Mode) }},
		{Name: "Setup DB", Task: func() error { return db.Setup() }},
		{Name: "Initialize auth", Task: initializeAuth},
		{Name: "Apply log level", Task: applyLogLevel},
	}

	for idx, task := range initTasks {
		task.Begin(fmt.Sprintf("(%d/%d)", idx+1, len(initTasks)))
		if err := task.Task(); err != nil {
			log.Fatalf("Init task %s failed. details: %s", task.Name, err.Error())
		}
	}
	log.Printf("%sInitialization complete%s", log.Orange, log.Reset)

	ctx, cancel := context.WithCancel(context.Background())
	app := &App{ctx: ctx, cancel: cancel}

	app.bus = eventbus.NewChannelBus()
	app.latest = eventbus.NewLatestStore()
	app.poller = worker.NewSessionManager(app.bus, app.latest)

	app.httpServer = &http.Server{
		Addr:    fmt.Sprintf("0.0.0.0:%d", config.Config.Port),
		Handler: app.buildHandler(auth.NewService()),
	}
	go func() {
		log.Printf("%sHTTP server listening on %s0.0.0.0:%d%s", log.Bold, log.Orange, config.Config.Port, log.Reset)
		if err := app.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalln(fmt.Errorf("failed to start http server. details: %w", err))
		}
	}()

	go app.poller.Start(ctx)
	go store.RunTokenPrune(ctx, slog.Default(), db.DB.Store, time.Hour)
	go store.RunHistoryRetention(ctx, slog.Default(), db.DB.Store, app.poller, time.Minute)

	return app
}

// Stop performs a deterministic, ordered shutdown: cancel the root context, drain
// the poller's goroutines, then shut down the HTTP server.
func (app *App) Stop() {
	app.cancel()

	if app.poller != nil {
		app.poller.Stop(5 * time.Second)
	}

	if app.httpServer != nil {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := app.httpServer.Shutdown(shutdownCtx); err != nil {
			log.Fatalln(fmt.Errorf("failed to shutdown server. details: %w", err))
		}
		log.Println("HTTP server shutdown complete")
	}

	log.Println("Server exited successfully")
}

// initializeAuth initializes the authentication system, setting the bootstrap
// password if none is set yet.
func initializeAuth() error {
	authService := auth.NewService()
	usedBootstrap, err := authService.InitializePassword()
	if err != nil {
		return fmt.Errorf("failed to initialize auth: %w", err)
	}

	if usedBootstrap {
		log.Printf("%sInitialized with bootstrap password - change it via Settings%s", log.Orange, log.Reset)
	}

	return nil
}

// applyLogLevel reads the persisted log level from the store and applies it,
// falling back to Info when unset or invalid.
func applyLogLevel() error {
	level := models.LogLevelInfo
	if setting, err := db.DB.Store.GetSetting(context.Background(), "log_level"); err == nil {
		if lvl := models.LogLevel(setting.Value); lvl.IsValid() {
			level = lvl
		}
	}
	zapLevel, err := level.ToZapLevel()
	if err != nil {
		return nil
	}
	log.SetLogLevel(zapLevel)
	return nil
}
