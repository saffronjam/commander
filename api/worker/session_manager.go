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
	"api/service/frm_client"
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
		ID:        string(s.ID),
		Name:      s.Name,
		Address:   s.Address,
		SaveName:  s.SaveName,
		IsPaused:  s.IsPaused,
		CreatedAt: s.CreatedAt,
	}
}

// publisherState tracks the state of a session's publisher. The poll goroutines
// read it while the supervisor writes it, so every mutable field is behind mu.
// saveName has no setter: a session is pinned to one save for its lifetime.
type publisherState struct {
	cancel             context.CancelFunc
	name               string
	address            string
	saveName           string
	isDisconnected     bool
	saveConfirmed      bool
	mismatchedSaveName string
	mu                 sync.RWMutex
	gameTimeTracker    *session.GameTimeTracker
}

// SaveName returns the save this publisher's session is pinned to.
func (ps *publisherState) SaveName() string {
	return ps.saveName
}

// session rebuilds the running session config. Everything restartPublisherLocked
// needs lives here, so a state transition never has to re-read the store.
func (ps *publisherState) session(sessionID string) *models.Session {
	return &models.Session{
		ID:             sessionID,
		Name:           ps.name,
		Address:        ps.address,
		SaveName:       ps.saveName,
		IsDisconnected: ps.IsDisconnected(),
	}
}

// SaveConfirmed reports whether the server has been asked which save it is
// running since the last outage, and answered with the pinned one.
//
// A save can only change by the world being torn down, which stops FRM's server,
// so every save change is preceded by an outage. Requiring a fresh confirmation
// after any outage is therefore enough to guarantee no sample from another save is
// ever ingested, rather than merely narrowing the window.
func (ps *publisherState) SaveConfirmed() bool {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	return ps.saveConfirmed
}

// ConfirmSave records that the server reported the pinned save.
func (ps *publisherState) ConfirmSave() {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	ps.saveConfirmed = true
}

// InvalidateSave suspends ingestion until the server has been asked which save it
// is running. The observed mismatch name is left alone so a session that was
// already mismatched keeps reporting why while the server is unreachable.
func (ps *publisherState) InvalidateSave() {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	ps.saveConfirmed = false
}

// SaveMismatch reports whether the server is running a save other than the
// pinned one, and which save that is.
func (ps *publisherState) SaveMismatch() (bool, string) {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	return ps.mismatchedSaveName != "", ps.mismatchedSaveName
}

// SetMismatchedSaveName records the save the server has loaded instead of the
// pinned one. The empty string clears the mismatch.
func (ps *publisherState) SetMismatchedSaveName(name string) {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	ps.mismatchedSaveName = name
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
	state              models.ConnectionState
	online             bool
	disconnected       bool
	reason             models.ConnectivityReason
	mismatchedSaveName string
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
		name:            sess.Name,
		address:         sess.Address,
		saveName:        sess.SaveName,
		isDisconnected:  sess.IsDisconnected,
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
	// nor a stale save mismatch from the previous address.
	state.cancel()
	delete(sm.publishers, string(id))

	sess.IsDisconnected = false
	sm.setConnecting(sess.ID)
	sm.restartPublisherLocked(sess.ID, sess)
}

