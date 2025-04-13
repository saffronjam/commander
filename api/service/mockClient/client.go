package mockClient

import (
	"api/models/models"
	"api/pkg/log"
	"api/utils"
	"context"
	"fmt"
	"math/rand"
	"time"
)

type Client struct{}

func NewClient() *Client {
	return &Client{}
}

var now = time.Now().UnixMilli()

func Publish[T any](ctx context.Context, eventType models.SatisfactoryEventType, generator func(ctx context.Context) (T, error), onEvent func(*models.SatisfactoryEvent)) {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				time.Sleep(time.Duration(rand.Float64()*1000) * time.Millisecond)
				generated, err := generator(ctx)
				if err != nil {
					log.PrettyError(fmt.Errorf("failed to generate event, details: %w", err))
					continue
				}

				onEvent(&models.SatisfactoryEvent{
					Type: eventType,
					Data: generated,
				})
			}
		}
	}()
}

func (c *Client) SetupEventStream(ctx context.Context, onEvent func(*models.SatisfactoryEvent)) error {
	Publish(ctx, models.SatisfactoryEventApiStatus, c.GetSatisfactoryApiStatus, onEvent)

	Publish(ctx, models.SatisfactoryEventFactoryStats, c.GetFactoryStats, onEvent)
	Publish(ctx, models.SatisfactoryEventProdStats, c.GetProdStats, onEvent)
	Publish(ctx, models.SatisfactoryEventGeneratorStats, c.GetGeneratorStats, onEvent)
	Publish(ctx, models.SatisfactoryEventSinkStats, c.GetSinkStats, onEvent)

	Publish(ctx, models.SatisfactoryEventCircuits, c.ListCircuits, onEvent)
	Publish(ctx, models.SatisfactoryEventPlayers, c.ListPlayers, onEvent)
	Publish(ctx, models.SatisfactoryEventTrains, c.ListTrains, onEvent)
	Publish(ctx, models.SatisfactoryEventTrainStations, c.ListTrainStations, onEvent)
	Publish(ctx, models.SatisfactoryEventDrones, c.ListDrones, onEvent)
	Publish(ctx, models.SatisfactoryEventDroneStations, c.ListDroneStations, onEvent)

	return nil
}

func (c *Client) GetSatisfactoryApiStatus(_ context.Context) (*models.SatisfactoryApiStatus, error) {
	time.Sleep(time.Duration(rand.Float64()*50) * time.Millisecond)
	return &models.SatisfactoryApiStatus{
		PingMS:  30 + rand.Intn(25),
		Running: true,
	}, nil
}

func (c *Client) ListCircuits(_ context.Context) ([]models.Circuit, error) {
	time.Sleep(time.Duration(rand.Float64()*50) * time.Millisecond)
	return []models.Circuit{
		{
			ID: "1",
			Consumption: models.CircuitConsumption{
				Total: 100_000_000 + rand.Float64()*25_000_000,
				Max:   200_000_000 + rand.Float64()*25_000_000,
			},
			Production: models.CircuitProduction{
				Total: 200_000_000 + rand.Float64()*25_000_000,
			},
			Capacity: models.CircuitCapacity{
				Total: 300_000_000 + rand.Float64()*25_000_000,
			},
			Battery: models.CircuitBattery{
				Percentage:   50 + rand.Float64()*25,
				Capacity:     100_000_000 + rand.Float64()*25_000_000,
				Differential: 10_000_000 + rand.Float64()*50_000_000,
				UntilFull:    10 + rand.Float64()*25,
				UntilEmpty:   10 + rand.Float64()*25,
			},
			FuseTriggered: false,
		},
		{
			ID: "2",
			Consumption: models.CircuitConsumption{
				Total: 100_000_000 + rand.Float64()*50_000_000,
			},
			Production: models.CircuitProduction{
				Total: 200_000_000 + rand.Float64()*50_000_000,
			},
			Capacity: models.CircuitCapacity{
				Total: 300_000_000 + rand.Float64()*50_000_000,
			},
			Battery: models.CircuitBattery{
				Percentage:   50 + rand.Float64()*50,
				Capacity:     100_000_000 + rand.Float64()*50_000_000,
				Differential: 10_000_000 + rand.Float64()*50_000_000,
				UntilFull:    10 + rand.Float64()*50,
				UntilEmpty:   10 + rand.Float64()*50,
			},
			FuseTriggered: true,
		},
	}, nil
}

