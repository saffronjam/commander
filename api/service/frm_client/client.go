package frm_client

import (
	"api/models/models"
	"api/pkg/log"
	"api/service/frm_client/frm_models"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	apiTimeout         = 10 * time.Second // Timeout for regular API calls
	infraApiTimeout    = 20 * time.Second // Longer timeout for infrastructure endpoints (belts, pipes, etc.)
	statusCheckTimeout = 2 * time.Second  // Timeout for the basic status check
)

// Client handles interactions with the Satisfactory Mod API
type Client struct {
	httpClient          *http.Client
	apiIsUp             bool
	apiStatusLock       sync.RWMutex
	apiUrl              string
	requestQueue        *RequestQueue
	consecutiveFailures int          // Counter for consecutive connection failures
	failureLock         sync.RWMutex // Protects failure counter and disconnected state
	onDisconnected      func()       // Callback triggered when failure threshold reached
	wasDisconnected     bool         // Tracks previous disconnected state for logging
	failureReason       models.ConnectivityReason
}

// NewClientWithAddress creates a new Satisfactory API service instance with a custom URL
func NewClientWithAddress(address string) *Client {
	// Ensure the address has a protocol prefix
	apiUrl := address
	if !strings.HasPrefix(address, "http://") && !strings.HasPrefix(address, "https://") {
		apiUrl = "http://" + address
	}

	return &Client{
		httpClient: &http.Client{
			Timeout: apiTimeout,
		},
		apiIsUp:      false,
		apiUrl:       apiUrl,
		requestQueue: NewRequestQueue(apiUrl),
	}
}

// GetAddress returns the API URL this client is connected to
func (client *Client) GetAddress() string {
	return client.apiUrl
}

func (client *Client) isApiUp() bool {
	client.apiStatusLock.RLock()
	defer client.apiStatusLock.RUnlock()
	return client.apiIsUp
}

func (client *Client) setApiUp(isUp bool) {
	client.apiStatusLock.Lock()
	defer client.apiStatusLock.Unlock()
	if client.apiIsUp != isUp {
		isUpStr := fmt.Sprintf("%sdown%s", log.Red, log.Reset)
		if isUp {
			isUpStr = fmt.Sprintf("%sup%s", log.Green, log.Reset)
		}
		log.Printf("Satisfactory API status changed: %s", isUpStr)
		client.apiIsUp = isUp
	}
}

const failureThreshold = 5

func (client *Client) incrementFailureCount() {
	client.failureLock.Lock()
	defer client.failureLock.Unlock()

	client.consecutiveFailures++
	log.Debugf("Network failure count: %d/%d for %s", client.consecutiveFailures, failureThreshold, client.apiUrl)

	// Trigger disconnection callback on threshold
	if client.consecutiveFailures >= failureThreshold && !client.wasDisconnected {
		client.wasDisconnected = true
		if client.onDisconnected != nil {
			client.onDisconnected()
		}
	}
}

// classifyRequestError decides which of the two failure shapes an error is.
// Nothing answering at all is treated as "FRM is not running"; anything that did
// answer, including a TLS handshake, means something is there but it is not FRM.
func classifyRequestError(err error) models.ConnectivityReason {
	var certErr *tls.CertificateVerificationError
	var recordErr tls.RecordHeaderError
	var unknownAuthority x509.UnknownAuthorityError
	var hostnameErr x509.HostnameError
	if errors.As(err, &certErr) || errors.As(err, &recordErr) ||
		errors.As(err, &unknownAuthority) || errors.As(err, &hostnameErr) {
		return models.ConnectivityReasonBadResponse
	}
	return models.ConnectivityReasonNoResponse
}

// recordFailureReason remembers why the last request failed.
func (client *Client) recordFailureReason(reason models.ConnectivityReason) {
	client.failureLock.Lock()
	defer client.failureLock.Unlock()
	client.failureReason = reason
}

// FailureReason returns why the session is unreachable, or none while it is
// reachable.
func (client *Client) FailureReason() models.ConnectivityReason {
	client.failureLock.RLock()
	defer client.failureLock.RUnlock()
	if client.failureReason == "" {
		return models.ConnectivityReasonNone
	}
	return client.failureReason
}

