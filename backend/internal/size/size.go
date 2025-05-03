package size

import (
	"fmt"
	"strconv"
	"strings"
)

// Parse converts a human-readable size string (e.g., "10MB", "5GB") to bytes
func Parse(sizeStr string) (int64, error) {
	// Remove any whitespace
	sizeStr = strings.TrimSpace(sizeStr)

	// Find where the numeric part ends
	var i int
	for i = 0; i < len(sizeStr); i++ {
		if !isNumeric(sizeStr[i]) {
			break
		}
	}

	if i == 0 {
		return 0, fmt.Errorf("invalid size value: no numeric part found")
	}

	// Split into number and unit
	number := sizeStr[:i]
	unit := strings.ToUpper(strings.TrimSpace(sizeStr[i:]))

	// Parse the number
	value, err := strconv.ParseFloat(number, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid size value: %w", err)
	}

	// Convert to bytes based on unit
	switch unit {
	case "B":
		return int64(value), nil
	case "KB":
		return int64(value * 1024), nil
	case "MB":
		return int64(value * 1024 * 1024), nil
	case "GB":
		return int64(value * 1024 * 1024 * 1024), nil
	case "TB":
		return int64(value * 1024 * 1024 * 1024 * 1024), nil
	default:
		return 0, fmt.Errorf("unknown size unit: %s", unit)
	}
}

// Format converts bytes to a human-readable string
func Format(bytes int64) string {
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

// isNumeric returns true if the byte is a digit or a decimal point
func isNumeric(b byte) bool {
	return (b >= '0' && b <= '9') || b == '.'
}
