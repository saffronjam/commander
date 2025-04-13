package routes

import "api/routers/api/v1"

const (
	TrainsPath        = "/v1/trains"
	TrainStationsPath = "/v1/trainStations"
	TrainSetupPath    = "/v1/trainSetup"
)

type TrainsRoutingGroup struct{ RoutingGroupBase }

func TrainRoutes() *TrainsRoutingGroup { return &TrainsRoutingGroup{} }

func (group *TrainsRoutingGroup) PublicRoutes() []Route {
	return []Route{
		{Method: "GET", Pattern: TrainsPath, HandlerFunc: v1.ListTrains},
		{Method: "GET", Pattern: TrainStationsPath, HandlerFunc: v1.ListTrainStations},
		{Method: "GET", Pattern: TrainSetupPath, HandlerFunc: v1.GetTrainSetup},
	}
}
