package v1

import (
	"api/models/models"
	"api/models/models/status_codes"
	logger "api/pkg/log"
	"github.com/gin-gonic/gin"
	"net/http"
)

// RequestContext is a wrapper for the gin context.
type RequestContext struct {
	GinContext *gin.Context
}

// NewRequestContext creates a new client context.
func NewRequestContext(ginContext *gin.Context) RequestContext {
	return RequestContext{GinContext: ginContext}
}

type validationErrorResponse struct {
	ValidationErrors map[string][]string `json:"validationErrors"`
}

// ResponseValidationError is a helper function to return a validation error response.
func (context *RequestContext) ResponseValidationError(errors map[string][]string) {
	context.GinContext.JSON(400, validationErrorResponse{ValidationErrors: errors})
}

// ServerError is a helper function to return a server error response.
func (context *RequestContext) ServerError(log, display error) {
	logger.PrettyError(log)
	context.GinContext.JSON(http.StatusInternalServerError, models.ErrorResponse{Errors: []models.ApiError{{Code: status_codes.GetMsg(status_codes.Error), Msg: display.Error()}}})
}

// ServerUnavailableError is a helper function to return a server unavailable error response.
// It logs the error internally, and returns a generic error message to the user.
func (context *RequestContext) ServerUnavailableError(log, display error) {

	logger.PrettyError(log)
	context.GinContext.JSON(http.StatusServiceUnavailable, models.ErrorResponse{Errors: []models.ApiError{{Code: status_codes.GetMsg(status_codes.Error), Msg: display.Error()}}})
}

// UserError is a helper function to return a user error response.
func (context *RequestContext) UserError(msg string) {
	context.GinContext.JSON(http.StatusBadRequest, models.ErrorResponse{Errors: []models.ApiError{{Code: status_codes.GetMsg(status_codes.Error), Msg: msg}}})
}

// BindingError is a helper function to return a binding error response.
// This normally occurs when the user sends a request with invalid data.
func (context *RequestContext) BindingError(bindingError *models.BindingError) {
	context.GinContext.JSON(http.StatusBadRequest, bindingError)
}

// ErrorResponse is a helper function to return an error response.
func (context *RequestContext) ErrorResponse(httpCode int, errCode int, message string) {
	errors := []models.ApiError{{Code: status_codes.GetMsg(errCode), Msg: message}}
	context.GinContext.JSON(httpCode, models.ErrorResponse{Errors: errors})
}

// JsonResponse is a helper function to return a JSON response.
func (context *RequestContext) JsonResponse(httpCode int, data interface{}) {
	context.GinContext.JSON(httpCode, data)
}

// Ok is a helper function to return an OK response.
func (context *RequestContext) Ok(data interface{}) {
	context.GinContext.JSON(http.StatusOK, data)
}

// OkNoContent is a helper function to return an OK response with no content.
func (context *RequestContext) OkNoContent() {
	context.GinContext.Status(http.StatusNoContent)
}

// Unauthorized is a helper function to return an unauthorized response.
func (context *RequestContext) Unauthorized(msg string) {
	context.GinContext.JSON(http.StatusUnauthorized, models.ErrorResponse{Errors: []models.ApiError{{Code: status_codes.GetMsg(status_codes.Error), Msg: msg}}})
}

// Forbidden is a helper function to return a forbidden response.
func (context *RequestContext) Forbidden(msg string) {
	context.GinContext.JSON(http.StatusForbidden, models.ErrorResponse{Errors: []models.ApiError{{Code: status_codes.GetMsg(status_codes.Error), Msg: msg}}})
}

// NotFound is a helper function to return a not found response.
func (context *RequestContext) NotFound(msg string) {
	context.GinContext.JSON(http.StatusNotFound, models.ErrorResponse{Errors: []models.ApiError{{Code: status_codes.GetMsg(status_codes.Error), Msg: msg}}})
}

// Locked is a helper function to return a locked response.
func (context *RequestContext) Locked(msg string) {
	context.GinContext.JSON(http.StatusLocked, models.ErrorResponse{Errors: []models.ApiError{{Code: status_codes.GetMsg(status_codes.Error), Msg: msg}}})
}

// NotModified is a helper function to return a not modified response.
func (context *RequestContext) NotModified() {
	context.GinContext.Status(http.StatusNotModified)
}

// NotImplemented is a helper function to return a not implemented response.
func (context *RequestContext) NotImplemented() {
	context.GinContext.Status(http.StatusNotImplemented)
}

// OkCreated is a helper function to return a created response.
func (context *RequestContext) OkCreated(data interface{}) {
	context.GinContext.JSON(http.StatusCreated, data)
}
