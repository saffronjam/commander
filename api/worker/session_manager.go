package worker

import (
	sessionid "api/internal/session"
	"api/internal/store"
	"api/models/models"
	"api/pkg/db"
	"api/pkg/eventbus"
	"api/pkg/log"
	"api/service"
	"api/service/client"
	"api/service/session"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"
)

// historyEnabledTypes defines which event types support historical data storage.
var historyEnabledTypes = map[models.SatisfactoryEventType]bool{
	models.SatisfactoryEventCircuits:       true,
	models.SatisfactoryEventGeneratorStats: true,
	models.SatisfactoryEventProdStats:      true,
	models.SatisfactoryEventFactoryStats:   true,
	models.SatisfactoryEventSinkStats:      true,
}

func isHistoryEnabledType(eventType models.SatisfactoryEventType) bool {
	return historyEnabledTypes[eventType]
}

func toModelsSession(s store.Session) *models.Session {
	return &models.Session{
		ID:          string(s.ID),
		Name:        s.Name,
		Address:     s.Address,
		SessionName: s.SessionName,
		IsPaused:    s.IsPaused,
		CreatedAt:   s.CreatedAt,
	}
}

// publisherState tracks the state of a session's publisher. The poll goroutines
// read it while the supervisor writes it, so every field but cancel and the
// tracker is behind mu.
type publisherState struct {
	cancel          context.CancelFunc
	address         string
	isDisconnected  bool
	currentSaveName string
	mu              sync.RWMutex
	gameTimeTracker *session.GameTimeTracker
}

// GetSaveName returns the current save name for this publisher.
func (ps *publisherState) GetSaveName() string {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	return ps.currentSaveName
}

// SetSaveName updates the current save name for this publisher.
func (ps *publisherState) SetSaveName(name string) {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	ps.currentSaveName = name
}

// IsDisconnected reports whether this publisher is polling in disconnected mode.
func (ps *publisherState) IsDisconnected() bool {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	return ps.isDisconnected
}

// SetDisconnected records the publisher's polling mode.
func (ps *publisherState) SetDisconnected(disconnected bool) {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	ps.isDisconnected = disconnected
}

// GameTimeTracker returns the game time tracker for this publisher.
func (ps *publisherState) GameTimeTracker() *session.GameTimeTracker {
	return ps.gameTimeTracker
}

type connState struct {
	state        models.ConnectionState
	online       bool
	disconnected bool
	reason       models.ConnectivityReason
}

// SessionManager is the single in-process supervisor that owns one poll loop per
// active session and is the sole producer onto the eventbus + LatestStore.
type SessionManager struct {
	bus        *eventbus.ChannelBus
	latest     *eventbus.LatestStore
	publishers map[string]*publisherState // sessionID -> publisher state
	conn       map[string]connState       // sessionID -> connectivity
	mu         sync.RWMutex
	wg         sync.WaitGroup
	baseCtx    context.Context
}

// NewSessionManager creates a session manager wired to the eventbus + LatestStore.
func NewSessionManager(bus *eventbus.ChannelBus, latest *eventbus.LatestStore) *SessionManager {
	return &SessionManager{
		bus:        bus,
		latest:     latest,
		publishers: make(map[string]*publisherState),
		conn:       make(map[string]connState),
	}
}

// listSessions returns the durable session config from the SQLite store.
func (sm *SessionManager) listSessions(ctx context.Context) ([]*models.Session, error) {
	rows, err := db.DB.Store.ListSessions(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*models.Session, len(rows))
	for i, s := range rows {
		out[i] = toModelsSession(s)
	}
	return out, nil
}

