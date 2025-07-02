package implClient

import (
	"api/models/models"
	"api/pkg/config"
	"api/pkg/log"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	apiTimeout         = 2 * time.Second // Timeout for individual API calls
	statusCheckTimeout = 1 * time.Second // Shorter timeout for the basic status check
)

// Client handles interactions with the Satisfactory Mod API
type Client struct {
	httpClient    *http.Client
	apiIsUp       bool
	apiStatusLock sync.RWMutex
	apiUrl        string
}

// NewClient creates a new Satisfactory API service instance
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: apiTimeout,
		},
		apiIsUp: false,
		apiUrl:  config.Config.SatisfactoryAPI.URL,
	}
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

// satisfactoryStatusToTrainStatus converts raw train data to models.TrainStatus
func satisfactoryStatusToTrainStatus(trainData *RawTrain, relevantTrainStations []models.TrainStation) models.TrainStatus {
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
func satisfactoryStatusToDroneStatus(droneData *RawDrone, relevantDroneStations []models.DroneStation) models.DroneStatus {
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
			Interval: 2 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventFactoryStats,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetFactoryStats(c) },
			Interval: 2 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventProdStats,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetProdStats(c) },
			Interval: 2 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventSinkStats,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetSinkStats(c) },
			Interval: 2 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventPlayers,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListPlayers(c) },
			Interval: 2 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventGeneratorStats,
			Endpoint: func(c context.Context) (interface{}, error) { return client.GetGeneratorStats(c) },
			Interval: 2 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventTrains,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListTrains(c) },
			Interval: 2 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventTrainStations,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListTrainStations(c) },
			Interval: 2 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventDrones,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListDrones(c) },
			Interval: 2 * time.Second,
		},
		{
			Type:     models.SatisfactoryEventDroneStations,
			Endpoint: func(c context.Context) (interface{}, error) { return client.ListDroneStations(c) },
			Interval: 2 * time.Second,
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

			for {
				select {
				case <-ticker.C:
					data, err := endpoint.Endpoint(ctx)
					if err == nil {
						callback(&models.SatisfactoryEvent{Type: endpoint.Type, Data: data})
					} else {
						log.PrettyError(fmt.Errorf("failed to fetch %s data. details: %w", endpoint.Type, err))
					}
				case <-ctx.Done():
					log.Printf("Stopping event listener for: %s client", endpoint.Type)
					return // Exit goroutine
				}
			}
		}(ep)
	}

	return nil
}

// ListCircuits fetches power circuit data
func (client *Client) ListCircuits(ctx context.Context) ([]models.Circuit, error) {
	var rawCircuits []RawCircuit
	err := client.makeSatisfactoryCall(ctx, "/getPower", &rawCircuits)
	if err != nil {
		return nil, fmt.Errorf("failed to get circuits. details: %w", err)
	}

	circuits := make([]models.Circuit, 0, len(rawCircuits))
	for _, raw := range rawCircuits {
		// Helper function to parse HH:MM:SS to seconds
		parseTime := func(timeStr *string) float64 {
			if timeStr == nil || *timeStr == "" {
				return 0
			}
			parts := strings.Split(*timeStr, ":")
			if len(parts) != 3 {
				return 0
			}
			h, _ := strconv.Atoi(parts[0])
			m, _ := strconv.Atoi(parts[1])
			sec, _ := strconv.Atoi(parts[2])
			return float64(h*3600 + m*60 + sec)
		}

		secondsToFull := parseTime(raw.BatteryTimeFull)
		secondsToEmpty := parseTime(raw.BatteryTimeEmpty)

		circuit := models.Circuit{
			ID: raw.CircuitID,
			Consumption: models.CircuitConsumption{
				Total: raw.PowerConsumed * 1_000_000,    // MW to W
				Max:   raw.PowerMaxConsumed * 1_000_000, // MW to W
			},
			Production: models.CircuitProduction{
				Total: raw.PowerProduction * 1_000_000, // MW to W
			},
			Capacity: models.CircuitCapacity{
				Total: raw.PowerCapacity * 1_000_000, // MW to W
			},
			Battery: models.CircuitBattery{
				Percentage:   raw.BatteryPercent,
				Capacity:     raw.BatteryCapacity * 1_000_000,     // MWh to Wh? Check units
				Differential: raw.BatteryDifferential * 1_000_000, // MW to W
				UntilFull:    secondsToFull,
				UntilEmpty:   secondsToEmpty,
			},
			FuseTriggered: raw.FuseTriggered,
		}

		// Filter out circuits with no production (consistent with TS)
		if circuit.Production.Total > 0 {
			circuits = append(circuits, circuit)
		}
	}

	// Sort by largest production (consistent with TS)
	sort.Slice(circuits, func(i, j int) bool {
		return circuits[i].Production.Total > circuits[j].Production.Total
	})

	return circuits, nil
}

