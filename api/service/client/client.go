package client

import (
	"api/models/models"
	"context"
)

type Client interface {
	SetupEventStream(ctx context.Context, onEvent func(*models.SatisfactoryEvent)) error

	GetSatisfactoryApiStatus(ctx context.Context) (*models.SatisfactoryApiStatus, error)

	GetFactoryStats(ctx context.Context) (*models.FactoryStats, error)
	GetProdStats(ctx context.Context) (*models.ProdStats, error)
	GetGeneratorStats(ctx context.Context) (*models.GeneratorStats, error)
	GetSinkStats(ctx context.Context) (*models.SinkStats, error)

	ListCircuits(ctx context.Context) ([]models.Circuit, error)
	ListPlayers(ctx context.Context) ([]models.Player, error)
	ListDrones(ctx context.Context) ([]models.Drone, error)
	ListTrains(ctx context.Context) ([]models.Train, error)
	ListTrainStations(ctx context.Context) ([]models.TrainStation, error)
	ListDroneStations(ctx context.Context) ([]models.DroneStation, error)
}
