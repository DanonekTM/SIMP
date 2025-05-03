package utils

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

type IPInfoResponse struct {
	IP       string `json:"ip"`
	City     string `json:"city"`
	Region   string `json:"region"`
	Country  string `json:"country"`
	Loc      string `json:"loc"`
	Org      string `json:"org"`
	Timezone string `json:"timezone"`
}

var (
	ipInfoRateLimit = time.Second / 2 // 2 requests per second
	lastRequest     time.Time
	rateLimitMutex  sync.Mutex
	logger          *Logger
)

// SetLogger sets the logger instance for IP info functions
func SetIPInfoLogger(l *Logger) {
	logger = l
}

func GetIPInfo(r *http.Request, token string) (*IPInfoResponse, error) {
	if logger == nil {
		return nil, fmt.Errorf("logger not initialized")
	}

	// Rate limiting
	rateLimitMutex.Lock()
	now := time.Now()
	if now.Sub(lastRequest) < ipInfoRateLimit {
		time.Sleep(ipInfoRateLimit - now.Sub(lastRequest))
	}
	lastRequest = time.Now()
	rateLimitMutex.Unlock()

	// Extract IP from the request
	ip := GetIPFromAddr(r)
	if ip == "" {
		logger.Error("Failed to extract IP from request", map[string]interface{}{
			"remote_addr": r.RemoteAddr,
			"headers":     r.Header,
		})
		return nil, fmt.Errorf("failed to extract IP from request")
	}

	// Skip private IPs
	if IsPrivateIP(ip) {
		logger.Warn("Detected private IP address, skipping IPinfo lookup", map[string]interface{}{
			"ip": ip,
		})
		return &IPInfoResponse{
			IP:      ip,
			Country: "Unknown",
		}, nil
	}

	url := fmt.Sprintf("https://ipinfo.io/%s?token=%s", ip, token)
	resp, err := http.Get(url)
	if err != nil {
		logger.Error("Failed to get IP info from API", map[string]interface{}{
			"error": err.Error(),
			"ip":    ip,
		})
		return nil, fmt.Errorf("failed to get IP info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusTooManyRequests {
			logger.Error("IPinfo API rate limit exceeded", map[string]interface{}{
				"ip": ip,
			})
			return nil, fmt.Errorf("IPinfo API rate limit exceeded")
		}
		logger.Error("IPinfo API returned error status", map[string]interface{}{
			"status_code": resp.StatusCode,
			"ip":          ip,
		})
		return nil, fmt.Errorf("IPinfo API returned status code: %d", resp.StatusCode)
	}

	var ipInfo IPInfoResponse
	if err := json.NewDecoder(resp.Body).Decode(&ipInfo); err != nil {
		logger.Error("Failed to decode IP info response", map[string]interface{}{
			"error": err.Error(),
			"ip":    ip,
		})
		return nil, fmt.Errorf("failed to decode IP info response: %w", err)
	}

	logger.Info("Successfully retrieved IP info", map[string]interface{}{
		"ip":      ip,
		"country": ipInfo.Country,
	})

	return &ipInfo, nil
}
