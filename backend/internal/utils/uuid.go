package utils

import (
	"crypto/rand"
	"encoding/base64"
	"regexp"
	"strings"
)

func GenerateFormattedUUID(format string) (string, error) {
	// Generate random bytes
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}

	// Convert to base64 and remove non-alphanumeric characters
	uuid := base64.URLEncoding.EncodeToString(b)
	uuid = strings.Map(func(r rune) rune {
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		return -1
	}, uuid)

	// Take first 10 characters
	if len(uuid) > 10 {
		uuid = uuid[:10]
	}

	// Validate against format
	re := regexp.MustCompile(format)
	if !re.MatchString(uuid) {
		// If validation fails, try again
		return GenerateFormattedUUID(format)
	}

	return uuid, nil
}
