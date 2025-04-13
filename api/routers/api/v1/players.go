package v1

import (
	"api/models/models"
	"api/service"
	"context"
	"fmt"
	"github.com/gin-gonic/gin"
)

// ListPlayers godoc
// @Summary List Players
// @Description List all players
// @Tags Circuits
// @Accept json
// @Produce json
// @Success 200 {array} models.PlayerDTO "List of players"
// @Success 500 {object} models.ErrorResponse "Internal Server Error"
// @Router /v1/players [get]
func ListPlayers(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	players, err := service.NewClient().ListPlayers(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list players"), err)
		return
	}

	playersDto := make([]models.PlayerDTO, len(players))
	for i, player := range players {
		playersDto[i] = player.ToDTO()
	}

	requestContext.Ok(playersDto)
}