// getSession returns one session, or (nil, nil) if it no longer exists.
func (sm *SessionManager) getSession(ctx context.Context, id string) (*models.Session, error) {
	s, err := db.DB.Store.GetSession(ctx, sessionid.ID(id))
	if errors.Is(err, store.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return toModelsSession(s), nil
}

// Start loads sessions, starts a publisher per non-paused session, and launches
// the reconcile loop. Non-blocking; the App owns the lifetime.
func (sm *SessionManager) Start(ctx context.Context) {
	log.Infoln("Starting session manager...")

	sm.baseCtx = ctx

	sessions, err := sm.listSessions(ctx)
	if err != nil {
		log.PrettyError(fmt.Errorf("failed to load sessions: %w", err))
		return
	}

	log.Infof("Found %d existing sessions", len(sessions))
	for _, sess := range sessions {
		if !sess.IsPaused {
			sm.startPublisher(ctx, sess)
		} else {
			log.Infof("Skipping paused session: %s (%s)", sess.Name, sess.ID)
		}
	}

	sm.wg.Go(func() {
		sm.watchForNewSessions(ctx)
	})
}

// watchForNewSessions periodically reconciles publishers against the store.
func (sm *SessionManager) watchForNewSessions(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sessions, err := sm.listSessions(ctx)
			if err != nil {
				log.PrettyError(fmt.Errorf("failed to list sessions: %w", err))
				continue
			}

			sm.mu.RLock()
			for _, sess := range sessions {
				running, isRunning := sm.publishers[sess.ID]
				if isRunning && !sess.IsPaused && running.address != sess.Address {
					sm.mu.RUnlock()
					sm.RestartSession(sessionid.ID(sess.ID))
					sm.mu.RLock()
					continue
				}
				if sess.IsPaused && isRunning {
					sm.mu.RUnlock()
					log.Infof("Stopping publisher for paused session: %s (%s)", sess.Name, sess.ID)
					sm.stopPublisher(sess.ID)
					sm.mu.RLock()
				} else if !sess.IsPaused && !isRunning {
					sm.mu.RUnlock()
					sm.startPublisher(ctx, sess)
					sm.mu.RLock()
				}
			}
			for sessionID := range sm.publishers {
				found := false
				for _, sess := range sessions {
					if sess.ID == sessionID {
						found = true
						break
					}
				}
				if !found {
					sm.mu.RUnlock()
					sm.stopPublisher(sessionID)
					sm.mu.RLock()
				}
			}
			sm.mu.RUnlock()
		}
	}
}

// startPublisher starts a poll loop for a session (unconditional after the
// already-running check).
func (sm *SessionManager) startPublisher(parentCtx context.Context, sess *models.Session) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if _, exists := sm.publishers[sess.ID]; exists {
		log.Warnf("Publisher for session %s already running", sess.ID)
		return
	}

	ctx, cancel := context.WithCancel(parentCtx)
	state := &publisherState{
		cancel:          cancel,
		address:         sess.Address,
		isDisconnected:  sess.IsDisconnected,
		currentSaveName: sess.SessionName,
		gameTimeTracker: session.NewGameTimeTracker(),
	}
	sm.publishers[sess.ID] = state
	sm.setConnecting(sess.ID)

	log.Infof("Starting publisher for session: %s (%s)", sess.Name, sess.ID)

	sm.wg.Add(1)
	go sm.publishLoop(ctx, sess, state)
}

// stopPublisher stops the publisher for a session id.
func (sm *SessionManager) stopPublisher(sessionID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if state, exists := sm.publishers[sessionID]; exists {
		state.cancel()
		delete(sm.publishers, sessionID)
		log.Infof("Stopped publisher for session: %s", sessionID)
	}
}

// RestartSession reconnects a session whose address changed. It is a no-op when
// the running publisher is already pointed at the stored address, so callers can
// invoke it after any session update without checking first.
func (sm *SessionManager) RestartSession(id sessionid.ID) {
	sess, err := sm.getSession(context.Background(), string(id))
	if err != nil || sess == nil {
		return
	}

	sm.mu.Lock()
	defer sm.mu.Unlock()

	state, running := sm.publishers[string(id)]
	if !running || state.address == sess.Address {
		return
	}

	log.Infof("Session address changed, reconnecting: %s (%s)", sess.Name, sess.ID)

	// A new address is a new server. Drop the publisher outright rather than
	// restarting it, so the replacement inherits neither the light-polling mode
	// nor the previous save name — carrying that over would file the new server's
	// first samples under the old save.
	state.cancel()
	delete(sm.publishers, string(id))

	sess.IsDisconnected = false
	sess.SessionName = ""
	sm.setConnecting(sess.ID)
	sm.restartPublisherLocked(sess.ID, sess)
}

// StartSession is the Poller interface entrypoint: load the session and start it.
func (sm *SessionManager) StartSession(id sessionid.ID) {
	sess, err := sm.getSession(context.Background(), string(id))
	if err != nil || sess == nil {
		log.Warnf("StartSession: session %s not found: %v", id, err)
		return
	}
	if sm.baseCtx == nil {
		return
	}
	sm.startPublisher(sm.baseCtx, sess)
}

// StopSession is the Poller interface entrypoint.
func (sm *SessionManager) StopSession(id sessionid.ID) {
	sm.stopPublisher(string(id))
	if sm.latest != nil {
		sm.latest.Clear(string(id))
	}
}

