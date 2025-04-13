package routes

import v1 "api/routers/api/v1"

const (
	GeneratorStatsPath = "/v1/generatorStats"
	ProdStatsPath      = "/v1/prodStats"
	FactoryStatsPath   = "/v1/factoryStats"
	SinkStatsPath      = "/v1/sinkStats"
)

type StatsRoutingGroup struct{ RoutingGroupBase }

func StatsRoutes() *StatsRoutingGroup { return &StatsRoutingGroup{} }

func (group *StatsRoutingGroup) PublicRoutes() []Route {
	return []Route{
		{Method: "GET", Pattern: GeneratorStatsPath, HandlerFunc: v1.GetGeneratorStats},
		{Method: "GET", Pattern: ProdStatsPath, HandlerFunc: v1.GetProdStats},
		{Method: "GET", Pattern: FactoryStatsPath, HandlerFunc: v1.GetFactoryStats},
		{Method: "GET", Pattern: SinkStatsPath, HandlerFunc: v1.GetSinkStats},
	}
}
