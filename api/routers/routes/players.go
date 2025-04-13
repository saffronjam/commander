package routes

import v1 "api/routers/api/v1"

const (
	PlayersPath = "/v1/players"
)

type PlayersRoutingGroup struct{ RoutingGroupBase }

func PlayerRoutes() *PlayersRoutingGroup { return &PlayersRoutingGroup{} }

func (group *PlayersRoutingGroup) PublicRoutes() []Route {
	return []Route{
		{Method: "GET", Pattern: PlayersPath, HandlerFunc: v1.ListPlayers},
	}
}
