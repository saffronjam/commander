package v1

import (
	"api/service"
	"context"
	"fmt"
	"github.com/gin-gonic/gin"
)

// GetFactoryStats godoc
// @Summary Get Factory Stats
// @Description Get factory stats
// @Tags Stats
// @Accept json
// @Produce json
// @Success 200 {array} models.FactoryStatsDTO "Get factory stats"
// @Success 500 {object} models.ErrorResponse "Internal Server Error"
// @Router /v1/factoryStats [get]
func GetFactoryStats(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	factoryStats, err := service.NewClient().GetFactoryStats(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list factory stats"), err)
		return
	}

	requestContext.Ok(factoryStats.ToDTO())
}

// GetGeneratorStats godoc
// @Summary Get Generator Stats
// @Description Get generator stats
// @Tags Stats
// @Accept json
// @Produce json
// @Success 200 {array} models.GeneratorStatsDTO "Get generator stats"
// @Success 500 {object} models.ErrorResponse "Internal Server Error"
// @Router /v1/generatorStats [get]
func GetGeneratorStats(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	generatorStats, err := service.NewClient().GetGeneratorStats(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list generator stats"), err)
		return
	}

	requestContext.Ok(generatorStats.ToDTO())
}

// GetProdStats godoc
// @Summary Get Prod Stats
// @Description Get prod stats
// @Tags Stats
// @Accept json
// @Produce json
// @Success 200 {array} models.ProdStatsDTO "Get prod stats"
// @Success 500 {object} models.ErrorResponse "Internal Server Error"
// @Router /v1/prodStats [get]
func GetProdStats(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	prodStats, err := service.NewClient().GetProdStats(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list prod stats"), err)
		return
	}

	requestContext.Ok(prodStats.ToDTO())
}

// GetSinkStats godoc
// @Summary Get Sink Stats
// @Description Get sink stats
// @Tags Stats
// @Accept json
// @Produce json
// @Success 200 {array} models.SinkStatsDTO "Get sink stats"
// @Success 500 {object} models.ErrorResponse "Internal Server Error"
// @Router /v1/sinkStats [get]
func GetSinkStats(ginContext *gin.Context) {
	requestContext := NewRequestContext(ginContext)

	sinkStats, err := service.NewClient().GetSinkStats(context.Background())
	if err != nil {
		requestContext.ServerError(fmt.Errorf("failed to list sink stats"), err)
		return
	}

	requestContext.Ok(sinkStats.ToDTO())
}
