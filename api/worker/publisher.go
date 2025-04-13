package worker

import (
	"api/models/models"
	"api/pkg/db/key_value"
	"api/pkg/log"
	"api/service"
	"context"
	"encoding/json"
	"fmt"
)

func Publisher(ctx context.Context) {
	kvClient := key_value.New()

	lastTrains := make([]models.Train, 0)
	lastTrainStations := make([]models.TrainStation, 0)

	lastDrones := make([]models.Drone, 0)
	lastDroneStations := make([]models.DroneStation, 0)

	handler := func(event *models.SatisfactoryEvent) {
		toPublish := make([]models.SatisfactoryEvent, 1)
		toPublish[0] = *event

		switch event.Type {
		case models.SatisfactoryEventTrains:
			lastTrains = event.Data.([]models.Train)
			toPublish = append(toPublish, models.SatisfactoryEvent{
				Type: models.SatisfactoryEventTrainSetup,
				Data: models.TrainSetupDTO{
					Trains:        lastTrains,
					TrainStations: lastTrainStations,
				},
			})
		case models.SatisfactoryEventTrainStations:
			lastTrainStations = event.Data.([]models.TrainStation)
			toPublish = append(toPublish, models.SatisfactoryEvent{
				Type: models.SatisfactoryEventTrainSetup,
				Data: models.TrainSetupDTO{
					Trains:        lastTrains,
					TrainStations: lastTrainStations,
				},
			})
		case models.SatisfactoryEventDrones:
			lastDrones = event.Data.([]models.Drone)
			toPublish = append(toPublish, models.SatisfactoryEvent{
				Type: models.SatisfactoryEventDroneSetup,
				Data: models.DroneSetupDTO{
					Drones:        lastDrones,
					DroneStations: lastDroneStations,
				},
			})
		case models.SatisfactoryEventDroneStations:
			lastDroneStations = event.Data.([]models.DroneStation)
			toPublish = append(toPublish, models.SatisfactoryEvent{
				Type: models.SatisfactoryEventDroneSetup,
				Data: models.DroneSetupDTO{
					Drones:        lastDrones,
					DroneStations: lastDroneStations,
				},
			})
		}

		for _, e := range toPublish {
			asJson, err := json.Marshal(e)
			if err != nil {
				log.PrettyError(fmt.Errorf("failed to marshal event, details: %w", err))
				return
			}

			err = kvClient.Publish(models.SatisfactoryEventKey, asJson)
			if err != nil {
				log.PrettyError(fmt.Errorf("failed to publish event, details: %w", err))
			}
		}
	}

	client := service.NewClient()
	err := client.SetupEventStream(ctx, handler)
	if err != nil {
		log.PrettyError(fmt.Errorf("failed to set up event stream, details: %w", err))
		return
	}
}
