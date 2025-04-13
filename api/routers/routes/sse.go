package routes

import (
	"api/routers/api/v1"
	"api/routers/api/v1/middleware"
	"github.com/gin-gonic/gin"
)

const (
	EventsSsePath = "/v1/eventsSse"
)

type SseRoutingGroup struct{ RoutingGroupBase }

func SseRoutes() *SseRoutingGroup { return &SseRoutingGroup{} }

func (group *SseRoutingGroup) PublicRoutes() []Route {
	return []Route{
		{Method: "GET", Pattern: EventsSsePath, HandlerFunc: v1.StartEventsSSE, Middleware: []gin.HandlerFunc{middleware.SseSetup()}},
	}
}