// GetFactoryStats fetches data about extractors and factory machines
func (client *Client) GetFactoryStats(ctx context.Context) (*models.FactoryStats, error) {
	stats := models.FactoryStats{
		Efficiency: models.MachineEfficiency{},
		Machines:   make([]models.Machine, 0),
	}
	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstError error

	// Helper to determine machine status
	machineStatus := func(isProducing, isPaused, isConfigured bool) models.MachineStatus {
		if isProducing {
			return models.MachineStatusOperating
		}
		if isPaused {
			return models.MachineStatusPaused
		}
		if !isConfigured {
			return models.MachineStatusUnconfigured
		}
		return models.MachineStatusIdle
	}

	// Fetch Extractors
	wg.Add(1)
	go func() {
		defer wg.Done()
		var rawExtractors []RawExtractor
		err := client.makeSatisfactoryCall(ctx, "/getExtractor", &rawExtractors)
		if err != nil {
			mu.Lock()
			if firstError == nil {
				firstError = fmt.Errorf("failed to get extractors. details: %w", err)
			}
			mu.Unlock()
			return
		}

		mu.Lock()
		defer mu.Unlock()
		for _, raw := range rawExtractors {
			machine := models.Machine{
				Type:     models.MachineType(raw.Name),
				Category: models.MachineCategoryExtractor,
				Status:   machineStatus(raw.IsProducing, raw.IsPaused, raw.IsConfigured),
				Location: models.Location{X: raw.Location.X, Y: raw.Location.Y, Z: raw.Location.Z, Rotation: raw.Location.Rotation},
				Input: []models.MachineProdStats{
					{Name: "Power", Current: raw.PowerInfo.PowerConsumed, Max: raw.PowerInfo.MaxPowerConsumed},
				},
				Output: make([]models.MachineProdStats, len(raw.Production)),
			}
			for i, prod := range raw.Production {
				machine.Output[i] = models.MachineProdStats{
					Name:       prod.Name,
					Stored:     float64(prod.Amount),
					Current:    prod.CurrentProd,
					Max:        prod.MaxProd,
					Efficiency: prod.ProdPercent / 100.0,
				}
			}
			stats.Machines = append(stats.Machines, machine)
			// Extractor counts are not explicitly tracked in TS for efficiency totals, only factory machines
		}
	}()

	// Fetch Factory Machines
	wg.Add(1)
	go func() {
		defer wg.Done()
		var rawFactories []RawFactoryMachine
		err := client.makeSatisfactoryCall(ctx, "/getFactory", &rawFactories)
		if err != nil {
			mu.Lock()
			if firstError == nil {
				firstError = fmt.Errorf("failed to get factory machines. details: %w", err)
			}
			mu.Unlock()
			return
		}

		mu.Lock()
		defer mu.Unlock()
		for _, raw := range rawFactories {
			status := machineStatus(raw.IsProducing, raw.IsPaused, raw.IsConfigured)

			stats.TotalMachines++ // Only count factory machines for totals
			switch status {
			case models.MachineStatusOperating:
				stats.Efficiency.MachinesOperating++
			case models.MachineStatusIdle:
				stats.Efficiency.MachinesIdle++
			case models.MachineStatusPaused:
				stats.Efficiency.MachinesPaused++
			case models.MachineStatusUnconfigured:
				stats.Efficiency.MachinesUnconfigured++
			}

			machine := models.Machine{
				Type:     models.MachineType(raw.Name),
				Category: models.MachineCategoryFactory,
				Status:   status,
				Location: models.Location{X: raw.Location.X, Y: raw.Location.Y, Z: raw.Location.Z, Rotation: raw.Location.Rotation},
				Input: []models.MachineProdStats{
					{Name: "Power", Current: raw.PowerInfo.PowerConsumed, Max: raw.PowerInfo.MaxPowerConsumed},
				},
				Output: make([]models.MachineProdStats, len(raw.Production)),
			}
			for _, ing := range raw.Ingredients {
				machine.Input = append(machine.Input, models.MachineProdStats{
					Name:       ing.Name,
					Stored:     ing.Amount,
					Current:    ing.CurrentConsumed,
					Max:        ing.MaxConsumed,
					Efficiency: ing.ConsPercent / 100.0,
				})
			}
			for i, prod := range raw.Production {
				machine.Output[i] = models.MachineProdStats{
					Name:       prod.Name,
					Stored:     prod.Amount,
					Current:    prod.CurrentProd,
					Max:        prod.MaxProd,
					Efficiency: prod.ProdPercent / 100.0,
				}
			}
			stats.Machines = append(stats.Machines, machine)
		}
	}()

	wg.Wait()

	if firstError != nil {
		return nil, firstError
	}

	return &stats, nil
}

