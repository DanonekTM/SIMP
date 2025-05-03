package middleware

import (
	"net/http"
	"sharex/internal/config"
	"sharex/internal/utils"
	"strings"
)

// AuthMiddleware handles authentication for protected routes
func AuthMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip auth for non-API routes (frontend routes)
			if !strings.HasPrefix(r.URL.Path, "/api/") {
				next.ServeHTTP(w, r)
				return
			}

			// Skip auth for public API routes
			if r.URL.Path == "/api/login" ||
				r.URL.Path == "/api/verify" ||
				r.URL.Path == "/api/refresh" ||
				r.URL.Path == "/api/upload" {
				next.ServeHTTP(w, r)
				return
			}

			// Get access token from cookie
			accessToken := utils.GetTokenFromCookie(r, "access_token")
			if accessToken == "" {
				utils.SendUnauthorized(w, "No access token found")
				return
			}

			// Validate access token
			claims, err := utils.ValidateToken(accessToken, cfg.App.JWTSecret)
			if err != nil {
				// Try to refresh the token
				refreshToken := utils.GetTokenFromCookie(r, "refresh_token")
				if refreshToken == "" {
					utils.SendUnauthorized(w, "No refresh token found")
					return
				}

				// Validate refresh token
				refreshClaims, err := utils.ValidateToken(refreshToken, cfg.App.JWTSecret)
				if err != nil || refreshClaims.TokenType != utils.RefreshToken {
					utils.SendUnauthorized(w, "Invalid refresh token")
					return
				}

				// Generate new token pair
				newAccessToken, newRefreshToken, err := utils.GenerateTokenPair(refreshClaims.Username, cfg.App.JWTSecret)
				if err != nil {
					utils.SendInternalError(w, "Failed to generate new tokens")
					return
				}

				// Set new cookies
				utils.SetTokenCookies(w, newAccessToken, newRefreshToken, cfg.App.Environment == "production")

				// Update request with new token
				r.AddCookie(&http.Cookie{
					Name:  "access_token",
					Value: newAccessToken,
				})

				next.ServeHTTP(w, r)
				return
			}

			if claims.TokenType != utils.AccessToken {
				utils.SendUnauthorized(w, "Invalid token type")
				return
			}

			// Token is valid, proceed
			next.ServeHTTP(w, r)
		})
	}
}
