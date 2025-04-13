package v1

import (
	"api/models/models"
	"api/service"
	"context"
	"fmt"
	"github.com/gin-gonic/gin"
)

// ListCircuits godoc
// @Summary List Circuits
// @Description List all circuits
// @Tags Circuits
// @Accept json
// @Produce json
// @Success 200 {array} models.CircuitDTO "List of circuits"
// @Success 500 {object} models.ErrorResponse "Internal Server Error"
// @Router /v1/circuits [get]
func ListCircuits(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	circuits, err := service.NewClient().ListCircuits(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list circuits"), err)
		return
	}

	circuitsDto := make([]models.CircuitDTO, len(circuits))
	for i, circuit := range circuits {
		circuitsDto[i] = circuit.ToDTO()
	}

	requestContext.Ok(circuitsDto)
}
