package routes

import v1 "api/routers/api/v1"

const (
	SatisfactoryApiStatusPath = "/v1/satisfactoryApiStatus"
)

type StatusRoutingGroup struct{ RoutingGroupBase }

func StatusRoutes() *StatusRoutingGroup { return &StatusRoutingGroup{} }

func (group *StatusRoutingGroup) PublicRoutes() []Route {
	return []Route{
		{Method: "GET", Pattern: SatisfactoryApiStatusPath, HandlerFunc: v1.GetSatisfactoryApiStatus},
	}
}