// DiscoverSessions sweeps the caller's network for reachable FRM servers.
func (sm *SessionManager) DiscoverSessions(ctx context.Context, clientIP string, ports []int) ([]models.DiscoveredServer, error) {
	targets, err := frm_client.DiscoverTargets(clientIP, ports)
	if err != nil {
		return nil, err
	}
	return frm_client.ScanForServers(ctx, targets), nil
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

// PreviewSession probes a game server at the address and returns its session
// info. This is the only way a save name enters the system.
func (sm *SessionManager) PreviewSession(ctx context.Context, address string) (models.SessionInfo, error) {
	info, err := frm_client.ProbeSessionInfo(ctx, address)
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
	if sm.latest == nil {
		return nil, false
	}
	e, ok := sm.latest.Get(string(sessionID), dataType)
	if !ok {
		return nil, false
	}
	return e.Data, true
}

// Stage reports INIT until every required event type has been observed.
func (sm *SessionManager) Stage(sessionID sessionid.ID) models.SessionStage {
	if sm.latest == nil {
		return models.SessionStageInit
	}
	for _, t := range models.RequiredEventTypes {
		if _, ok := sm.latest.Get(string(sessionID), string(t)); !ok {
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
		IsOnline:           c.online,
		IsDisconnected:     c.disconnected,
		State:              state,
		Stage:              sm.Stage(sessionID),
		Reason:             reason,
		MismatchedSaveName: c.mismatchedSaveName,
	}
}

// --- HistoryFrontier (store.HistoryFrontier) ---

// Series reports the active (session, dataType) history series the retention
// pruner should bound. A mismatched session is skipped: its game-time tracker is
// not advancing, so a cutoff derived from it would be meaningless.
func (sm *SessionManager) Series() []store.HistorySeriesKey {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	var keys []store.HistorySeriesKey
	for sid, state := range sm.publishers {
		if mismatched, _ := state.SaveMismatch(); mismatched {
			continue
		}
		for t := range historyEnabledTypes {
			keys = append(keys, store.HistorySeriesKey{
				SessionID: sessionid.ID(sid),
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

// setConn is the only place a connection state is derived. Offline outranks a
// save mismatch: a dead transport is the more actionable message, and it is the
// one a ConnectivityReason can explain. The mismatch is read from the publisher
// rather than passed in, so the api-status tick cannot overwrite it.
func (sm *SessionManager) setConn(sessionID string, online, disconnected bool, reason models.ConnectivityReason) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	state := models.ConnectionStateOffline
	mismatchedSaveName := ""
	if online {
		state = models.ConnectionStateOnline
		reason = models.ConnectivityReasonNone
		if ps, ok := sm.publishers[sessionID]; ok {
			if mismatched, observed := ps.SaveMismatch(); mismatched {
				state = models.ConnectionStateSaveMismatch
				mismatchedSaveName = observed
			}
		}
	}
	sm.conn[sessionID] = connState{
		state:              state,
		online:             online,
		disconnected:       disconnected,
		reason:             reason,
		mismatchedSaveName: mismatchedSaveName,
	}
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

		// Connectivity bookkeeping runs before the ingestion gate so a server that
		// goes away while the wrong save is loaded is still noticed as offline.
		if event.Type == models.SatisfactoryEventApiStatus {
			status := event.Data.(*models.SatisfactoryApiStatus)
			if !status.Running {
				state.InvalidateSave()
			}
			sm.setConn(sess.ID, status.Running, state.IsDisconnected(), apiClient.FailureReason())
			if status.Running && sess.IsDisconnected {
				sm.transitionToConnected(sess.ID)
			}
		}

		// Everything below writes into the session, so it waits until the server has
		// confirmed which save it is running.
		if !state.SaveConfirmed() {
			return
		}

		if isHistoryEnabledType(event.Type) {
			gameTimeID := state.gameTimeTracker.CurrentGameTime()
			if gameTimeID > 0 {
				event.GameTimeID = gameTimeID

				if db.DB.Store != nil {
					if data, err := json.Marshal(event.Data); err == nil {
						if err := db.DB.Store.UpsertHistoryPoint(ctx, sessionid.ID(sess.ID), string(event.Type), gameTimeID, data); err != nil {
							log.Warnf("Failed to upsert history point for session %s type %s: %v", sess.ID, event.Type, err)
						}
					}
				}
			}
		}

		busEvent := eventbus.SatisfactoryEvent{
			SessionID:  sess.ID,
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
				DataType:  string(event.Type),
				Payload:   busEvent,
			})
		}
	}

	sm.wg.Add(1)
	go sm.monitorSessionInfo(ctx, sess, apiClient)

	var err error
	// Confirm the save before any endpoint fires. SetupEventStream polls every
	// endpoint once immediately, and the slowest of them do not poll again for two
	// minutes, so a first burst rejected by the ingestion gate would leave the
	// session short of the data it needs to be usable for that long.
	confirmCtx, cancelConfirm := context.WithTimeout(ctx, 5*time.Second)
	if info, infoErr := apiClient.GetSessionInfo(confirmCtx); infoErr == nil {
		sm.observeSessionInfo(sess.ID, info)
	}
	cancelConfirm()

	mismatched, _ := state.SaveMismatch()
	if sess.IsDisconnected || mismatched {
		log.Infof("Starting in light polling mode: %s (%s)", sess.Name, sess.ID)
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

// saveProbeInterval is how often the pinned save is re-confirmed. It is short
// because it is the gate on all ingestion: nothing is written into a session
// between an outage and the next successful probe, so the interval is the upper
// bound on how long a healthy session stalls after a blip. getSessionInfo is a
// single small response, and this poll deliberately does not go through the
// request queue that serialises the domain endpoints.
const saveProbeInterval = time.Second

// monitorSessionInfo re-confirms which save the server is running. It is how a
// mismatch is detected, how a session recovers from one, and how ingestion is
// re-enabled after an outage.
func (sm *SessionManager) monitorSessionInfo(ctx context.Context, sess *models.Session, apiClient client.Client) {
	defer sm.wg.Done()

	ticker := time.NewTicker(saveProbeInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			fetchCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			sessionInfo, err := apiClient.GetSessionInfo(fetchCtx)
			cancel()
			if err != nil {
				// The server going away is how a save change begins, so an
				// unanswered probe suspends ingestion until it answers again.
				sm.invalidateSave(sess.ID)
				log.Debugf("Failed to fetch session info for %s: %v", sess.ID, err)
				continue
			}
			sm.observeSessionInfo(sess.ID, sessionInfo)
		}
	}
}

// invalidateSave suspends ingestion for a session until its save is re-confirmed.
func (sm *SessionManager) invalidateSave(sessionID string) {
	sm.mu.RLock()
	state, exists := sm.publishers[sessionID]
	sm.mu.RUnlock()
	if exists {
		state.InvalidateSave()
	}
}

// observeSessionInfo reconciles one session-info reading against the pinned save.
// It reads the live publisher rather than a captured pointer, so a reading that
// lands after a restart acts on the publisher that is actually running.
//
// The game-time tracker is only fed while the pinned save is loaded: it drives
// the history retention cutoff, so a foreign save's play duration would prune the
// pinned save's history away.
func (sm *SessionManager) observeSessionInfo(sessionID string, info *models.SessionInfo) {
	if info == nil {
		return
	}

	sm.mu.RLock()
	state, exists := sm.publishers[sessionID]
	sm.mu.RUnlock()
	if !exists {
		return
	}

	if info.SaveName != state.SaveName() {
		sm.transitionToSaveMismatch(sessionID, info.SaveName)
		return
	}

	state.gameTimeTracker.Update(int64(info.TotalPlayDuration))
	state.ConfirmSave()
	sm.transitionFromSaveMismatch(sessionID)
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
	sm.publishConnectivity(sessionID)

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
	sm.publishConnectivity(sessionID)

	log.Infof("Restarting session %s in connected mode", sessionID)
	sm.restartPublisherLocked(sessionID, sess)
}

// transitionToSaveMismatch stops ingesting for a session whose server has the
// wrong save loaded and drops it to light polling, which keeps monitorSessionInfo
// running so the session recovers when the pinned save is loaded again.
func (sm *SessionManager) transitionToSaveMismatch(sessionID, observed string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	state, exists := sm.publishers[sessionID]
	if !exists {
		return
	}
	if mismatched, previous := state.SaveMismatch(); mismatched && previous == observed {
		return
	}

	log.Infof("Session %s is pinned to a save the server does not have loaded: %q", sessionID, observed)
	state.InvalidateSave()
	state.SetMismatchedSaveName(observed)
	sm.conn[sessionID] = connState{
		state:              models.ConnectionStateSaveMismatch,
		online:             true,
		disconnected:       state.IsDisconnected(),
		reason:             models.ConnectivityReasonNone,
		mismatchedSaveName: observed,
	}
	sm.publishConnectivity(sessionID)
	sm.restartPublisherLocked(sessionID, state.session(sessionID))
}

// transitionFromSaveMismatch resumes a session whose server is back on the
// pinned save.
func (sm *SessionManager) transitionFromSaveMismatch(sessionID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	state, exists := sm.publishers[sessionID]
	if !exists {
		return
	}
	if mismatched, _ := state.SaveMismatch(); !mismatched {
		return
	}

	log.Infof("Session %s is back on its pinned save", sessionID)
	state.SetMismatchedSaveName("")
	sm.conn[sessionID] = connState{
		state:        models.ConnectionStateOnline,
		online:       true,
		disconnected: state.IsDisconnected(),
		reason:       models.ConnectivityReasonNone,
	}
	sm.publishConnectivity(sessionID)
	sm.restartPublisherLocked(sessionID, state.session(sessionID))
}

func (sm *SessionManager) publishConnectivity(sessionID string) {
	if sm.bus == nil {
		return
	}
	sm.bus.Publish(eventbus.Event{
		Kind:      eventbus.KindConnectivity,
		SessionID: sessionID,
		Payload: eventbus.ConnectivityEvent{
			SessionID: sessionID,
			At:        time.Now(),
		},
	})
}

// restartPublisherLocked cancels the current publisher and starts a new one,
// derived from the supervisor base context. Assumes the lock is held.
func (sm *SessionManager) restartPublisherLocked(sessionID string, sess *models.Session) {
	// No base context means the manager was never started, so there is no
	// supervised lifetime to attach a replacement publisher to. Checked before
	// anything is torn down: failing to restart must not leave the session with
	// no publisher at all.
	if sm.baseCtx == nil {
		return
	}

	var mismatchedSaveName string
	var gameTimeTracker *session.GameTimeTracker
	if existingState, exists := sm.publishers[sessionID]; exists {
		_, mismatchedSaveName = existingState.SaveMismatch()
		gameTimeTracker = existingState.gameTimeTracker
		existingState.cancel()
		delete(sm.publishers, sessionID)
	} else {
		gameTimeTracker = session.NewGameTimeTracker()
	}

	ctx, cancel := context.WithCancel(sm.baseCtx)
	state := &publisherState{
		cancel:             cancel,
		name:               sess.Name,
		address:            sess.Address,
		saveName:           sess.SaveName,
		isDisconnected:     sess.IsDisconnected,
		mismatchedSaveName: mismatchedSaveName,
		gameTimeTracker:    gameTimeTracker,
	}
	sm.publishers[sessionID] = state

	sm.wg.Add(1)
	go sm.publishLoop(ctx, sess, state)
}
