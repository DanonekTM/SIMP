package models

import (
	"time"
)

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Password string `json:"-"` // Password is not exposed in JSON
}

type Image struct {
	ID         int64     `json:"id"`
	UUID       string    `json:"uuid"`
	Filename   string    `json:"filename"`
	Extension  string    `json:"extension"`
	Size       int64     `json:"size"`
	UploadedAt time.Time `json:"uploaded_at"`
	IsPrivate  bool      `json:"is_private"`
	PrivateKey string    `json:"private_key,omitempty"`
	Views      int64     `json:"views"`
}

type ImageView struct {
	ID          int64     `json:"id"`
	ImageID     int64     `json:"image_id"`
	IP          string    `json:"ip"`
	Country     string    `json:"country"` // This will be treated as country code
	CountryName string    `json:"country_name,omitempty"`
	UserAgent   string    `json:"user_agent"`
	ViewedAt    time.Time `json:"viewed_at"`
}

type RecentView struct {
	ID        int64     `json:"id"`
	ImageID   int64     `json:"imageId"`
	ImageUUID string    `json:"imageUuid"`
	IP        string    `json:"ip"`
	Country   string    `json:"country"`
	UserAgent string    `json:"userAgent"`
	ViewedAt  time.Time `json:"viewedAt"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Username  string `json:"username"`
	CSRFToken string `json:"csrf_token"`
	UploadKey string `json:"upload_key"`
}

type UploadResponse struct {
	UUID       string `json:"uuid"`
	Filename   string `json:"filename"`
	Extension  string `json:"extension"`
	Size       int64  `json:"size"`
	IsPrivate  bool   `json:"is_private"`
	PrivateKey string `json:"private_key,omitempty"`
	URL        string `json:"url"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

type DiskUsage struct {
	Used       float64 `json:"used"`
	Total      float64 `json:"total"`
	Percentage float64 `json:"percentage"`
}

type ViewsData struct {
	Date  string `json:"date"`
	Views int64  `json:"views"`
}

type CountryViews struct {
	Country    string  `json:"country"`
	Code       string  `json:"code"`
	Views      int64   `json:"views"`
	Percentage float64 `json:"percentage"`
}