func (c *Client) GetFactoryStats(_ context.Context) (*models.FactoryStats, error) {
	time.Sleep(time.Duration(rand.Float64()*50) * time.Millisecond)
	return &models.FactoryStats{
		TotalMachines: rand.Intn(3) + 100,
		Efficiency: models.MachineEfficiency{
			MachinesOperating: rand.Intn(3) + 50,
			MachinesIdle:      rand.Intn(3) + 20,
			MachinesPaused:    rand.Intn(3) + 10,
		},
		Machines: []models.Machine{
			{
				Type:     models.MachineTypeSmelter,
				Status:   models.MachineStatusOperating,
				Category: models.MachineCategoryFactory,
				Location: models.Location{X: 8000, Y: 50, Z: 1000, Rotation: 0},
				Input: []models.MachineProdStats{
					{Name: "Power", Current: 3 + rand.Float64(), Max: 4, Stored: 0, Efficiency: 0.5 + rand.Float64()*0.1},
					{Name: "Copper Ore", Current: 100 + rand.Float64()*10, Max: 200, Stored: 100 + rand.Float64()*10, Efficiency: 0.5 + rand.Float64()*0.1},
				},
				Output: []models.MachineProdStats{
					{Name: "Copper Ingot", Current: 1000 + rand.Float64()*10, Max: 2000, Stored: 100 + rand.Float64()*10, Efficiency: 0.5 + rand.Float64()*0.1},
				},
			},
		},
	}, nil
}

func (c *Client) GetProdStats(_ context.Context) (*models.ProdStats, error) {
	time.Sleep(time.Duration(rand.Float64()*50) * time.Millisecond)
	items := []models.ItemProdStats{
		{
			ItemStats: models.ItemStats{
				Name:  "Iron Ore",
				Count: float64(15423 + (time.Now().UnixMilli()-now)/10),
			},
			Minable:             true,
			ProducedPerMinute:   100 + rand.Float64()*10,
			MaxProducePerMinute: 200 + rand.Float64()*10,
			ProduceEfficiency:   0.5 + rand.Float64()*0.1,
			ConsumedPerMinute:   300 + rand.Float64()*10,
			MaxConsumePerMinute: 400 + rand.Float64()*10,
			ConsumeEfficiency:   0.6 + rand.Float64()*0.1,
		},
		{
			ItemStats: models.ItemStats{
				Name:  "Copper Ore",
				Count: float64(15423 + (time.Now().UnixMilli()-now)/10),
			},
			Minable:             true,
			ProducedPerMinute:   100 + rand.Float64()*10,
			MaxProducePerMinute: 200 + rand.Float64()*10,
			ProduceEfficiency:   0.5 + rand.Float64()*0.1,
			ConsumedPerMinute:   300 + rand.Float64()*10,
			MaxConsumePerMinute: 400 + rand.Float64()*10,
			ConsumeEfficiency:   0.6 + rand.Float64()*0.1,
		},
		{
			ItemStats: models.ItemStats{
				Name:  "Copper Ore",
				Count: float64(3643 + (time.Now().UnixMilli()-now)/100),
			},
			Minable:             false,
			ProducedPerMinute:   100 + rand.Float64()*10,
			MaxProducePerMinute: 200 + rand.Float64()*10,
			ProduceEfficiency:   0.5 + rand.Float64()*0.1,
			ConsumedPerMinute:   300 + rand.Float64()*10,
			MaxConsumePerMinute: 400 + rand.Float64()*10,
			ConsumeEfficiency:   0.6 + rand.Float64()*0.1,
		},
	}

	return &models.ProdStats{
		MinableProducedPerMinute: 100 + rand.Float64()*10,
		MinableConsumedPerMinute: 200 + rand.Float64()*10,
		ItemsProducedPerMinute:   300 + rand.Float64()*10,
		ItemsConsumedPerMinute:   400 + rand.Float64()*10,
		Items:                    items,
	}, nil
}