// PreviewSession probes a game server at the address and returns its session info.
func (sm *SessionManager) PreviewSession(ctx context.Context, address string) (models.SessionInfo, error) {
	c := service.NewClientWithAddress(address)
	info, err := c.GetSessionInfo(ctx)
	if err != nil {
		return models.SessionInfo{}, err
	}
	return *info, nil
}

// ValidateSession probes the game server for an existing session.
func (sm *SessionManager) ValidateSession(ctx context.Context, id sessionid.ID) (models.SessionInfo, error) {
	sess, err := sm.getSession(ctx, string(id))
	if err != nil || sess == nil {
		return models.SessionInfo{}, fmt.Errorf("session %s not found", id)
	}
	c := service.NewClientWithAddress(sess.Address)
	info, err := c.GetSessionInfo(ctx)
	if err != nil {
		return models.SessionInfo{}, err
	}
	return *info, nil
}

// Stop performs graceful shutdown bounded by timeout.
func (sm *SessionManager) Stop(timeout time.Duration) {
	log.Infoln("Stopping session manager...")

	sm.mu.Lock()
	for sessionID, state := range sm.publishers {
		state.cancel()
		delete(sm.publishers, sessionID)
	}
	sm.mu.Unlock()

	done := make(chan struct{})
	go func() {
		sm.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Infoln("Session manager stopped gracefully")
	case <-time.After(timeout):
		log.Warnln("Timed out waiting for poll goroutines to stop")
	}
}

// --- Snapshotter (graph.Snapshotter) ---

// Latest returns the poller's latest decoded payload for one (session, dataType).
func (sm *SessionManager) Latest(sessionID sessionid.ID, dataType string) (any, bool) {
	save := sm.CurrentSaveName(sessionID)
	if save == "" || sm.latest == nil {
		return nil, false
	}
	e, ok := sm.latest.Get(string(sessionID), save, dataType)
	if !ok {
		return nil, false
	}
	return e.Data, true
}

// CurrentSaveName returns the active save name for a session.
func (sm *SessionManager) CurrentSaveName(sessionID sessionid.ID) string {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	if state, ok := sm.publishers[string(sessionID)]; ok {
		return state.GetSaveName()
	}
	return ""
}

// Stage reports INIT until every required event type has been observed.
func (sm *SessionManager) Stage(sessionID sessionid.ID) models.SessionStage {
	save := sm.CurrentSaveName(sessionID)
	if save == "" || sm.latest == nil {
		return models.SessionStageInit
	}
	for _, t := range models.RequiredEventTypes {
		if _, ok := sm.latest.Get(string(sessionID), save, string(t)); !ok {
			return models.SessionStageInit
		}
	}
	return models.SessionStageReady
}

// Connectivity returns the derived live connectivity for a session.
func (sm *SessionManager) Connectivity(sessionID sessionid.ID) models.ConnectivityStatus {
	sm.mu.RLock()
	c := sm.conn[string(sessionID)]
	sm.mu.RUnlock()
	reason := c.reason
	if reason == "" {
		reason = models.ConnectivityReasonNone
	}
	state := c.state
	if state == "" {
		state = models.ConnectionStateConnecting
	}
	return models.ConnectivityStatus{
		IsOnline:       c.online,
		IsDisconnected: c.disconnected,
		State:          state,
		Stage:          sm.Stage(sessionID),
		Reason:         reason,
	}
}

// --- HistoryFrontier (store.HistoryFrontier) ---

// Series reports the active (session, save, dataType) history series the
// retention pruner should bound.
func (sm *SessionManager) Series() []store.HistorySeriesKey {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	var keys []store.HistorySeriesKey
	for sid, state := range sm.publishers {
		save := state.GetSaveName()
		if save == "" {
			continue
		}
		for t := range historyEnabledTypes {
			keys = append(keys, store.HistorySeriesKey{
				SessionID: sessionid.ID(sid),
				SaveName:  save,
				DataType:  string(t),
			})
		}
	}
	return keys
}

// CurrentGameTime returns the latest observed game time for a series.
func (sm *SessionManager) CurrentGameTime(key store.HistorySeriesKey) int64 {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	if state, ok := sm.publishers[string(key.SessionID)]; ok {
		return state.gameTimeTracker.CurrentGameTime()
	}
	return 0
}

func (sm *SessionManager) setConn(sessionID string, online, disconnected bool, reason models.ConnectivityReason) {
	state := models.ConnectionStateOffline
	if online {
		state = models.ConnectionStateOnline
		reason = models.ConnectivityReasonNone
	}
	sm.mu.Lock()
	sm.conn[sessionID] = connState{
		state:        state,
		online:       online,
		disconnected: disconnected,
		reason:       reason,
	}
	sm.mu.Unlock()
}