// GetProdStats fetches production and consumption statistics for items
func (client *Client) GetProdStats(ctx context.Context) (*models.ProdStats, error) {
	prodStats := models.ProdStats{
		Items: make([]models.ItemProdStats, 0),
	}
	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstError error

	var rawProdData []RawProdStatItem
	var rawInvData []RawWorldInvItem
	itemMap := make(map[string]int) // Map Name -> Amount

	// Fetch Production Stats
	wg.Add(1)
	go func() {
		defer wg.Done()
		err := client.makeSatisfactoryCall(ctx, "/getProdStats", &rawProdData)
		if err != nil {
			mu.Lock()
			if firstError == nil {
				firstError = fmt.Errorf("failed to get prod stats. details: %w", err)
			}
			mu.Unlock()
		}
	}()

	// Fetch World Inventory
	wg.Add(1)
	go func() {
		defer wg.Done()
		err := client.makeSatisfactoryCall(ctx, "/getWorldInv", &rawInvData)
		if err != nil {
			mu.Lock()
			if firstError == nil {
				firstError = fmt.Errorf("failed to get world inventory. details: %w", err)
			}
			mu.Unlock()
			return // Don't proceed if inventory fetch failed
		}
		// Build map only if fetch succeeded
		mu.Lock()
		defer mu.Unlock() // Ensure map access is safe if error occurred above
		if err == nil {   // Double check error isn't set by another goroutine
			for _, item := range rawInvData {
				itemMap[item.Name] = item.Amount
			}
		}
	}()

	wg.Wait()

	if firstError != nil {
		return &models.ProdStats{}, firstError
	}

	// Process fetched data
	for _, item := range rawProdData {
		minable := client.isMinableResource(item.Name)
		count := itemMap[item.Name] // Defaults to 0 if not found

		if minable {
			prodStats.MinableProducedPerMinute += item.CurrentProd
			prodStats.MinableConsumedPerMinute += item.CurrentConsumed
		} else {
			prodStats.ItemsProducedPerMinute += item.CurrentProd
			prodStats.ItemsConsumedPerMinute += item.CurrentConsumed
		}

		prodStats.Items = append(prodStats.Items, models.ItemProdStats{
			ItemStats: models.ItemStats{
				Name:  item.Name,
				Count: float64(count), // Assuming count should be float64 in the model
			},
			ProducedPerMinute:   item.CurrentProd,
			MaxProducePerMinute: item.MaxProd,
			ProduceEfficiency:   item.ProdPercent / 100.0,
			ConsumedPerMinute:   item.CurrentConsumed,
			MaxConsumePerMinute: item.MaxConsumed,
			ConsumeEfficiency:   item.ConsPercent / 100.0,
			Minable:             minable,
		})
	}

	// Round totals
	prodStats.MinableProducedPerMinute = math.Round(prodStats.MinableProducedPerMinute)
	prodStats.MinableConsumedPerMinute = math.Round(prodStats.MinableConsumedPerMinute)
	prodStats.ItemsProducedPerMinute = math.Round(prodStats.ItemsProducedPerMinute)
	prodStats.ItemsConsumedPerMinute = math.Round(prodStats.ItemsConsumedPerMinute)

	// Sort items by produced per minute descending
	sort.Slice(prodStats.Items, func(i, j int) bool {
		return prodStats.Items[i].ProducedPerMinute > prodStats.Items[j].ProducedPerMinute
	})

	return &prodStats, nil
}

