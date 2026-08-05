package client

import (
	"api/models/models"
	"context"
)

type Client interface {
	SetupEventStream(ctx context.Context, onEvent func(*models.SatisfactoryEvent)) error
	SetupLightPolling(ctx context.Context, onEvent func(*models.SatisfactoryEvent)) error

	GetSatisfactoryApiStatus(ctx context.Context) (*models.SatisfactoryApiStatus, error)
	GetSessionInfo(ctx context.Context) (*models.SessionInfo, error)

	GetFactoryStats(ctx context.Context) (*models.FactoryStats, error)
	GetProdStats(ctx context.Context) (*models.ProdStats, error)
	GetGeneratorStats(ctx context.Context) (*models.GeneratorStats, error)
	GetSinkStats(ctx context.Context) (*models.SinkStats, error)
	GetMachines(ctx context.Context) ([]models.Machine, error)

	ListCircuits(ctx context.Context) ([]models.Circuit, error)
	ListPlayers(ctx context.Context) ([]models.Player, error)
	ListDrones(ctx context.Context) ([]models.Drone, error)
	ListTrains(ctx context.Context) ([]models.Train, error)
	ListTractors(ctx context.Context) ([]models.Tractor, error)
	ListExplorers(ctx context.Context) ([]models.Explorer, error)
	ListTrainStations(ctx context.Context) ([]models.TrainStation, error)
	ListDroneStations(ctx context.Context) ([]models.DroneStation, error)
	ListVehiclePaths(ctx context.Context) ([]models.VehiclePath, error)
	ListSchematics(ctx context.Context) ([]models.Schematic, error)

	ListBelts(ctx context.Context) ([]models.Belt, error)
	ListPipes(ctx context.Context) ([]models.Pipe, error)
	ListPipeJunctions(ctx context.Context) ([]models.PipeJunction, error)
	ListTrainRails(ctx context.Context) ([]models.TrainRail, error)
	ListSplitterMergers(ctx context.Context) ([]models.SplitterMerger, error)
	ListCables(ctx context.Context) ([]models.Cable, error)

	GetBelts(ctx context.Context) (models.Belts, error)
	GetPipes(ctx context.Context) (models.Pipes, error)
	GetVehicles(ctx context.Context) (models.Vehicles, error)
	GetVehicleStations(ctx context.Context) (models.VehicleStations, error)
	GetSpaceElevator(ctx context.Context) (*models.SpaceElevator, error)
	GetHub(ctx context.Context) (*models.Hub, error)
	ListRadarTowers(ctx context.Context) ([]models.RadarTower, error)
	ListResourceNodes(ctx context.Context) ([]models.ResourceNode, error)

	// GetAddress returns the API URL this client is connected to
	GetAddress() string

	// Connection health tracking methods
	GetFailureCount() int
	IsDisconnected() bool
	SetDisconnectedCallback(callback func())

	// FailureReason explains why the session is unreachable, so the UI can
	// distinguish "FRM is not running" from "something else answered".
	FailureReason() models.ConnectivityReason
}
