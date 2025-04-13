package routes

import v1 "api/routers/api/v1"

const (
	StatePath = "/v1/state"
)

type StateRoutingGroup struct{ RoutingGroupBase }

func StateRoutes() *StateRoutingGroup { return &StateRoutingGroup{} }

func (group *StateRoutingGroup) PublicRoutes() []Route {
	return []Route{
		{Method: "GET", Pattern: StatePath, HandlerFunc: v1.GetState},
	}
}