func (client *Client) resetFailureCount() {
	client.failureLock.Lock()
	defer client.failureLock.Unlock()

	client.failureReason = models.ConnectivityReasonNone

	if client.consecutiveFailures > 0 {
		log.Debugf("Resetting failure count for %s (was %d)", client.apiUrl, client.consecutiveFailures)
		client.consecutiveFailures = 0
	}

	// Log reconnection
	if client.wasDisconnected {
		client.wasDisconnected = false
		log.Infof("Session is online: %s", client.apiUrl)
	}
}

func (client *Client) GetFailureCount() int {
	client.failureLock.RLock()
	defer client.failureLock.RUnlock()
	return client.consecutiveFailures
}

func (client *Client) IsDisconnected() bool {
	client.failureLock.RLock()
	defer client.failureLock.RUnlock()
	return client.consecutiveFailures >= failureThreshold
}

func (client *Client) SetDisconnectedCallback(callback func()) {
	client.failureLock.Lock()
	defer client.failureLock.Unlock()
	client.onDisconnected = callback
}

// satisfactoryStatusToTrainStatus converts raw train data to models.TrainStatus
func satisfactoryStatusToTrainStatus(trainData *frm_models.Train, relevantTrainStations []models.TrainStation) models.TrainStatus {
	if trainData.Derailed {
		return models.TrainStatusDerailed
	}

	// Check proximity to stations for Docking status
	for _, station := range relevantTrainStations {
		if math.Abs(trainData.Location.Z-station.Z) < 0.1 &&
			math.Abs(trainData.Location.X-station.X) < 10 &&
			math.Abs(trainData.Location.Y-station.Y) < 10 {
			return models.TrainStatusDocking
		}
	}

	switch trainData.Status {
	case "Self-Driving":
		return models.TrainStatusSelfDriving
	case "Manual Driving":
		return models.TrainStatusManualDriving
	case "Parked":
		return models.TrainStatusParked
	default:
		log.Warnf("Unknown train status received: %s", trainData.Status)
		return models.TrainStatusUnknown
	}
}

// satisfactoryStatusToDroneStatus converts raw drone data to models.DroneStatus
func satisfactoryStatusToDroneStatus(droneData *frm_models.Drone, relevantDroneStations []models.DroneStation) models.DroneStatus {
	// Check proximity to stations for Docking status
	for _, station := range relevantDroneStations {
		// Note: Increased Z tolerance based on TS code
		if math.Abs(droneData.Location.Z-station.Z) < 1000 &&
			math.Abs(droneData.Location.X-station.X) < 10 &&
			math.Abs(droneData.Location.Y-station.Y) < 10 {
			return models.DroneStatusDocking
		}
	}

	// Assuming if not docking, it's flying. API might provide more detailed status.
	return models.DroneStatusFlying
}