// GetSinkStats fetches Awesome Sink data
func (client *Client) GetSinkStats(ctx context.Context) (*models.SinkStats, error) {
	var rawSinkList []RawSinkData
	err := client.makeSatisfactoryCall(ctx, "/getResourceSink", &rawSinkList)
	if err != nil {
		return &models.SinkStats{}, fmt.Errorf("failed to get sink stats. details: %w", err)
	}

	if len(rawSinkList) == 0 {
		return &models.SinkStats{}, nil
	}

	sink := rawSinkList[0] // Assume first item is the relevant one

	var pointsPerMin float64
	if len(sink.GraphPoints) > 0 {
		pointsPerMin = sink.GraphPoints[len(sink.GraphPoints)-1]
	}

	return &models.SinkStats{
		TotalPoints:        sink.TotalPoints,
		Coupons:            sink.NumCoupon,
		NextCouponProgress: sink.Percent,
		PointsPerMinute:    pointsPerMin,
	}, nil
}

// ListPlayers fetches online player data
func (client *Client) ListPlayers(ctx context.Context) ([]models.Player, error) {
	var rawPlayers []RawPlayer
	err := client.makeSatisfactoryCall(ctx, "/getPlayer", &rawPlayers)
	if err != nil {
		return nil, fmt.Errorf("failed to get players. details: %w", err)
	}

	players := make([]models.Player, 0, len(rawPlayers))
	for _, raw := range rawPlayers {
		// Filter out players without names
		if raw.Name == "" {
			continue
		}

		playerItems := make([]models.ItemStats, len(raw.Inventory))
		for i, item := range raw.Inventory {
			playerItems[i] = models.ItemStats{
				Name:  item.Name,
				Count: float64(item.Amount), // Assuming count is float64
			}
		}
		// Sort items by count descending
		sort.Slice(playerItems, func(i, j int) bool {
			return playerItems[i].Count > playerItems[j].Count
		})

		players = append(players, models.Player{
			ID:     raw.Id,
			Name:   raw.Name,
			Health: raw.PlayerHP,
			Items:  playerItems,
		})
	}

	return players, nil
}

