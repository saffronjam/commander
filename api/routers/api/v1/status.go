package v1

import (
	"api/service"
	"context"
	"fmt"
	"github.com/gin-gonic/gin"
)

// GetSatisfactoryApiStatus godoc
// @Summary Get Satisfactory API Status
// @Description Get the status of the Satisfactory API
// @Tags Status
// @Accept json
// @Produce json
// @Success 200 {object} models.SatisfactoryApiStatusDTO "Satisfactory API Status"
// @Success 500 {object} models.ErrorResponse "Internal Server Error"
// @Router /v1/satisfactoryApiStatus [get]
func GetSatisfactoryApiStatus(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	status, err := service.NewClient().GetSatisfactoryApiStatus(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to get satisfactory API status"), err)
		return
	}

	requestContext.Ok(status.ToDTO())
}