// SetupEventStream starts polling endpoints and sends data via the callback
func (client *Client) SetupEventStream(ctx context.Context, callback func(*models.SatisfactoryEvent)) error {
	endpoints := []struct {
		Type     models.SatisfactoryEventType
		Endpoint func(context.Context) (interface{}, error)
		Interval time.Duration
	}{
		{
			Type:     models.SatisfactoryEventApiStatus,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetSatisfactoryApiStatus(c) },
			Interval: 5 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventCircuits,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListCircuits(c) },
			Interval: 4 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventFactoryStats,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetFactoryStats(c) },
			Interval: 4 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventProdStats,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetProdStats(c) },
			Interval: 4 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventSinkStats,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetSinkStats(c) },
			Interval: 4 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventPlayers,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListPlayers(c) },
			Interval: 4 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventGeneratorStats,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetGeneratorStats(c) },
			Interval: 4 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventMachines,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetMachines(c) },
			Interval: 4 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventVehicles,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetVehicles(c) },
			Interval: 4 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventVehicleStations,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetVehicleStations(c) },
			Interval: 4 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventBelts,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetBelts(c) },
			Interval: 120 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventPipes,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetPipes(c) },
			Interval: 120 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventTrainRails,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListTrainRails(c) },
			Interval: 120 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventCables,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListCables(c) },
			Interval: 120 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventStorages,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListStorageContainers(c) },
			Interval: 120 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventTractors,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListTractors(c) },
			Interval: 4 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventExplorers,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListExplorers(c) },
			Interval: 4 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventVehiclePaths,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListVehiclePaths(c) },
			Interval: 30 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventSpaceElevator,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetSpaceElevator(c) },
			Interval: 30 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventHub,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetHub(c) },
			Interval: 30 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventRadarTowers,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListRadarTowers(c) },
			Interval: 4 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventResourceNodes,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListResourceNodes(c) },
			Interval: 20 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventHypertubes,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetHypertubes(c) },
			Interval: 120 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventSchematics,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListSchematics(c) },
			Interval: 30 * time.Second,
		},
	}

	log.Infoln("Starting event listeners for Satisfactory API")

	var wg sync.WaitGroup
	for idx, ep := range endpoints {
		wg.Add(1)

		log.Debugf("(%d/%d) Starting event listener for %s%s%s", idx+1, len(endpoints), log.Cyan, ep.Type, log.Reset)
		go func(endpoint struct {
			Type     models.SatisfactoryEventType
			Endpoint func(context.Context) (interface{}, error)
			Interval time.Duration
		}) {
			defer wg.Done()
			ticker := time.NewTicker(endpoint.Interval)
			defer ticker.Stop()

			// Fetch immediately on start, then continue with ticker
			fetchData := func() {
				endpointType := string(endpoint.Type)
				executed, err := client.requestQueue.Enqueue(endpointType, func() error {
					data, fetchErr := endpoint.Endpoint(ctx)
					if fetchErr == nil {
						callback(&models.SatisfactoryEvent{Type: endpoint.Type, Data: data})
					}
					return fetchErr
				})

				if executed && err != nil {
					log.PrettyError(fmt.Errorf("failed to fetch %s data. details: %w", endpoint.Type, err))
					if endpoint.Type == models.SatisfactoryEventApiStatus {
						callback(&models.SatisfactoryEvent{
							Type: models.SatisfactoryEventApiStatus,
							Data: &models.SatisfactoryApiStatus{Running: false},
						})
					}
				}
			}

			// Execute immediately on start
			fetchData()

			for {
				select {
				case <-ticker.C:
					fetchData()
				case <-ctx.Done():
					log.Printf("Stopping event listener for: %s client", endpoint.Type)
					return // Exit goroutine
				}
			}
		}(ep)
	}

	// Stop the request queue when context is cancelled
	go func() {
		<-ctx.Done()
		client.requestQueue.Stop()
	}()

	return nil
}

// SetupLightPolling polls only /getSessionInfo for disconnected sessions
// This is a lightweight alternative to SetupEventStream when the server is offline
func (client *Client) SetupLightPolling(ctx context.Context, callback func(*models.SatisfactoryEvent)) error {
	log.Infoln("Starting light polling mode (disconnected state)")

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Helper to poll session info
	pollSessionInfo := func() {
		fetchCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()

		_, err := client.GetSessionInfo(fetchCtx)
		if err != nil {
			// Network error already handled by makeSatisfactoryCall
			// incrementFailureCount() already called
			log.Debugf("Session is still offline")

			// Send offline status
			callback(&models.SatisfactoryEvent{
				Type: models.SatisfactoryEventApiStatus,
				Data: &models.SatisfactoryApiStatus{Running: false},
			})
			return
		}

		// SUCCESS - resetFailureCount() already called
		// This will trigger reconnection in SessionManager
		callback(&models.SatisfactoryEvent{
			Type: models.SatisfactoryEventApiStatus,
			Data: &models.SatisfactoryApiStatus{Running: true},
		})
	}

	// Poll immediately on start
	pollSessionInfo()

	// Then poll on ticker
	for {
		select {
		case <-ticker.C:
			pollSessionInfo()
		case <-ctx.Done():
			log.Infoln("Stopping light polling mode")
			return nil
		}
	}
}

// GetSatisfactoryApiStatus reports whether the address answers as FRM.
//
// Reaching something is not proof of anything: a reverse proxy, a router's
// captive page and this dashboard's own SPA fallback all answer 200 to every
// path, so a check that only read the status code would report a session online
// that can never yield one usable response. Decoding a real FRM payload is the
// only definitive signal, and it is the same one the save probe and discovery
// already rely on.
func (client *Client) GetSatisfactoryApiStatus(ctx context.Context) (*models.SatisfactoryApiStatus, error) {
	var raw models.SessionInfoRaw
	if err := client.makeSatisfactoryCallWithTimeout(ctx, "/getSessionInfo", &raw, statusCheckTimeout); err != nil {
		return nil, models.NewSatisfactoryApiError("API status check failed")
	}

	client.setApiUp(true)
	return &models.SatisfactoryApiStatus{Running: true}, nil
}

