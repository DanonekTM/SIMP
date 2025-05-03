package middleware

import (
	"bytes"
	"io"
	"net/http"
	"time"

	"sharex/internal/config"
	"sharex/internal/utils"
)

// LoggingMiddleware creates a middleware that logs all incoming requests
func LoggingMiddleware(cfg *config.Config, logger *utils.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Read request body if it exists
			var bodyBytes []byte
			if r.Body != nil {
				bodyBytes, _ = io.ReadAll(r.Body)
				// Restore the body for the next handler
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			}

			// Create a custom response writer to capture the status code
			rw := &responseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			// Process the request
			next.ServeHTTP(rw, r)

			// Calculate request duration
			duration := time.Since(start)

			// Log the request
			logger.Debug("Incoming request", map[string]interface{}{
				"method":     r.Method,
				"path":       r.URL.Path,
				"query":      r.URL.Query(),
				"headers":    sanitizeHeaders(r.Header, cfg.App.Environment),
				"body":       string(bodyBytes),
				"status":     rw.statusCode,
				"duration":   duration.String(),
				"remote_ip":  r.RemoteAddr,
				"user_agent": r.UserAgent(),
			})
		})
	}
}

// responseWriter is a custom response writer that captures the status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

// WriteHeader captures the status code before writing it
func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// sanitizeHeaders removes sensitive information from headers
func sanitizeHeaders(headers http.Header, environment string) map[string]string {
	sanitized := make(map[string]string)
	for key, values := range headers {
		// Only redact in production
		if environment == "production" && (key == "Authorization" || key == "Cookie") {
			sanitized[key] = "[REDACTED]"
			continue
		}
		// Join multiple values with comma
		sanitized[key] = values[0]
	}
	return sanitized
}
