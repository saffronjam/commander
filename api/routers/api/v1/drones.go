package v1

import (
	"api/models/models"
	"api/service"
	"context"
	"fmt"
	"github.com/gin-gonic/gin"
)

// ListDrones godoc
// @Summary List Drones
// @Description List all drones
// @Tags Drones
// @Accept json
// @Produce json
// @Success 200 {array} models.DroneDTO "List of drones"
// @Success 500 {object} models.ErrorResponse "Internal Server ApiError"
// @Router /v1/drones [get]
func ListDrones(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	drones, err := service.NewClient().ListDrones(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list drones"), err)
		return
	}

	dronesDto := make([]models.DroneDTO, len(drones))
	for i, drone := range drones {
		dronesDto[i] = drone.ToDTO()
	}

	requestContext.Ok(dronesDto)
}

// ListDroneStations godoc
// @Summary List DroneStations
// @Description List all droneStations
// @Tags Drones
// @Accept json
// @Produce json
// @Success 200 {array} models.DroneStationDTO "List of drone stations"
// @Success 500 {object} models.ErrorResponse "Internal Server ApiError"
// @Router /v1/droneStations [get]
func ListDroneStations(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	droneStations, err := service.NewClient().ListDroneStations(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list drone stations"), err)
		return
	}

	droneStationsDto := make([]models.DroneStationDTO, len(droneStations))
	for i, droneStation := range droneStations {
		droneStationsDto[i] = droneStation.ToDTO()
	}

	requestContext.Ok(droneStationsDto)
}

// GetDroneSetup godoc
// @Summary Get Drone Setup
// @Description List all drones and drone stations
// @Tags Drones
// @Accept json
// @Produce json
// @Success 200 {array} models.DroneSetupDTO "List of both drones and drone stations"
// @Success 500 {object} models.ErrorResponse "Internal Server ApiError"
// @Router /v1/droneSetup [get]
func GetDroneSetup(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	droneStations, err := service.NewClient().ListDroneStations(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list drone stations"), err)
		return
	}

	drones, err := service.NewClient().ListDrones(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list drones"), err)
		return
	}

	droneSetupDto := models.DroneSetupDTO{
		Drones:        drones,
		DroneStations: droneStations,
	}

	requestContext.Ok(droneSetupDto)
}