func (c *Client) GetGeneratorStats(_ context.Context) (*models.GeneratorStats, error) {
	time.Sleep(time.Duration(rand.Float64()*50) * time.Millisecond)
	return &models.GeneratorStats{
		Sources: map[models.PowerType]models.PowerSource{
			models.PowerTypeBiomass: {
				Count:           rand.Intn(10) + 100,
				TotalProduction: 200 + rand.Float64()*10,
			},
			models.PowerTypeCoal: {
				Count:           rand.Intn(10) + 100,
				TotalProduction: 200 + rand.Float64()*10,
			},
			models.PowerTypeFuel: {
				Count:           rand.Intn(10) + 300,
				TotalProduction: 400 + rand.Float64()*10,
			},
			models.PowerTypeNuclear: {
				Count:           rand.Intn(10) + 500,
				TotalProduction: 600 + rand.Float64()*10,
			},
		},
		Machines: []models.Machine{
			{
				Type:     models.MachineTypeBiomassBurner,
				Category: models.MachineCategoryGenerator,
				Status:   models.MachineStatusOperating,
				Location: models.Location{X: 10000, Y: 10000, Z: 500, Rotation: 0},
				Input: []models.MachineProdStats{
					{Name: "Solid Biofuel", Current: 100 + rand.Float64()*10, Max: 200 + rand.Float64()*10, Stored: 100 + rand.Float64()*10, Efficiency: 0.5 + rand.Float64()*0.1},
				},
				Output: []models.MachineProdStats{
					{Name: "Power", Current: 10 + rand.Float64()*4, Max: 20 + rand.Float64()*3, Stored: 0, Efficiency: 0.5 + rand.Float64()*0.1},
				},
			},
			{
				Type:     models.MachineTypeCoalGenerator,
				Category: models.MachineCategoryGenerator,
				Status:   models.MachineStatusOperating,
				Location: models.Location{X: 15000, Y: 10000, Z: 500, Rotation: 0},
				Input: []models.MachineProdStats{
					{Name: "Coal", Current: 100 + rand.Float64()*10, Max: 200 + rand.Float64()*10, Stored: 100 + rand.Float64()*10, Efficiency: 0.5 + rand.Float64()*0.1},
				},
				Output: []models.MachineProdStats{
					{Name: "Power", Current: 100 + rand.Float64()*10, Max: 75, Stored: 0, Efficiency: 0.5 + rand.Float64()*0.1},
				},
			},
			{
				Type:     models.MachineTypeFuelGenerator,
				Category: models.MachineCategoryGenerator,
				Status:   models.MachineStatusOperating,
				Location: models.Location{X: 30000, Y: 10000, Z: 500, Rotation: 0},
				Input: []models.MachineProdStats{
					{Name: "Fuel", Current: 100 + rand.Float64()*10, Max: 200, Stored: 100 + rand.Float64()*10, Efficiency: 0.5 + rand.Float64()*0.1},
				},
				Output: []models.MachineProdStats{
					{Name: "Power", Current: 100 + rand.Float64()*10, Max: 200, Stored: 0, Efficiency: 0.5 + rand.Float64()*0.1},
				},
			},
			{
				Type:     models.MachineTypeNuclearPowerPlant,
				Category: models.MachineCategoryGenerator,
				Status:   models.MachineStatusOperating,
				Location: models.Location{X: 35000, Y: 10000, Z: 500, Rotation: 0},
				Input: []models.MachineProdStats{
					{Name: "Uranium Fuel Rod", Current: 100 + rand.Float64()*10, Max: 200, Stored: 100 + rand.Float64()*10, Efficiency: 0.5 + rand.Float64()*0.1},
				},
				Output: []models.MachineProdStats{
					{Name: "Power", Current: 1200 + rand.Float64()*100, Max: 2000, Stored: 0, Efficiency: 0.5 + rand.Float64()*0.1},
				},
			},
		},
	}, nil
}

func (c *Client) GetSinkStats(_ context.Context) (*models.SinkStats, error) {
	time.Sleep(time.Duration(rand.Float64()*50) * time.Millisecond)
	return &models.SinkStats{
		TotalPoints:        100 + rand.Float64()*10,
		Coupons:            200 + rand.Intn(10),
		NextCouponProgress: 0.3 + rand.Float64()*0.1,
		PointsPerMinute:    300 + rand.Float64()*10,
	}, nil
}

func (c *Client) ListPlayers(_ context.Context) ([]models.Player, error) {
	time.Sleep(time.Duration(rand.Float64()*50) * time.Millisecond)
	return []models.Player{
		{
			ID:     "1",
			Name:   "Kyoshi",
			Health: 30 + rand.Float64()*10,
			Items: []models.ItemStats{
				{Name: "Caterium Ingot", Count: 200 + rand.Float64()*10},
				{Name: "Copper Ore", Count: 50 + rand.Float64()*10},
			},
		},
		{
			ID:     "2",
			Name:   "ellaurgor",
			Health: 90 + rand.Float64()*10,
			Items: []models.ItemStats{
				{Name: "Iron Ore", Count: 300 + rand.Float64()*10},
				{Name: "Copper Ore", Count: 200 + rand.Float64()*10},
			},
		},
	}, nil
}

func (c *Client) ListTrainStations(_ context.Context) ([]models.TrainStation, error) {
	time.Sleep(time.Duration(rand.Float64()*50) * time.Millisecond)
	return []models.TrainStation{
		{Name: "Gothenburg", Location: models.Location{X: 0, Y: 0, Z: 0, Rotation: 0}},
		{Name: "Madrid", Location: models.Location{X: 100, Y: 2, Z: 120, Rotation: 0}},
		{Name: "New York", Location: models.Location{X: 200, Y: 4, Z: 240, Rotation: 0}},
	}, nil
}

