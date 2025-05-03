package utils

import (
	"encoding/json"
	"net/http"
)

// Response represents a standard API response
type Response struct {
	Success bool        `json:"success"`
	Error   string      `json:"error,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// SendError sends a JSON error response with the specified status code
func SendError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(Response{
		Success: false,
		Error:   message,
	})
}

// SendSuccess sends a JSON success response with optional data
func SendSuccess(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Success: true,
		Data:    data,
	})
}

// Common error responses
func SendBadRequest(w http.ResponseWriter, message string) {
	SendError(w, message, http.StatusBadRequest)
}

func SendUnauthorized(w http.ResponseWriter, message string) {
	SendError(w, message, http.StatusUnauthorized)
}

func SendForbidden(w http.ResponseWriter, message string) {
	SendError(w, message, http.StatusForbidden)
}

func SendNotFound(w http.ResponseWriter, message string) {
	SendError(w, message, http.StatusNotFound)
}

func SendInternalError(w http.ResponseWriter, message string) {
	SendError(w, message, http.StatusInternalServerError)
}