// setConnecting marks a session as attempting to reach FRM. Called whenever a
// publisher starts, so a fresh or restarted session reads as connecting rather
// than offline until FRM actually answers or fails.
func (sm *SessionManager) setConnecting(sessionID string) {
	sm.conn[sessionID] = connState{
		state:  models.ConnectionStateConnecting,
		reason: models.ConnectivityReasonNone,
	}
}

// publishLoop runs the event publishing loop for a session.
func (sm *SessionManager) publishLoop(ctx context.Context, sess *models.Session, state *publisherState) {
	defer sm.wg.Done()

	frmClient := service.NewClientWithAddress(sess.Address)
	frmClient.SetDisconnectedCallback(func() {
		log.Infof("Session is offline: %s (%s)", sess.Name, sess.ID)
		sm.transitionToDisconnected(sess.ID)
	})

	var apiClient client.Client = frmClient

	handler := func(event *models.SatisfactoryEvent) {
		if ctx.Err() != nil {
			return
		}

		saveName := state.GetSaveName()

		if isHistoryEnabledType(event.Type) {
			gameTimeID := state.gameTimeTracker.CurrentGameTime()
			if saveName != "" && gameTimeID > 0 {
				event.GameTimeID = gameTimeID

				if db.DB.Store != nil {
					if data, err := json.Marshal(event.Data); err == nil {
						if err := db.DB.Store.UpsertHistoryPoint(ctx, sessionid.ID(sess.ID), saveName, string(event.Type), gameTimeID, data); err != nil {
							log.Warnf("Failed to upsert history point for session %s type %s: %v", sess.ID, event.Type, err)
						}
					}
				}
			}
		}

		if event.Type == models.SatisfactoryEventApiStatus {
			status := event.Data.(*models.SatisfactoryApiStatus)
			sm.setConn(sess.ID, status.Running, state.IsDisconnected(), apiClient.FailureReason())
			if status.Running && sess.IsDisconnected {
				sm.transitionToConnected(sess.ID)
			}
		}

		if saveName == "" {
			return
		}

		busEvent := eventbus.SatisfactoryEvent{
			SessionID:  sess.ID,
			SaveName:   saveName,
			DataType:   string(event.Type),
			Data:       event.Data,
			GameTimeID: event.GameTimeID,
		}
		if sm.latest != nil {
			sm.latest.Put(busEvent)
		}
		if sm.bus != nil {
			sm.bus.Publish(eventbus.Event{
				Kind:      eventbus.KindSatisfactory,
				SessionID: sess.ID,
				SaveName:  saveName,
				DataType:  string(event.Type),
				Payload:   busEvent,
			})
		}
	}

	sm.wg.Add(1)
	go sm.monitorSessionInfo(ctx, sess, apiClient, state)

	var err error
	if sess.IsDisconnected {
		log.Infof("Starting in disconnected mode: %s (%s)", sess.Name, sess.ID)
		err = apiClient.SetupLightPolling(ctx, handler)
	} else {
		err = apiClient.SetupEventStream(ctx, handler)
	}

	if err != nil {
		log.PrettyError(fmt.Errorf("failed to set up polling for session %s: %w", sess.ID, err))
		sm.setConn(sess.ID, false, state.IsDisconnected(), apiClient.FailureReason())
		return
	}

	<-ctx.Done()
	log.Infof("Publisher stopped for session: %s (%s)", sess.Name, sess.ID)
}

// monitorSessionInfo periodically refreshes session info + save name.
func (sm *SessionManager) monitorSessionInfo(ctx context.Context, sess *models.Session, apiClient client.Client, state *publisherState) {
	defer sm.wg.Done()

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	lastSessionName := state.GetSaveName()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			fetchCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			sessionInfo, err := apiClient.GetSessionInfo(fetchCtx)
			cancel()
			if err != nil {
				log.Debugf("Failed to fetch session info for %s: %v", sess.ID, err)
				continue
			}

			state.gameTimeTracker.Update(int64(sessionInfo.TotalPlayDuration))

			if sessionInfo.SessionName != lastSessionName {
				log.Infof("Session info changed for %s: %s -> %s", sess.ID, lastSessionName, sessionInfo.SessionName)
				lastSessionName = sessionInfo.SessionName
				state.SetSaveName(sessionInfo.SessionName)

				if err := db.DB.Store.UpdateSessionSaveName(ctx, sessionid.ID(sess.ID), sessionInfo.SessionName); err != nil {
					log.Warnf("Failed to persist save name for %s: %v", sess.ID, err)
					continue
				}

				updated, err := sm.getSession(ctx, sess.ID)
				if err != nil || updated == nil {
					log.Warnf("Failed to reload session %s after save name change: %v", sess.ID, err)
					continue
				}

				if sm.bus != nil {
					sm.bus.Publish(eventbus.Event{
						Kind:      eventbus.KindSatisfactory,
						SessionID: sess.ID,
						SaveName:  sessionInfo.SessionName,
						DataType:  string(models.SatisfactoryEventSessionUpdate),
						Payload: eventbus.SatisfactoryEvent{
							SessionID: sess.ID,
							SaveName:  sessionInfo.SessionName,
							DataType:  string(models.SatisfactoryEventSessionUpdate),
							Data:      updated,
						},
					})
				}
			}
		}
	}
}

