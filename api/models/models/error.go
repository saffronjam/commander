package models

import "fmt"

type BindingError struct {
	ValidationErrors map[string][]string `json:"validationErrors"`
}

type ErrorResponse struct {
	Errors []ApiError `json:"errors"`
}

type ApiError struct {
	Code string `json:"code"`
	Msg  string `json:"msg"`
}

// SatisfactoryApiError represents an error during communication with Satisfactory API.
type SatisfactoryApiError struct {
	Message string
}

func (e *SatisfactoryApiError) Error() string {
	return fmt.Sprintf("API Error: %s", e.Message)
}

func NewSatisfactoryApiError(message string) *SatisfactoryApiError {
	return &SatisfactoryApiError{
		Message: message,
	}
}