// GetGeneratorStats fetches generator statistics and details
func (client *Client) GetGeneratorStats(ctx context.Context) (*models.GeneratorStats, error) {
	var rawGenerators []RawGenerator
	err := client.makeSatisfactoryCall(ctx, "/getGenerators", &rawGenerators)
	if err != nil {
		return &models.GeneratorStats{}, fmt.Errorf("failed to get generators. details: %w", err)
	}

	stats := models.GeneratorStats{
		Sources:  make(map[models.PowerType]models.PowerSource),
		Machines: make([]models.Machine, 0, len(rawGenerators)),
	}

	// Helper to get power based on type logic from TS
	powerByType := func(gen *RawGenerator, genType models.PowerType) float64 {
		switch genType {
		case models.PowerTypeBiomass, models.PowerTypeCoal, models.PowerTypeFuel, models.PowerTypeNuclear:
			// Check if RegulatedDemandProd exists/is applicable, otherwise fallback?
			// Assuming RegulatedDemandProd is the correct value for these as per TS
			return gen.RegulatedDemandProd * 1_000_000 // MW to W
		case models.PowerTypeGeothermal:
			// Using PowerProductionPotential for Geothermal as per TS
			return gen.PowerProductionPotential * 1_000_000 // MW to W
		default:
			// Fallback or default if type is unknown or logic differs
			return gen.PowerProduction * 1_000_000 // Current Production MW to W
		}
	}

	for _, raw := range rawGenerators {
		genType := client.blueprintGeneratorNameToType(raw.Name)
		if genType == models.PowerTypeUnknown { // Skip if type couldn't be determined
			continue
		}

		power := powerByType(&raw, genType)

		// Update aggregate sources map
		source, exists := stats.Sources[genType]
		if exists {
			source.Count++
			source.TotalProduction += power
			stats.Sources[genType] = source
		} else {
			stats.Sources[genType] = models.PowerSource{
				Count:           1,
				TotalProduction: power,
			}
		}

		// Create Machine representation
		// TODO: Determine actual status (Operating, Idle, etc.) if API provides it
		// Assuming 'Operating' for now as TS code did.
		// TODO: Add Input fuels if the API provides that info for generators.
		machine := models.Machine{
			Type:     models.MachineType(raw.Name),
			Category: models.MachineCategoryGenerator,
			Status:   models.MachineStatusOperating, // Placeholder status
			Location: models.Location{X: raw.Location.X, Y: raw.Location.Y, Z: raw.Location.Z, Rotation: raw.Location.Rotation},
			Input:    []models.MachineProdStats{}, // Add fuel inputs if available
			Output: []models.MachineProdStats{
				{
					Name:       "Power",
					Current:    raw.PowerProduction * 1_000_000,          // Current Production (W)
					Max:        raw.PowerProductionPotential * 1_000_000, // Potential Production (W)
					Efficiency: 0,                                        // Calculate if possible (Current/Potential), handle division by zero
				},
			},
		}
		if raw.PowerProductionPotential > 0 {
			machine.Output[0].Efficiency = raw.PowerProduction / raw.PowerProductionPotential // Already factors MW/MW
		}

		stats.Machines = append(stats.Machines, machine)
	}

	return &stats, nil
}

