package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"sharex/internal/config"
	"sharex/internal/handlers"
	"sharex/internal/middleware"
	"sharex/internal/storage"
	"sharex/internal/utils"
)

func main() {
	// Load configuration
	cfg, err := config.LoadConfig("config.yaml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize logger
	logger, err := utils.InitializeLogger(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logger.Close()

	// Set logger for IP info package
	utils.SetIPInfoLogger(logger)

	// Initialize database
	db, err := storage.NewDB(cfg.Database.File)
	if err != nil {
		logger.Error("Failed to initialize database", map[string]interface{}{
			"error": err.Error(),
			"file":  cfg.Database.File,
		})
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Create user if it doesn't exist
	user, err := db.GetUser(cfg.User.Username)
	if err != nil {
		logger.Error("Failed to get user", map[string]interface{}{
			"error":    err.Error(),
			"username": cfg.User.Username,
		})
		log.Fatalf("Failed to get user: %v", err)
	}

	if user == nil {
		if err := db.CreateUser(cfg.User.Username, cfg.User.Password); err != nil {
			logger.Error("Failed to create user", map[string]interface{}{
				"error":    err.Error(),
				"username": cfg.User.Username,
			})
			log.Fatalf("Failed to create user: %v", err)
		}
		logger.Info("Created new user", map[string]interface{}{
			"username": cfg.User.Username,
		})
	}

	// Initialize handler
	handler := handlers.NewHandler(cfg, db, logger)

	// Create storage directory if it doesn't exist
	if err := os.MkdirAll(cfg.Storage.BasePath, 0755); err != nil {
		logger.Error("Failed to create storage directory", map[string]interface{}{
			"error": err.Error(),
			"path":  cfg.Storage.BasePath,
		})
		log.Fatalf("Failed to create storage directory: %v", err)
	}

	// Create frontend directory if it doesn't exist
	if err := os.MkdirAll("frontend/dist", 0755); err != nil {
		logger.Error("Failed to create frontend directory", map[string]interface{}{
			"error": err.Error(),
			"path":  "frontend/dist",
		})
		log.Fatalf("Failed to create frontend directory: %v", err)
	}

	// Create a simple index.html if it doesn't exist
	indexPath := filepath.Join("frontend/dist", "index.html")
	if _, err := os.Stat(indexPath); os.IsNotExist(err) {
		logger.Error("Frontend files not found", map[string]interface{}{
			"error": "frontend/dist directory is empty or missing required files",
			"path":  indexPath,
		})
		log.Fatalf("Frontend files not found in frontend/dist. Please build the frontend first")
	}

	// Initialize rate limiter
	rateLimiter, err := middleware.NewRateLimiter(cfg, logger)
	if err != nil {
		logger.Error("Failed to initialize rate limiter", map[string]interface{}{
			"error": err.Error(),
		})
		log.Fatalf("Failed to initialize rate limiter: %v", err)
	}
	defer rateLimiter.Close()

	// Setup routes
	mux := http.NewServeMux()

	// Public routes (no auth required)
	mux.HandleFunc("/api/login", handler.Login)
	mux.HandleFunc("/api/verify", handler.VerifyToken)
	mux.HandleFunc("/api/refresh", handler.RefreshToken)
	mux.HandleFunc("/api/upload", handler.Upload)

	// Auth required routes
	mux.HandleFunc("/api/logout", handler.Logout)
	mux.HandleFunc("/api/delete/", handler.DeleteImage)
	mux.HandleFunc("/api/list", handler.ListImages)
	mux.HandleFunc("/api/stats/", handler.GetImageStats)
	mux.HandleFunc("/api/privacy/", handler.TogglePrivacy)
	mux.HandleFunc("/api/stats/disk-usage", handler.GetDiskUsage)
	mux.HandleFunc("/api/stats/views", handler.GetViewsData)
	mux.HandleFunc("/api/stats/country-views", handler.GetCountryViews)
	mux.HandleFunc("/api/stats/recent-views", handler.GetRecentViews)
	mux.HandleFunc("/api/stats/dashboard", handler.GetDashboardStats)
	mux.HandleFunc("/api/proxy/", handler.ServeProxyImage)
	mux.HandleFunc("/api/config", handler.GetConfig)

	// Frontend routes (must be last)
	mux.HandleFunc("/", handler.ServeFrontend)

	// Apply middleware in order
	var handlerWithMiddleware http.Handler = mux
	handlerWithMiddleware = middleware.LoggingMiddleware(cfg, logger)(handlerWithMiddleware)
	handlerWithMiddleware = rateLimiter.RateLimitMiddleware()(handlerWithMiddleware)
	handlerWithMiddleware = middleware.CORSMiddleware(cfg)(handlerWithMiddleware)
	handlerWithMiddleware = middleware.CSRFMiddleware(cfg)(handlerWithMiddleware)
	handlerWithMiddleware = middleware.AuthMiddleware(cfg)(handlerWithMiddleware)

	// Start server
	addr := fmt.Sprintf(":%d", cfg.App.Port)
	logger.Info("Starting server", map[string]interface{}{
		"address":     addr,
		"environment": cfg.App.Environment,
	})
	if err := http.ListenAndServe(addr, handlerWithMiddleware); err != nil {
		logger.Error("Server error", map[string]interface{}{
			"error": err.Error(),
		})
		log.Fatalf("Server error: %v", err)
	}
}
