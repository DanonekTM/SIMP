package utils

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"sharex/internal/config"

	"github.com/common-nighthawk/go-figure"
)

const (
	// ANSI color codes
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorBlue   = "\033[34m"
	colorWhite  = "\033[37m"
)

type LogLevel string

const (
	DEBUG LogLevel = "DEBUG"
	INFO  LogLevel = "INFO"
	WARN  LogLevel = "WARN"
	ERROR LogLevel = "ERROR"
)

type LogEntry struct {
	Timestamp string      `json:"timestamp"`
	Level     LogLevel    `json:"level"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
}

type Logger struct {
	config   *config.Config
	writers  map[LogLevel]io.Writer
	rotators map[LogLevel]*LogRotator
	files    map[LogLevel]*os.File
	stopChan chan struct{}
}

func NewLogger(cfg *config.Config) (*Logger, error) {
	// If logging is disabled globally, return a disabled logger
	if !cfg.Logging.Enabled {
		return &Logger{config: cfg}, nil
	}

	// Validate logging configuration
	if cfg.Logging.CleanupSchedule < 1 {
		return nil, fmt.Errorf("cleanup schedule must be at least 1 minute")
	}

	maxLogSize, err := cfg.GetMaxLogSize()
	if err != nil {
		return nil, fmt.Errorf("invalid max_log_size: %w", err)
	}

	if maxLogSize < 1024 {
		return nil, fmt.Errorf("max log size must be at least 1KB")
	}

	if cfg.Logging.MaxLogAge < 1 {
		return nil, fmt.Errorf("max log age must be at least 1 day")
	}

	// Create log directory if it doesn't exist
	if err := os.MkdirAll(cfg.Logging.LogDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create log directory: %w", err)
	}

	// Create archives directory if compression is enabled
	if cfg.Logging.CompressLogs {
		archivesDir := filepath.Join(cfg.Logging.LogDir, "archives")
		if err := os.MkdirAll(archivesDir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create archives directory: %w", err)
		}
	}

	writers := make(map[LogLevel]io.Writer)
	rotators := make(map[LogLevel]*LogRotator)
	files := make(map[LogLevel]*os.File)

	// Initialize writers for each log level
	for level, levelConfig := range map[LogLevel]struct {
		enabled       bool
		consoleOutput bool
		file          string
	}{
		DEBUG: {cfg.Logging.Debug.Enabled, cfg.Logging.Debug.ConsoleOutput && cfg.App.Environment == "development", cfg.Logging.Debug.File},
		INFO:  {cfg.Logging.Info.Enabled, cfg.Logging.Info.ConsoleOutput && cfg.App.Environment == "development", cfg.Logging.Info.File},
		WARN:  {cfg.Logging.Warn.Enabled, cfg.Logging.Warn.ConsoleOutput && cfg.App.Environment == "development", cfg.Logging.Warn.File},
		ERROR: {cfg.Logging.Error.Enabled, cfg.Logging.Error.ConsoleOutput && cfg.App.Environment == "development", cfg.Logging.Error.File},
	} {
		if !levelConfig.enabled {
			continue
		}

		// Add file writer
		filePath := filepath.Join(cfg.Logging.LogDir, levelConfig.file)
		file, err := openLogFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to open log file for level %s: %w", level, err)
		}
		writers[level] = file
		if f, ok := file.(*os.File); ok {
			files[level] = f
		}

		// Create log rotator
		rotator := NewLogRotator(
			cfg.Logging.LogDir,
			maxLogSize,
			cfg.Logging.MaxLogAge,
			cfg.Logging.CompressLogs,
		)
		rotators[level] = rotator
	}

	logger := &Logger{
		config:   cfg,
		writers:  writers,
		rotators: rotators,
		files:    files,
		stopChan: make(chan struct{}),
	}

	// Start background cleanup routine
	go logger.startCleanupRoutine()

	return logger, nil
}

// InitializeLogger creates a new logger and runs the startup sequence
func InitializeLogger(cfg *config.Config) (*Logger, error) {
	logger, err := NewLogger(cfg)
	if err != nil {
		return nil, err
	}

	// Display startup information
	logger.LogStartup()

	// Run initial cleanup and rotation
	logger.Info("Running initial log cleanup", nil)
	if err := logger.runCleanup(); err != nil {
		return nil, fmt.Errorf("failed to run initial cleanup: %w", err)
	}
	logger.Info("Initial log cleanup completed", nil)

	return logger, nil
}

func openLogFile(path string) (io.Writer, error) {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory: %w", err)
	}

	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open log file: %w", err)
	}

	return file, nil
}

func (l *Logger) log(level LogLevel, message string, data interface{}) {
	// If logging is disabled globally, don't log anything
	if !l.config.Logging.Enabled {
		return
	}

	// Check if the specific log level is enabled
	var levelEnabled bool
	switch level {
	case DEBUG:
		levelEnabled = l.config.Logging.Debug.Enabled
	case INFO:
		levelEnabled = l.config.Logging.Info.Enabled
	case WARN:
		levelEnabled = l.config.Logging.Warn.Enabled
	case ERROR:
		levelEnabled = l.config.Logging.Error.Enabled
	default:
		return
	}

	if !levelEnabled {
		return
	}

	// Check if rotation is needed before any write operation
	if rotator, exists := l.rotators[level]; exists {
		filePath := filepath.Join(l.config.Logging.LogDir, l.getLogFileName(level))

		maxLogSize, err := l.config.GetMaxLogSize()
		if err != nil {
			l.logError("Failed to parse max log size", err)
			return
		}

		// Check file size
		if info, err := os.Stat(filePath); err == nil && info.Size() >= maxLogSize {
			// Close the current file before rotation
			if file, ok := l.files[level]; ok {
				file.Close()
				delete(l.files, level)
			}

			if err := rotator.RotateIfNeeded(filePath); err != nil {
				l.logError("Failed to rotate log file", err)
			}

			// Reopen the file after rotation
			if err := l.reopenFile(level); err != nil {
				l.logError("Failed to reopen log file after rotation", err)
				return
			}
		}
	}

	writer, exists := l.writers[level]
	if !exists {
		return
	}

	entry := LogEntry{
		Timestamp: time.Now().Format(time.RFC3339),
		Level:     level,
		Message:   message,
		Data:      data,
	}

	jsonData, err := json.Marshal(entry)
	if err != nil {
		l.logError("Failed to marshal log entry", err)
		return
	}

	// Write to file first
	if file, ok := writer.(*os.File); ok {
		if _, err := fmt.Fprintln(file, string(jsonData)); err != nil {
			l.logError("Failed to write to log file", err)
			// Try to reopen the file if it's closed
			if err := l.reopenFile(level); err != nil {
				l.logError("Failed to reopen file after write error", err)
				return
			}
			// Try writing again with the new file
			if newFile, ok := l.writers[level].(*os.File); ok {
				if _, err := fmt.Fprintln(newFile, string(jsonData)); err != nil {
					l.logError("Failed to write to reopened log file", err)
				}
			}
		}
	}

	// Only output to console in development environment
	if l.config.App.Environment == "development" {
		var color string
		var shouldOutput bool

		switch level {
		case DEBUG:
			color = colorBlue
			shouldOutput = l.config.Logging.Debug.ConsoleOutput
		case INFO:
			color = colorWhite
			shouldOutput = l.config.Logging.Info.ConsoleOutput
		case WARN:
			color = colorYellow
			shouldOutput = l.config.Logging.Warn.ConsoleOutput
		case ERROR:
			color = colorRed
			shouldOutput = l.config.Logging.Error.ConsoleOutput
		}

		if shouldOutput {
			fmt.Fprintf(os.Stdout, "%s%s%s\n", color, string(jsonData), colorReset)
		}
	}
}

func (l *Logger) getLogFileName(level LogLevel) string {
	switch level {
	case DEBUG:
		return l.config.Logging.Debug.File
	case INFO:
		return l.config.Logging.Info.File
	case WARN:
		return l.config.Logging.Warn.File
	case ERROR:
		return l.config.Logging.Error.File
	default:
		return ""
	}
}

func (l *Logger) Debug(message string, data interface{}) {
	l.log(DEBUG, message, data)
}

func (l *Logger) Info(message string, data interface{}) {
	l.log(INFO, message, data)
}

func (l *Logger) Warn(message string, data interface{}) {
	l.log(WARN, message, data)
}

func (l *Logger) Error(message string, data interface{}) {
	l.log(ERROR, message, data)
}

func (l *Logger) LogStartup() {
	// Create ASCII art logo
	logo := figure.NewFigure("S.I.M.P", "slant", true)
	logo.Print()

	// Get system information
	hostname, _ := os.Hostname()
	ip := getLocalIP()
	goVersion := runtime.Version()
	systemStorage := getStorageInfo(l.config.Storage.BasePath)
	appStorage := getAppStorageInfo(l.config.Storage.BasePath)

	// Print startup information to console only
	fmt.Printf("\n%sSystem Information:%s\n", colorBlue, colorReset)
	fmt.Printf("Environment: %s\n", l.config.App.Environment)
	fmt.Printf("Hostname: %s\n", hostname)
	fmt.Printf("IP Address: %s\n", ip)
	fmt.Printf("Go Version: %s\n", goVersion)

	fmt.Printf("\n%sSystem Storage:%s\n", colorBlue, colorReset)
	fmt.Printf("Total Space: %s\n", formatBytes(systemStorage["total_bytes"].(uint64)))
	fmt.Printf("Free Space: %s\n", formatBytes(systemStorage["free_bytes"].(uint64)))
	fmt.Printf("Used Space: %s\n", formatBytes(systemStorage["used_bytes"].(uint64)))
	fmt.Printf("Used Percentage: %.2f%%\n", systemStorage["used_percent"].(float64))

	fmt.Printf("\n%sApplication Storage:%s\n", colorBlue, colorReset)
	fmt.Printf("Storage Path: %s\n", l.config.Storage.BasePath)
	fmt.Printf("Total Files: %d\n", appStorage["total_files"].(int))
	fmt.Printf("Total Size: %s\n", formatBytes(appStorage["total_size"].(uint64)))
	fmt.Printf("Average File Size: %s\n", formatBytes(appStorage["avg_file_size"].(uint64)))

	fmt.Printf("\n%sConfiguration:%s\n", colorBlue, colorReset)
	fmt.Printf("Port: %d\n", l.config.App.Port)

	maxFileSize, err := l.config.GetMaxFileSize()
	if err != nil {
		l.Error("Failed to parse max file size", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	maxLogSize, err := l.config.GetMaxLogSize()
	if err != nil {
		l.Error("Failed to parse max log size", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	// Print configuration
	fmt.Printf("Max File Size: %s\n", formatBytes(uint64(maxFileSize)))
	fmt.Printf("UUID Format: %s\n", l.config.App.UUIDFormat)
	fmt.Printf("Enable IP Tracking: %v\n", l.config.App.EnableIPTracking)
	fmt.Printf("Storage Path: %s\n", l.config.Storage.BasePath)
	fmt.Printf("Allowed Extensions: %v\n", l.config.Storage.AllowedExtensions)

	// Add logging configuration
	fmt.Printf("\n%sLogging Configuration:%s\n", colorBlue, colorReset)
	fmt.Printf("Log Directory: %s\n", l.config.Logging.LogDir)
	fmt.Printf("Max Log Size: %s\n", formatBytes(uint64(maxLogSize)))
	fmt.Printf("Max Log Age: %d days\n", l.config.Logging.MaxLogAge)
	fmt.Printf("Compress Logs: %v\n", l.config.Logging.CompressLogs)
	fmt.Printf("Cleanup Schedule: %d minutes\n", l.config.Logging.CleanupSchedule)
	fmt.Printf("Log Levels:\n")
	// Get console output status for each log level
	getConsoleStatus := func(enabled bool) string {
		if l.config.App.Environment == "production" {
			return "disabled in production"
		}
		return fmt.Sprintf("%v", enabled)
	}

	// Print log level configuration
	logLevels := []struct {
		name    string
		enabled bool
		console bool
	}{
		{"Debug", l.config.Logging.Debug.Enabled, l.config.Logging.Debug.ConsoleOutput},
		{"Info", l.config.Logging.Info.Enabled, l.config.Logging.Info.ConsoleOutput},
		{"Warn", l.config.Logging.Warn.Enabled, l.config.Logging.Warn.ConsoleOutput},
		{"Error", l.config.Logging.Error.Enabled, l.config.Logging.Error.ConsoleOutput},
	}

	for _, level := range logLevels {
		fmt.Printf("  %s: %v (Console: %s)\n", level.name, level.enabled, getConsoleStatus(level.console))
	}

	// Add storage configuration
	fmt.Printf("\n%sStorage Configuration:%s\n", colorBlue, colorReset)
	fmt.Printf("Storage Path: %s\n", l.config.Storage.BasePath)
	fmt.Printf("Storage Limit: %s\n", l.config.GetStorageLimit())
	fmt.Printf("Allowed Extensions: %v\n", l.config.Storage.AllowedExtensions)

	// Add rate limit configuration
	fmt.Printf("\n%sRate Limit Configuration:%s\n", colorBlue, colorReset)
	fmt.Printf("%s\n", formatRateLimitStatus(l.config.RateLimit))

	fmt.Println()

	// Log the startup event and logger initialization
	l.Info("Application started", map[string]interface{}{
		"environment": l.config.App.Environment,
		"port":        l.config.App.Port,
	})

	l.Info("Logger initialized", map[string]interface{}{
		"log_dir":          l.config.Logging.LogDir,
		"max_log_size":     maxLogSize,
		"max_log_age":      l.config.Logging.MaxLogAge,
		"compress_logs":    l.config.Logging.CompressLogs,
		"cleanup_schedule": l.config.Logging.CleanupSchedule,
	})
}

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "unknown"
	}
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}
	return "unknown"
}

func getStorageInfo(path string) map[string]interface{} {
	var total, free uint64
	if err := GetDiskUsage(path, &total, &free); err != nil {
		return map[string]interface{}{
			"error": err.Error(),
		}
	}
	return map[string]interface{}{
		"total_bytes":  total,
		"free_bytes":   free,
		"used_bytes":   total - free,
		"used_percent": float64(total-free) / float64(total) * 100,
	}
}

func getAppStorageInfo(path string) map[string]interface{} {
	var totalSize uint64
	var fileCount int

	err := filepath.Walk(path, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			totalSize += uint64(info.Size())
			fileCount++
		}
		return nil
	})

	if err != nil {
		return map[string]interface{}{
			"error": err.Error(),
		}
	}

	var avgFileSize uint64
	if fileCount > 0 {
		avgFileSize = totalSize / uint64(fileCount)
	}

	return map[string]interface{}{
		"total_files":   fileCount,
		"total_size":    totalSize,
		"avg_file_size": avgFileSize,
	}
}

func formatBytes(bytes uint64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// formatRateLimitStatus returns a formatted string showing rate limiting configuration
func formatRateLimitStatus(rl struct {
	Enabled     bool   `yaml:"enabled"`
	RedisURL    string `yaml:"redis_url"`
	DefaultRate struct {
		Requests int   `yaml:"requests"`
		Period   int64 `yaml:"period"` // in seconds
	} `yaml:"default_rate"`
	Routes map[string]struct {
		Requests int   `yaml:"requests"`
		Period   int64 `yaml:"period"` // in seconds
	} `yaml:"routes"`
}) string {
	if !rl.Enabled {
		return "Disabled"
	}

	status := fmt.Sprintf("Enabled (Redis: %s)\n", rl.RedisURL)
	status += fmt.Sprintf("  Default Rate: %d requests per %d seconds\n", rl.DefaultRate.Requests, rl.DefaultRate.Period)

	if len(rl.Routes) > 0 {
		status += "  Route-specific limits:\n"
		for route, limit := range rl.Routes {
			status += fmt.Sprintf("    %s: %d requests per %d seconds\n", route, limit.Requests, limit.Period)
		}
	}

	return status
}

func (l *Logger) runCleanup() error {
	// Check and rotate all log files
	for level, rotator := range l.rotators {
		filePath := filepath.Join(l.config.Logging.LogDir, l.getLogFileName(level))

		maxLogSize, err := l.config.GetMaxLogSize()
		if err != nil {
			return fmt.Errorf("failed to parse max log size: %w", err)
		}

		// Check if file exists and needs rotation
		if info, err := os.Stat(filePath); err == nil {
			if info.Size() >= maxLogSize {
				// Log that we're going to rotate this file
				l.Info("Starting log rotation", map[string]interface{}{
					"file":     filePath,
					"size":     info.Size(),
					"max_size": maxLogSize,
					"level":    level,
				})

				// Close the current file before rotation
				if file, ok := l.files[level]; ok {
					file.Close()
					delete(l.files, level)
				}

				if err := rotator.RotateIfNeeded(filePath); err != nil {
					l.logError("Failed to rotate log file during cleanup", err)
					continue
				}

				// Reopen the file after rotation
				if err := l.reopenFile(level); err != nil {
					l.logError("Failed to reopen log file after rotation", err)
					continue
				}

				// Log successful rotation
				l.Info("Log rotation completed", map[string]interface{}{
					"file":  filePath,
					"level": level,
				})
			} else {
				// Log that no rotation is needed
				l.Info("No rotation needed for log file", map[string]interface{}{
					"file":     filePath,
					"size":     info.Size(),
					"max_size": maxLogSize,
					"level":    level,
				})
			}
		}
	}

	// Run cleanup for all rotators
	for _, rotator := range l.rotators {
		if err := rotator.CleanupOldArchives(); err != nil {
			l.logError("Failed to cleanup old archives", err)
		}
	}

	return nil
}

func (l *Logger) startCleanupRoutine() {
	ticker := time.NewTicker(time.Duration(l.config.Logging.CleanupSchedule) * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			l.Info("Starting scheduled log cleanup", map[string]interface{}{
				"schedule_minutes": l.config.Logging.CleanupSchedule,
			})
			if err := l.runCleanup(); err != nil {
				l.logError("Failed to run scheduled cleanup", err)
			}
			l.Info("Completed scheduled log cleanup", nil)
		case <-l.stopChan:
			return
		}
	}
}

func (l *Logger) Close() error {
	if !l.config.Logging.Enabled {
		return nil
	}

	// Stop the cleanup routine
	close(l.stopChan)

	// Cleanup old archives
	for _, rotator := range l.rotators {
		if err := rotator.CleanupOldArchives(); err != nil {
			return fmt.Errorf("failed to cleanup old archives: %w", err)
		}
	}

	// Close all files
	for _, file := range l.files {
		if err := file.Close(); err != nil {
			return err
		}
	}
	return nil
}

// reopenFile attempts to reopen a log file for a given level
func (l *Logger) reopenFile(level LogLevel) error {
	filePath := filepath.Join(l.config.Logging.LogDir, l.getLogFileName(level))

	// Close existing file if it exists
	if file, ok := l.files[level]; ok {
		file.Close()
		delete(l.files, level)
	}

	// Open new file
	newFile, err := openLogFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to reopen log file: %w", err)
	}

	// Update writers and files maps
	l.writers[level] = newFile
	if f, ok := newFile.(*os.File); ok {
		l.files[level] = f
	}

	return nil
}

// logError is a helper method to log errors that occur within the logger itself
func (l *Logger) logError(message string, err error) {
	// Create error entry
	entry := LogEntry{
		Timestamp: time.Now().Format(time.RFC3339),
		Level:     ERROR,
		Message:   message,
		Data: map[string]interface{}{
			"error": err.Error(),
		},
	}

	// Marshal to JSON
	jsonData, err := json.Marshal(entry)
	if err != nil {
		// If we can't even marshal the error, fall back to stderr
		fmt.Fprintf(os.Stderr, "Critical logger error: %v\n", err)
		return
	}

	// Try to write to error log file
	if file, ok := l.files[ERROR]; ok {
		if _, err := fmt.Fprintln(file, string(jsonData)); err != nil {
			// If we can't write to error log, try to reopen it
			if err := l.reopenFile(ERROR); err != nil {
				// If reopening fails, fall back to stderr
				fmt.Fprintf(os.Stderr, "%s\n", string(jsonData))
				return
			}
			// Try writing again with the new file
			if newFile, ok := l.files[ERROR]; ok {
				if _, err := fmt.Fprintln(newFile, string(jsonData)); err != nil {
					fmt.Fprintf(os.Stderr, "%s\n", string(jsonData))
				}
			}
		}
	} else {
		// If no error log file is available, try to create it
		if err := l.reopenFile(ERROR); err != nil {
			fmt.Fprintf(os.Stderr, "%s\n", string(jsonData))
			return
		}
		// Try writing with the new file
		if newFile, ok := l.files[ERROR]; ok {
			if _, err := fmt.Fprintln(newFile, string(jsonData)); err != nil {
				fmt.Fprintf(os.Stderr, "%s\n", string(jsonData))
			}
		}
	}

	// In development mode, print colored output to console
	if l.config.App.Environment == "development" {
		fmt.Fprintf(os.Stdout, "%s%s%s\n", colorRed, string(jsonData), colorReset)
	}
}