// ListTrains fetches train data, requires station data for status calculation
func (client *Client) ListTrains(ctx context.Context) ([]models.Train, error) {
	var rawTrains []RawTrain
	var rawStations []RawTrainStation // Fetch stations needed for status calculation

	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstError error

	wg.Add(1)
	go func() {
		defer wg.Done()
		err := client.makeSatisfactoryCall(ctx, "/getTrains", &rawTrains)
		if err != nil {
			mu.Lock()
			if firstError == nil {
				firstError = fmt.Errorf("failed to get trains. details: %w", err)
			}
			mu.Unlock()
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		err := client.makeSatisfactoryCall(ctx, "/getTrainStation", &rawStations)
		if err != nil {
			mu.Lock()
			if firstError == nil {
				firstError = fmt.Errorf("failed to get train stations for train status. details: %w", err)
			}
			mu.Unlock()
		}
	}()

	wg.Wait()

	if firstError != nil {
		return nil, firstError
	}

	// Convert raw stations to model stations (needed for status check)
	modelStations := make([]models.TrainStation, len(rawStations))
	for i, rs := range rawStations {
		modelStations[i] = models.TrainStation{
			Name: rs.Name,
			Location: models.Location{
				X:        rs.Location.X,
				Y:        rs.Location.Y,
				Z:        rs.Location.Z,
				Rotation: rs.Location.Rotation,
			},
		}
	}

	trains := make([]models.Train, 0, len(rawTrains))
	for _, raw := range rawTrains {
		// Filter out default "Train" named trains
		//if raw.Name == "Train" {
		//	continue
		//}

		timetable := make([]models.TrainTimetableEntry, len(raw.TimeTable))
		for i, stop := range raw.TimeTable {
			timetable[i] = models.TrainTimetableEntry{
				Station: stop.StationName,
			}
		}

		vehicles := make([]models.TrainVehicle, len(raw.Vehicles))
		for i, v := range raw.Vehicles {
			inventory := make([]models.ItemStats, len(v.Inventory))
			for j, item := range v.Inventory {
				inventory[j] = models.ItemStats{
					Name:  item.Name,
					Count: item.Amount,
				}
			}
			vehicles[i] = models.TrainVehicle{
				Type:      models.TrainType(v.Type),
				Capacity:  float64(v.Capacity), // Assuming capacity is float
				Inventory: inventory,
			}
		}

		trains = append(trains, models.Train{
			Name:  raw.Name,
			Speed: raw.ForwardSpeed,
			Location: models.Location{
				X:        raw.Location.X,
				Y:        raw.Location.Y,
				Z:        raw.Location.Z,
				Rotation: raw.Location.Rotation,
			},
			Timetable:        timetable,
			TimetableIndex:   raw.TimeTableIndex,
			Status:           satisfactoryStatusToTrainStatus(&raw, modelStations),
			PowerConsumption: raw.PowerInfo.PowerConsumed * 1_000_000, // MW to W
			Vehicles:         vehicles,
		})
	}

	return trains, nil
}

// ListTrainStations fetches train station data
func (client *Client) ListTrainStations(ctx context.Context) ([]models.TrainStation, error) {
	var rawStations []RawTrainStation
	err := client.makeSatisfactoryCall(ctx, "/getTrainStation", &rawStations)
	if err != nil {
		return nil, fmt.Errorf("failed to get train stations. details: %w", err)
	}

	stations := make([]models.TrainStation, len(rawStations))
	for i, raw := range rawStations {
		stations[i] = models.TrainStation{
			Name: raw.Name,
			Location: models.Location{
				X:        raw.Location.X,
				Y:        raw.Location.Y,
				Z:        raw.Location.Z,
				Rotation: raw.Location.Rotation,
			},
		}
	}
	return stations, nil
}

// ListDrones fetches drone data. Requires drone stations for linking.
func (client *Client) ListDrones(ctx context.Context) ([]models.Drone, error) {
	// Drones need station info. Fetch stations first or ensure they are already available.
	// This version fetches stations concurrently.
	var rawDrones []RawDrone
	var modelDroneStations []models.DroneStation // Use the model type directly

	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstError error

	wg.Add(1)
	go func() {
		defer wg.Done()
		err := client.makeSatisfactoryCall(ctx, "/getDrone", &rawDrones)
		if err != nil {
			mu.Lock()
			if firstError == nil {
				firstError = fmt.Errorf("failed to get drones. details: %w", err)
			}
			mu.Unlock()
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		// Fetch stations using the dedicated function which returns model type
		stations, err := client.ListDroneStations(ctx)
		if err != nil {
			mu.Lock()
			if firstError == nil {
				firstError = fmt.Errorf("failed to get drone stations for drone linking. details: %w", err)
			}
			mu.Unlock()
		} else {
			mu.Lock()
			modelDroneStations = stations // Store the result
			mu.Unlock()
		}
	}()

	wg.Wait()

	if firstError != nil {
		return nil, firstError
	}

	// Create a map for quick station lookup by name
	stationMap := make(map[string]models.DroneStation, len(modelDroneStations))
	for _, station := range modelDroneStations {
		stationMap[station.Name] = station
	}

	drones := make([]models.Drone, len(rawDrones))
	for i, raw := range rawDrones {
		// Find linked stations from the map
		homeStation, _ := stationMap[raw.HomeStation] // Zero value if not found
		pairedStation, _ := stationMap[raw.TargetStation]
		destinationStation, _ := stationMap[raw.DestinationStation]

		drones[i] = models.Drone{
			Name: raw.Name,
			Location: &models.Location{
				X:        raw.Location.X,
				Y:        raw.Location.Y,
				Z:        raw.Location.Z,
				Rotation: raw.Location.Rotation,
			},
			Speed:       raw.FlyingSpeed,
			Status:      satisfactoryStatusToDroneStatus(&raw, modelDroneStations),
			Home:        homeStation,
			Paired:      &pairedStation,
			Destination: &destinationStation,
			// Add Inventory if API provides it
		}
	}

	return drones, nil
}

// ListDroneStations fetches drone station data
func (client *Client) ListDroneStations(ctx context.Context) ([]models.DroneStation, error) {
	var rawStations []RawDroneStation
	err := client.makeSatisfactoryCall(ctx, "/getDroneStation", &rawStations)
	if err != nil {
		return nil, fmt.Errorf("failed to get drone stations. details: %w", err)
	}

	stations := make([]models.DroneStation, len(rawStations))
	for i, raw := range rawStations {
		var fuelName *string // Use pointer for optional field
		if raw.ActiveFuel.FuelName != "N/A" {
			fn := raw.ActiveFuel.FuelName // Create temp variable to take address
			fuelName = &fn
		}

		stations[i] = models.DroneStation{
			Name: raw.Name,
			Location: models.Location{
				X:        raw.Location.X,
				Y:        raw.Location.Y,
				Z:        raw.Location.Z,
				Rotation: raw.Location.Rotation,
			},
			FuelName: fuelName,
			// Add FuelAmount/Capacity if API provides it
		}
	}
	return stations, nil
}

// GetSatisfactoryApiStatus checks if the API root endpoint is reachable
func (client *Client) GetSatisfactoryApiStatus(ctx context.Context) (*models.SatisfactoryApiStatus, error) {
	// Use a shorter timeout for the basic check
	reqCtx, cancel := context.WithTimeout(ctx, statusCheckTimeout)
	defer cancel()

	apiUrl, err := url.JoinPath(client.apiUrl, "/")
	if err != nil {
		log.Warnln("Failed to join URL path:", err)
		return nil, models.NewSatisfactoryApiError("Failed to join URL path")
	}

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, apiUrl, nil)
	if err != nil {
		client.setApiUp(false) // Should not happen, but good practice
		return nil, models.NewSatisfactoryApiError("Failed to create request for API status check")
	}

	resp, err := client.httpClient.Do(req)
	if err != nil {
		client.setApiUp(false)
		// Don't wrap error here, the caller (event loop) handles ApiError specifically
		return nil, models.NewSatisfactoryApiError("API status check failed")
	}
	defer resp.Body.Close()

	// Consider any 2xx status as "up" for this basic check
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		client.setApiUp(true)
		return &models.SatisfactoryApiStatus{Running: true}, nil
	} else {
		client.setApiUp(false)
		return nil, models.NewSatisfactoryApiError("API status check returned non-2xx status")
	}
}