func (c *Client) ListTrains(_ context.Context) ([]models.Train, error) {
	time.Sleep(time.Duration(rand.Float64()*50) * time.Millisecond)
	return []models.Train{
		{
			Name:             "[IRN] 1",
			Speed:            50 + rand.Float64()*40,
			Status:           getTrainStatus(),
			PowerConsumption: 100 + rand.Float64()*50,
			Timetable: []models.TrainTimetableEntry{
				{Station: "Gothenburg"}, {Station: "New York"}, {Station: "Gothenburg"}, {Station: "Madrid"},
				{Station: "Gothenburg"}, {Station: "Madrid"}, {Station: "Gothenburg"}, {Station: "Madrid"},
				{Station: "Gothenburg"}, {Station: "Madrid"},
			},
			TimetableIndex: int((time.Now().UnixMilli() - now) % 10),
			Vehicles: []models.TrainVehicle{
				{
					Type:      models.TrainTypeLocomotive,
					Capacity:  100,
					Inventory: []models.ItemStats{},
				},
				{
					Type:     models.TrainTypeFreight,
					Capacity: 200,
					Inventory: []models.ItemStats{
						{Name: "Iron Ore", Count: 10},
						{Name: "Copper Ore", Count: 20},
					},
				},
				{
					Type:     models.TrainTypeFreight,
					Capacity: 300,
					Inventory: []models.ItemStats{
						{Name: "Iron Ore", Count: 30},
						{Name: "Copper Ore", Count: 40},
					},
				},
			},
			Location: models.Location{X: 0, Y: 0, Z: 0, Rotation: 0},
		},
		{
			Name:             "Train 2",
			Speed:            100 + rand.Float64()*10,
			Status:           getTrainStatus(),
			PowerConsumption: 50 + rand.Float64()*20,
			Timetable: []models.TrainTimetableEntry{
				{Station: "Gothenburg"}, {Station: "Madrid"},
			},
			TimetableIndex: int((time.Now().UnixMilli() - now) % 2),
			Vehicles: []models.TrainVehicle{
				{
					Type:      models.TrainTypeLocomotive,
					Capacity:  100,
					Inventory: []models.ItemStats{},
				},
				{
					Type:     models.TrainTypeFreight,
					Capacity: 200,
					Inventory: []models.ItemStats{
						{Name: "Heavy Modular Frame", Count: 10},
					},
				},
				{
					Type:     models.TrainTypeFreight,
					Capacity: 300,
					Inventory: []models.ItemStats{
						{Name: "Plastic", Count: 40},
					},
				},
			},
			Location: models.Location{X: 100, Y: 2, Z: 120, Rotation: 0},
		},
	}, nil
}

func getTrainStatus() models.TrainStatus {
	if rand.Float64() > 0.9 {
		return models.TrainStatusDerailed
	}
	if rand.Float64() > 0.8 {
		return models.TrainStatusDocking
	}
	return models.TrainStatusSelfDriving
}

func (c *Client) ListDroneStations(_ context.Context) ([]models.DroneStation, error) {
	time.Sleep(time.Duration(rand.Float64()*50) * time.Millisecond)
	return []models.DroneStation{
		{Name: "Drone Station 1", Location: models.Location{X: 0, Y: 0, Z: 0, Rotation: 0}, FuelName: utils.StrPtr("Packaged Fuel")},
		{Name: "Drone Station 2", Location: models.Location{X: 100, Y: 2, Z: 120, Rotation: 0}, FuelName: utils.StrPtr("Packaged Turbofuel")},
	}, nil
}

func (c *Client) ListDrones(ctx context.Context) ([]models.Drone, error) {
	stations, _ := c.ListDroneStations(ctx)
	time.Sleep(time.Duration(rand.Float64()*50) * time.Millisecond)
	return []models.Drone{
		{
			Name:        "Drone 1",
			Speed:       60 + rand.Float64()*40,
			Status:      models.DroneStatusDocking,
			Location:    &models.Location{X: 0, Y: 0, Z: 0, Rotation: 0},
			Home:        stations[0],
			Paired:      &stations[1],
			Destination: &stations[1],
		},
		{
			Name:        "Drone 2",
			Speed:       60 + rand.Float64()*40,
			Status:      models.DroneStatusFlying,
			Location:    &models.Location{X: 100, Y: 2, Z: 120, Rotation: 0},
			Home:        stations[1],
			Paired:      &stations[0],
			Destination: &stations[0],
		},
	}, nil
}
