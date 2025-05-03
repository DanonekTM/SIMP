package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"sharex/internal/utils"
)

// GenerateCSRFToken generates a new CSRF token
func GenerateCSRFToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.StdEncoding.EncodeToString(b)
}

// CSRFMiddleware checks for CSRF token in requests
func CSRFMiddleware(cfg interface{}) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip CSRF check for GET, HEAD, OPTIONS
			if r.Method == "GET" || r.Method == "HEAD" || r.Method == "OPTIONS" {
				next.ServeHTTP(w, r)
				return
			}

			// Skip CSRF check for public endpoints that don't require prior authentication
			if r.URL.Path == "/api/login" || r.URL.Path == "/api/upload" {
				next.ServeHTTP(w, r)
				return
			}

			// Get token from header
			token := r.Header.Get("X-CSRF-Token")
			if token == "" {
				utils.SendForbidden(w, "Missing CSRF token")
				return
			}

			// Get token from cookie
			cookie, err := r.Cookie("csrf_token")
			if err != nil || cookie.Value == "" {
				utils.SendForbidden(w, "Invalid CSRF token")
				return
			}

			// Compare tokens
			if token != cookie.Value {
				utils.SendForbidden(w, "Invalid CSRF token")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
