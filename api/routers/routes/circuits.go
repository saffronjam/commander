package routes

import "api/routers/api/v1"

const (
	CircuitsPath = "/v1/circuits"
)

type CircuitsRoutingGroup struct{ RoutingGroupBase }

func CircuitRoutes() *CircuitsRoutingGroup { return &CircuitsRoutingGroup{} }

func (group *CircuitsRoutingGroup) PublicRoutes() []Route {
	return []Route{
		{Method: "GET", Pattern: CircuitsPath, HandlerFunc: v1.ListCircuits},
	}
}