func (sm *SessionManager) transitionToDisconnected(sessionID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Light polling keeps failing while the server is unreachable, and each
	// restart builds a fresh client whose own once-only guard is reset — so the
	// callback fires again every time the failure threshold is re-reached.
	// Restarting here would loop forever; the publisher is already in the mode
	// this transition wants.
	if state, exists := sm.publishers[sessionID]; exists && state.IsDisconnected() {
		return
	}

	sess, err := sm.getSession(context.Background(), sessionID)
	if err != nil || sess == nil {
		log.Warnf("Failed to get session %s for disconnection: %v", sessionID, err)
		return
	}

	sess.IsDisconnected = true
	sess.IsOnline = false

	if state, exists := sm.publishers[sessionID]; exists {
		state.SetDisconnected(true)
	}
	sm.conn[sessionID] = connState{
		state:        models.ConnectionStateOffline,
		online:       false,
		disconnected: true,
		reason:       sm.conn[sessionID].reason,
	}
	sm.publishConnectivity(sessionID, false)

	log.Infof("Restarting session %s in disconnected mode", sessionID)
	sm.restartPublisherLocked(sessionID, sess)
}

func (sm *SessionManager) transitionToConnected(sessionID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Symmetric with transitionToDisconnected: a publisher already polling in
	// connected mode has nothing to transition to.
	if state, exists := sm.publishers[sessionID]; exists && !state.IsDisconnected() {
		return
	}

	sess, err := sm.getSession(context.Background(), sessionID)
	if err != nil || sess == nil {
		log.Warnf("Failed to get session %s for reconnection: %v", sessionID, err)
		return
	}

	sess.IsDisconnected = false
	sess.IsOnline = true

	if state, exists := sm.publishers[sessionID]; exists {
		state.SetDisconnected(false)
	}
	sm.conn[sessionID] = connState{
		state:        models.ConnectionStateOnline,
		online:       true,
		disconnected: false,
		reason:       models.ConnectivityReasonNone,
	}
	sm.publishConnectivity(sessionID, true)

	log.Infof("Restarting session %s in connected mode", sessionID)
	sm.restartPublisherLocked(sessionID, sess)
}

func (sm *SessionManager) publishConnectivity(sessionID string, online bool) {
	if sm.bus == nil {
		return
	}
	sm.bus.Publish(eventbus.Event{
		Kind:      eventbus.KindConnectivity,
		SessionID: sessionID,
		Payload: eventbus.ConnectivityEvent{
			SessionID: sessionID,
			Online:    online,
			At:        time.Now(),
		},
	})
}

// restartPublisherLocked cancels the current publisher and starts a new one,
// derived from the supervisor base context. Assumes the lock is held.
func (sm *SessionManager) restartPublisherLocked(sessionID string, sess *models.Session) {
	var currentSaveName string
	var gameTimeTracker *session.GameTimeTracker
	if existingState, exists := sm.publishers[sessionID]; exists {
		currentSaveName = existingState.GetSaveName()
		gameTimeTracker = existingState.gameTimeTracker
		existingState.cancel()
		delete(sm.publishers, sessionID)
	} else {
		currentSaveName = sess.SessionName
		gameTimeTracker = session.NewGameTimeTracker()
	}

	parentCtx := sm.baseCtx
	if parentCtx == nil {
		parentCtx = context.Background()
	}
	ctx, cancel := context.WithCancel(parentCtx)
	state := &publisherState{
		cancel:          cancel,
		address:         sess.Address,
		isDisconnected:  sess.IsDisconnected,
		currentSaveName: currentSaveName,
		gameTimeTracker: gameTimeTracker,
	}
	sm.publishers[sessionID] = state

	sm.wg.Add(1)
	go sm.publishLoop(ctx, sess, state)
}
