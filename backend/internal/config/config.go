package config

import (
	"fmt"
	"os"
	"path/filepath"

	"sharex/internal/size"

	"gopkg.in/yaml.v3"
)

type Config struct {
	App struct {
		Environment      string `yaml:"environment"`
		Port             int    `yaml:"port"`
		Domain           string `yaml:"domain"`
		JWTSecret        string `yaml:"jwt_secret"`
		MaxFileSize      string `yaml:"max_file_size"`
		UUIDFormat       string `yaml:"uuid_format"`
		UploadKey        string `yaml:"upload_key"`
		IPInfoToken      string `yaml:"ipinfo_token"`
		EnableIPTracking bool   `yaml:"enable_ip_tracking"`
	} `yaml:"app"`

	User struct {
		Username string `yaml:"username"`
		Password string `yaml:"password"`
	} `yaml:"user"`

	Database struct {
		File string `yaml:"file"` // Database file path
	} `yaml:"database"`

	Storage struct {
		BasePath          string   `yaml:"base_path"`
		AllowedExtensions []string `yaml:"allowed_extensions"`
		MaxStorage        string   `yaml:"max_storage"`
	} `yaml:"storage"`

	Logging struct {
		Enabled bool   `yaml:"enabled"`
		LogDir  string `yaml:"log_dir"`
		Debug   struct {
			Enabled       bool   `yaml:"enabled"`
			ConsoleOutput bool   `yaml:"console_output"`
			File          string `yaml:"file"`
		} `yaml:"debug"`
		Info struct {
			Enabled       bool   `yaml:"enabled"`
			ConsoleOutput bool   `yaml:"console_output"`
			File          string `yaml:"file"`
		} `yaml:"info"`
		Warn struct {
			Enabled       bool   `yaml:"enabled"`
			ConsoleOutput bool   `yaml:"console_output"`
			File          string `yaml:"file"`
		} `yaml:"warn"`
		Error struct {
			Enabled       bool   `yaml:"enabled"`
			ConsoleOutput bool   `yaml:"console_output"`
			File          string `yaml:"file"`
		} `yaml:"error"`
		MaxLogSize      string `yaml:"max_log_size"`
		MaxLogAge       int    `yaml:"max_log_age"`
		CompressLogs    bool   `yaml:"compress_logs"`
		CleanupSchedule int    `yaml:"cleanup_schedule"`
	} `yaml:"logging"`

	CORS struct {
		Enabled        bool     `yaml:"enabled"`
		AllowedOrigins []string `yaml:"allowed_origins"`
		AllowedMethods []string `yaml:"allowed_methods"`
		AllowedHeaders []string `yaml:"allowed_headers"`
	} `yaml:"cors"`

	RateLimit struct {
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
	} `yaml:"rate_limit"`
}

// GetMaxFileSize returns the max file size in bytes
func (c *Config) GetMaxFileSize() (int64, error) {
	return size.Parse(c.App.MaxFileSize)
}

// GetMaxLogSize returns the max log size in bytes
func (c *Config) GetMaxLogSize() (int64, error) {
	return size.Parse(c.Logging.MaxLogSize)
}

// GetMaxStorage returns the max storage size in bytes
func (c *Config) GetMaxStorage() (int64, error) {
	if c.Storage.MaxStorage == "FULL" {
		return -1, nil // -1 indicates unlimited storage
	}
	return size.Parse(c.Storage.MaxStorage)
}

// IsFullStorageAllowed returns true if storage is set to "FULL"
func (c *Config) IsFullStorageAllowed() bool {
	return c.Storage.MaxStorage == "FULL"
}

// GetStorageLimit returns the storage limit in a human-readable format
func (c *Config) GetStorageLimit() string {
	if c.IsFullStorageAllowed() {
		return "FULL"
	}
	return c.Storage.MaxStorage
}

func LoadConfig(path string) (*Config, error) {
	file, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(file, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Validate size values
	if _, err := config.GetMaxFileSize(); err != nil {
		return nil, fmt.Errorf("invalid max_file_size: %w", err)
	}
	if _, err := config.GetMaxLogSize(); err != nil {
		return nil, fmt.Errorf("invalid max_log_size: %w", err)
	}
	if _, err := config.GetMaxStorage(); err != nil {
		return nil, fmt.Errorf("invalid max_storage: %w", err)
	}

	// Create necessary directories
	if err := os.MkdirAll(config.Storage.BasePath, 0755); err != nil {
		return nil, err
	}

	if config.Logging.Enabled {
		if err := os.MkdirAll(config.Logging.LogDir, 0755); err != nil {
			return nil, err
		}
	}

	return &config, nil
}

func (c *Config) GetLogPath(filename string) string {
	return filepath.Join(c.Logging.LogDir, filename)
}
