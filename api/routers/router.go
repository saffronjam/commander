package routers

import (
	"api/pkg/metrics"
	"api/routers/routes"
	"github.com/gin-contrib/cors"
	ginzap "github.com/gin-contrib/zap"
	"github.com/penglongli/gin-metrics/ginmetrics"

	docsV2 "api/docs/api/v1"
	docsHandlers "api/docs/api/v1/handlers"
	docsV2ServerUtil "api/docs/api/v1/util"

	"api/models/mode"
	"api/pkg/config"
	"api/pkg/log"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"net/http"
	"net/url"
	"reflect"
	"strings"
	"time"
)

func NewRouter() *gin.Engine {
	router := gin.New()
	basePath := getUrlBasePath()

	// Global middleware
	ginLogger := log.Get("api")
	router.Use(corsAllowAll())
	router.Use(getGinLogger())
	router.Use(ginzap.RecoveryWithZap(ginLogger.Desugar(), true))

	// Metrics middleware
	m := ginmetrics.GetMonitor()
	m.SetMetricPath("/internal/metrics")
	m.SetMetricPrefix(metrics.Prefix)
	m.Use(router)

	// Private routing group (unused)
	private := router.Group("/")

	// Public routing group
	public := router.Group("/")

	//// Swagger routes
	// v2
	docsV2.SwaggerInfo.BasePath = basePath
	docsV2.SwaggerInfo.Host = ""
	docsV2.SwaggerInfo.Schemes = []string{"http", "https"}
	if err := docsV2ServerUtil.UpdateSwaggerServers(basePath); err != nil {
		log.Fatalln(err)
	}

	//public.GET("/v2/docs/*any", ginSwagger.WrapHandler(swaggerfiles.Handler))
	public.GET("/v2/docs/*any", docsHandlers.ServeDocs(basePath+"/v2/docs"))
	//// Health check routes
	public.Any("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// TODO: Answer /livez or/and /readyz with 200 if the server is up

	// Hook routing group
	hook := router.Group("/")

	groups := routes.RoutingGroups()
	for _, group := range groups {
		for _, route := range group.PublicRoutes() {
			HandleRoute(public, route.Method, route.Pattern, route.HandlerFunc, route.Middleware)
		}

		for _, route := range group.PrivateRoutes() {
			HandleRoute(private, route.Method, route.Pattern, route.HandlerFunc, route.Middleware)
		}

		for _, route := range group.HookRoutes() {
			HandleRoute(hook, route.Method, route.Pattern, route.HandlerFunc, route.Middleware)
		}
	}

	registerCustomValidators()

	return router
}

// HandleRoute registers a route with the given method, path, handler and middleware
func HandleRoute(engine *gin.RouterGroup, method, path string, handler gin.HandlerFunc, middleware []gin.HandlerFunc) {
	allHandlers := append(middleware, handler)
	engine.Handle(method, path, allHandlers...)
}

func corsAllowAll() gin.HandlerFunc {
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{"*"}
	corsConfig.AllowCredentials = true
	corsConfig.AddAllowHeaders("authorization")

	return cors.New(corsConfig)
}

// registerCustomValidators registers custom validators for the gin binding
func registerCustomValidators() {
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		v.RegisterTagNameFunc(func(fld reflect.StructField) string {
			name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]

			if name == "-" {
				name = strings.SplitN(fld.Tag.Get("uri"), ",", 2)[0]
			}

			if name == "-" {
				name = strings.SplitN(fld.Tag.Get("form"), ",", 2)[0]
			}

			if name == "-" {
				return ""
			}

			return name
		})

		registrations := map[string]func(fl validator.FieldLevel) bool{}

		for tag, fn := range registrations {
			err := v.RegisterValidation(tag, fn)
			if err != nil {
				panic(err)
			}
		}
	}
}

// getUrlBasePath returns the base path of the external URL.
// Meaning if we have an external URL of https://example.com/deploy,
// this function will return "/deploy"
func getUrlBasePath() string {
	res := ""

	// Parse as URL
	u, err := url.Parse(config.Config.ExternalURL)
	if err != nil {
		log.Fatalln("failed to parse external URL. details:", err)
	}
	res = u.Path

	// Remove trailing slash
	res = strings.TrimSuffix(res, "/")

	return res
}

// getGinLogger returns the logger used for Gin Gonic.
// When in development mode, it will use the default gin.Logger(), since it is easier to read.
// When in production mode, it will use the logger from the log package.
func getGinLogger() gin.HandlerFunc {
	if config.Config.Mode != mode.Prod {
		return gin.Logger()
	}

	return ginzap.Ginzap(log.Get("api").Desugar(), time.RFC3339, true)
}
