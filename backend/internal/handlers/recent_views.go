package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"sharex/internal/storage"
)

type RecentViewsHandler struct {
	db *storage.DB
}

func NewRecentViewsHandler(db *storage.DB) *RecentViewsHandler {
	return &RecentViewsHandler{db: db}
}

func (h *RecentViewsHandler) GetRecentViews(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get the 10 most recent views
	views, err := h.db.GetAllRecentViews()
	if err != nil {
		// Return empty response instead of error
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"views":[]}`))
		return
	}

	// Format dates for JSON response
	type jsonRecentView struct {
		ID          int64  `json:"id"`
		ImageID     int64  `json:"imageId"`
		ImageUUID   string `json:"imageUuid"`
		IP          string `json:"ip"`
		Country     string `json:"country"`
		CountryCode string `json:"countryCode"`
		UserAgent   string `json:"userAgent"`
		ViewedAt    string `json:"viewedAt"`
	}

	// Handle nil or empty views
	formattedViews := []jsonRecentView{}

	// Only process views if they exist
	if len(views) > 0 {
		// Convert views to response format
		formattedViews = make([]jsonRecentView, len(views))
		for i, view := range views {
			countryName := view.Country
			countryCode := "unknown"

			// Handle empty country
			if countryName == "" {
				countryName = "Unknown"
			}

			// Try to find country code, using case-insensitive lookup
			for name, code := range CountryCodeMap {
				if strings.EqualFold(name, countryName) {
					countryCode = code
					break
				}
			}

			formattedViews[i] = jsonRecentView{
				ID:          view.ID,
				ImageID:     view.ImageID,
				ImageUUID:   view.ImageUUID,
				IP:          view.IP,
				Country:     countryName,
				CountryCode: countryCode,
				UserAgent:   view.UserAgent,
				ViewedAt:    view.ViewedAt.UTC().Format(time.RFC3339),
			}
		}
	}

	// Build response
	response := struct {
		Views []jsonRecentView `json:"views"`
	}{
		Views: formattedViews,
	}

	// Write response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