// makeSatisfactoryCall performs a GET request and decodes the JSON response
// It updates the API status based on success/failure.
func (client *Client) makeSatisfactoryCall(ctx context.Context, path string, target interface{}) error {
	return client.makeSatisfactoryCallWithTimeout(ctx, path, target, client.httpClient.Timeout)
}

// makeSatisfactoryCallWithTimeout performs a GET request with a custom timeout
func (client *Client) makeSatisfactoryCallWithTimeout(ctx context.Context, path string, target interface{}, timeout time.Duration) error {
	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	apiUrl, err := url.JoinPath(client.apiUrl, path)
	if err != nil {
		log.Warnln("Failed to join URL path:", err)
		return models.NewSatisfactoryApiError(fmt.Sprintf("Failed to join URL path for %s: %v", path, err))
	}

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, apiUrl, nil)
	if err != nil {
		client.setApiUp(false)
		return models.NewSatisfactoryApiError(fmt.Sprintf("Failed to create request for %s: %v", path, err))
	}

	startTime := time.Now()
	resp, err := client.httpClient.Do(req)
	elapsed := time.Since(startTime)

	// Log DEBUG warning if request took longer than 10 seconds
	if elapsed > 10*time.Second {
		log.Debugf("FRM API request to %s took %v (> 10s threshold)", path, elapsed)
	}

	if err != nil {
		// NETWORK ERROR: Connection refused, timeout, DNS failure, TLS failure.
		client.setApiUp(false)
		client.recordFailureReason(classifyRequestError(err))
		client.incrementFailureCount()
		return models.NewSatisfactoryApiError(fmt.Sprintf("Failed to make request to %s: %v", path, err))
	}
	defer resp.Body.Close()

	// A wrong answer counts as a failure exactly like an unanswered request. Only
	// counting transport errors let an address that answers every path with HTML
	// hold the failure counter at zero forever, so the session never reached the
	// threshold, never dropped to light polling, and every endpoint kept polling at
	// full rate and logging its own decode error.
	if resp.StatusCode != http.StatusOK {
		// HTTP ERROR: something is listening but it is not answering as FRM.
		client.setApiUp(false)
		client.recordFailureReason(models.ConnectivityReasonBadResponse)
		client.incrementFailureCount()
		return models.NewSatisfactoryApiError(fmt.Sprintf("API call to %s failed with status code %d", path, resp.StatusCode))
	}

	// Decode JSON response
	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		// Answered 200 but the body is not FRM's: usually a proxy or login page.
		client.setApiUp(false)
		client.recordFailureReason(models.ConnectivityReasonBadResponse)
		client.incrementFailureCount()
		return models.NewSatisfactoryApiError(fmt.Sprintf("Failed to decode JSON response from %s: %v", path, err))
	}

	// SUCCESS: Reset failure counter
	client.resetFailureCount()

	// If we reached here, the call was successful
	// We don't necessarily setApiUp(true) here, as the main status check handles that.
	// This prevents flapping if only one endpoint works.
	return nil
}

// blueprintGeneratorNameToType maps generator names to PowerType enums
func (client *Client) blueprintGeneratorNameToType(name string) models.PowerType {
	lowerName := strings.ToLower(name)
	if strings.Contains(lowerName, "bio") {
		return models.PowerTypeBiomass
	}
	if strings.Contains(lowerName, "coal") {
		return models.PowerTypeCoal
	}
	if strings.Contains(lowerName, "fuel") {
		return models.PowerTypeFuel
	}
	if strings.Contains(lowerName, "geo") {
		return models.PowerTypeGeothermal
	}
	if strings.Contains(lowerName, "nuclear") {
		return models.PowerTypeNuclear
	}
	log.Warnf("Unknown generator type name: %slient", name)
	return models.PowerTypeUnknown // Return a specific "Unknown" type
}

// isMinableResource checks if an item name corresponds to a raw, minable resource
func (client *Client) isMinableResource(name string) bool {
	includes := []string{" ore"} // Note the leading space for whole word matching
	equals := []string{
		"water",
		"sulfur",
		"coal",
		"caterium",
		"raw quartz",
		"bauxite",
		"crude oil",
		"limestone",
		"nitrogen gas",
	}

	lowerName := strings.ToLower(name)

	for _, suffix := range includes {
		if strings.HasSuffix(lowerName, suffix) {
			return true
		}
	}

	for _, match := range equals {
		if lowerName == match {
			return true
		}
	}

	return false
}
