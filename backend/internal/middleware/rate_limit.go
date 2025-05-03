package middleware

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"sharex/internal/config"
	"sharex/internal/utils"

	"github.com/redis/go-redis/v9"
)

type RateLimiter struct {
	client *redis.Client
	config *config.Config
	logger *utils.Logger
	ctx    context.Context
}

func NewRateLimiter(cfg *config.Config, logger *utils.Logger) (*RateLimiter, error) {
	if !cfg.RateLimit.Enabled {
		logger.Info("Rate limiting is disabled", nil)
		return &RateLimiter{
			config: cfg,
			logger: logger,
		}, nil
	}

	// Parse Redis URL
	redisURL := strings.TrimPrefix(cfg.RateLimit.RedisURL, "redis://")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}

	logger.Info("Initializing Redis connection", map[string]interface{}{
		"url": redisURL,
	})

	// Create Redis client
	client := redis.NewClient(&redis.Options{
		Addr:     redisURL,
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	// Test connection with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		logger.Error("Failed to connect to Redis", map[string]interface{}{
			"error": err.Error(),
			"url":   redisURL,
		})
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	logger.Info("Successfully connected to Redis", map[string]interface{}{
		"url": redisURL,
	})

	return &RateLimiter{
		client: client,
		config: cfg,
		logger: logger,
		ctx:    context.Background(),
	}, nil
}

func (rl *RateLimiter) Close() error {
	if rl.client != nil {
		return rl.client.Close()
	}
	return nil
}

func (rl *RateLimiter) RateLimitMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip rate limiting if disabled
			if !rl.config.RateLimit.Enabled || rl.client == nil {
				next.ServeHTTP(w, r)
				return
			}

			// Get rate limit configuration for the route
			route := r.URL.Path
			requests, period := rl.getRateConfig(route)

			// Get client IP
			clientIP := rl.getClientIP(r)

			// Create rate limit key
			key := fmt.Sprintf("rate_limit:%s:%s", route, clientIP)

			rl.logger.Debug("Checking rate limit", map[string]interface{}{
				"key":    key,
				"route":  route,
				"ip":     clientIP,
				"limit":  requests,
				"period": period,
			})

			// Check rate limit
			allowed, err := rl.checkRateLimit(key, requests, period)
			if err != nil {
				rl.logger.Error("Rate limit check failed", map[string]interface{}{
					"error": err.Error(),
					"route": route,
					"ip":    clientIP,
				})
				// On Redis error, allow the request but log the error
				next.ServeHTTP(w, r)
				return
			}

			if !allowed {
				rl.logger.Warn("Rate limit exceeded", map[string]interface{}{
					"route":  route,
					"ip":     clientIP,
					"limit":  requests,
					"period": period,
				})
				http.Error(w, "Too many requests", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func (rl *RateLimiter) getClientIP(r *http.Request) string {
	// Try X-Forwarded-For first
	if forwardedFor := r.Header.Get("X-Forwarded-For"); forwardedFor != "" {
		ips := strings.Split(forwardedFor, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Try X-Real-IP
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return realIP
	}

	// Get from RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

func (rl *RateLimiter) getRateConfig(route string) (requests int, period int64) {
	// Check if there's a specific configuration for this route
	if routeConfig, exists := rl.config.RateLimit.Routes[route]; exists {
		return routeConfig.Requests, routeConfig.Period
	}

	// Use default configuration
	return rl.config.RateLimit.DefaultRate.Requests, rl.config.RateLimit.DefaultRate.Period
}

func (rl *RateLimiter) checkRateLimit(key string, requests int, period int64) (bool, error) {
	// Get current count
	count, err := rl.client.Get(rl.ctx, key).Int()
	if err != nil && err != redis.Nil {
		return false, err
	}

	// If key doesn't exist or has expired, set it
	if err == redis.Nil {
		err = rl.client.Set(rl.ctx, key, 1, time.Duration(period)*time.Second).Err()
		if err != nil {
			return false, err
		}
		return true, nil
	}

	// Check if limit is exceeded
	if count >= requests {
		return false, nil
	}

	// Increment counter
	err = rl.client.Incr(rl.ctx, key).Err()
	if err != nil {
		return false, err
	}

	return true, nil
}
