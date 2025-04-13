package v1

import (
	"api/models/models"
	"api/service"
	"context"
	"fmt"
	"github.com/gin-gonic/gin"
)

// ListTrains godoc
// @Summary List Trains
// @Description List all trains
// @Tags Trains
// @Accept json
// @Produce json
// @Success 200 {array} models.TrainDTO "List of trains"
// @Success 500 {object} models.ErrorResponse "Internal Server ApiError"
// @Router /v1/trains [get]
func ListTrains(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	trains, err := service.NewClient().ListTrains(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list trains"), err)
		return
	}

	trainsDto := make([]models.TrainDTO, len(trains))
	for i, train := range trains {
		trainsDto[i] = train.ToDTO()
	}

	requestContext.Ok(trainsDto)
}

// ListTrainStations godoc
// @Summary List TrainStations
// @Description List all trainStations
// @Tags Trains
// @Accept json
// @Produce json
// @Success 200 {array} models.TrainStationDTO "List of train stations"
// @Success 500 {object} models.ErrorResponse "Internal Server ApiError"
// @Router /v1/trainStations [get]
func ListTrainStations(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	trainStations, err := service.NewClient().ListTrainStations(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list train stations"), err)
		return
	}

	trainStationsDto := make([]models.TrainStationDTO, len(trainStations))
	for i, trainStation := range trainStations {
		trainStationsDto[i] = trainStation.ToDTO()
	}

	requestContext.Ok(trainStationsDto)
}

// GetTrainSetup godoc
// @Summary Get TrainSetup
// @Description List all trains and train stations
// @Tags Trains
// @Accept json
// @Produce json
// @Success 200 {object} models.TrainSetupDTO "List of trains and train stations"
// @Success 500 {object} models.ErrorResponse "Internal Server ApiError"
// @Router /v1/trainSetup [get]
func GetTrainSetup(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	trainStations, err := service.NewClient().ListTrainStations(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list train stations"), err)
		return
	}

	trains, err := service.NewClient().ListTrains(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list trains"), err)
		return
	}

	trainSetupDto := models.TrainSetupDTO{
		Trains:        trains,
		TrainStations: trainStations,
	}

	requestContext.Ok(trainSetupDto)
}