// makeSatisfactoryCall performs a GET request and decodes the JSON response
// It updates the API status based on success/failure.
func (client *Client) makeSatisfactoryCall(ctx context.Context, path string, target interface{}) error {
	// Check last known status first (optimistic check)
	// if !client.isApiUp() {
	//  // Optional: Could uncomment this to immediately fail if known down,
	//  // but GetSatisfactoryApiStatus should correct this eventually.
	//  // return &ApiError{Message: "Satisfactory API is down (cached)", StatusCode: http.StatusServiceUnavailable}
	// }

	reqCtx, cancel := context.WithTimeout(ctx, client.httpClient.Timeout)
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

	resp, err := client.httpClient.Do(req)
	if err != nil {
		client.setApiUp(false)
		return models.NewSatisfactoryApiError(fmt.Sprintf("Failed to make request to %s: %v", path, err))
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		statusCode := resp.StatusCode
		if statusCode == http.StatusServiceUnavailable || statusCode == http.StatusNotFound {
			client.setApiUp(false)
		}
		return models.NewSatisfactoryApiError(fmt.Sprintf("API call to %s failed with status code %d", path, statusCode))
	}

	// Decode JSON response
	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		// API responded with OK, but body is invalid JSON or doesn't match target struct
		// This is less likely an "API down" scenario, more likely a data or code issue.
		// We don't necessarily setApiUp(false) here, as the endpoint might be partially functional.
		return models.NewSatisfactoryApiError(fmt.Sprintf("Failed to decode JSON response from %s: %v", path, err))
	}

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
