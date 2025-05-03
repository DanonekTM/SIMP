package utils

import (
	"net"
	"net/http"
	"strings"
)

var privateCIDRs = []string{
	"0.0.0.0/8",          // "This" network
	"10.0.0.0/8",         // Private
	"100.64.0.0/10",      // Carrier-grade NAT
	"127.0.0.0/8",        // Loopback
	"169.254.0.0/16",     // Link-local
	"172.16.0.0/12",      // Private
	"192.0.0.0/24",       // IETF Protocol Assignments
	"192.0.2.0/24",       // TEST-NET-1
	"192.88.99.0/24",     // 6to4 Relay Anycast
	"192.168.0.0/16",     // Private
	"198.18.0.0/15",      // Benchmark testing
	"198.51.100.0/24",    // TEST-NET-2
	"203.0.113.0/24",     // TEST-NET-3
	"224.0.0.0/4",        // Multicast
	"240.0.0.0/4",        // Reserved for future use
	"255.255.255.255/32", // Broadcast
	"::1/128",            // IPv6 Loopback
	"fc00::/7",           // IPv6 Unique local address
	"fe80::/10",          // IPv6 Link-local
}

// IsPrivateIP checks if an IP address is private or reserved
func IsPrivateIP(ipStr string) bool {
	// Handle special cases first
	if ipStr == "localhost" {
		return true
	}

	// Parse the IP address
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}

	// Check if the IP is in any of the private CIDR ranges
	for _, cidr := range privateCIDRs {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			continue
		}
		if network.Contains(ip) {
			return true
		}
	}

	return false
}

// GetIPFromAddr extracts the IP address from an HTTP request or other sources
func GetIPFromAddr(addr interface{}) string {
	switch v := addr.(type) {
	case *http.Request:
		// Try to get the real IP from various headers
		// Check Cloudflare headers first
		if cfIP := v.Header.Get("Cf-Connecting-Ip"); cfIP != "" {
			return cfIP
		}

		// Check X-Forwarded-For
		if forwardedFor := v.Header.Get("X-Forwarded-For"); forwardedFor != "" {
			// X-Forwarded-For can contain multiple IPs, take the first one
			ips := strings.Split(forwardedFor, ",")
			if len(ips) > 0 {
				return strings.TrimSpace(ips[0])
			}
		}

		// Check X-Real-IP
		if realIP := v.Header.Get("X-Real-IP"); realIP != "" {
			return realIP
		}

		// Check X-Client-IP
		if clientIP := v.Header.Get("X-Client-IP"); clientIP != "" {
			return clientIP
		}

		// If no headers are present, use RemoteAddr
		if v.RemoteAddr != "" {
			ip, _, err := net.SplitHostPort(v.RemoteAddr)
			if err == nil {
				return ip
			}
			return v.RemoteAddr
		}

	case string:
		// If it's already a string, try to extract IP from "ip:port" format
		if strings.Contains(v, ":") {
			ip, _, err := net.SplitHostPort(v)
			if err == nil {
				return ip
			}
		}
		return v

	case net.Addr:
		// If it's a net.Addr, extract IP from the string representation
		addrStr := v.String()
		if strings.Contains(addrStr, ":") {
			ip, _, err := net.SplitHostPort(addrStr)
			if err == nil {
				return ip
			}
		}
		return addrStr

	default:
		return ""
	}

	return ""
}
