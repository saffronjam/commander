package routes

import "api/routers/api/v1"

const (
	DronesPath        = "/v1/drones"
	DroneStationsPath = "/v1/droneStations"
	DroneSetupPath    = "/v1/droneSetup"
)

type DronesRoutingGroup struct{ RoutingGroupBase }

func DroneRoutes() *DronesRoutingGroup { return &DronesRoutingGroup{} }

func (group *DronesRoutingGroup) PublicRoutes() []Route {
	return []Route{
		{Method: "GET", Pattern: DronesPath, HandlerFunc: v1.ListDrones},
		{Method: "GET", Pattern: DroneStationsPath, HandlerFunc: v1.ListDroneStations},
		{Method: "GET", Pattern: DroneSetupPath, HandlerFunc: v1.GetDroneSetup},
	}
}
