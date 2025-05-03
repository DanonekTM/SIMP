package handlers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"sharex/internal/config"
	"sharex/internal/middleware"
	"sharex/internal/models"
	"sharex/internal/storage"
	"sharex/internal/utils"
)

type Handler struct {
	config *config.Config
	db     *storage.DB
	logger *utils.Logger
}

func NewHandler(cfg *config.Config, db *storage.DB, logger *utils.Logger) *Handler {
	return &Handler{
		config: cfg,
		db:     db,
		logger: logger,
	}
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Warn("Invalid login request", map[string]interface{}{
			"error": err.Error(),
		})
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	user, err := h.db.GetUser(req.Username)
	if err != nil {
		h.logger.Error("Failed to get user", map[string]interface{}{
			"error":    err.Error(),
			"username": req.Username,
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if user == nil || user.Password != req.Password {
		h.logger.Warn("Invalid login attempt", map[string]interface{}{
			"username": req.Username,
		})
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate token pair
	accessToken, refreshToken, err := utils.GenerateTokenPair(user.Username, h.config.App.JWTSecret)
	if err != nil {
		h.logger.Error("Failed to generate tokens", map[string]interface{}{
			"error":    err.Error(),
			"username": user.Username,
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Set secure cookies
	utils.SetTokenCookies(w, accessToken, refreshToken, h.config.App.Environment == "production")

	// Generate CSRF token
	csrfToken := middleware.GenerateCSRFToken()
	http.SetCookie(w, &http.Cookie{
		Name:     "csrf_token",
		Value:    csrfToken,
		Path:     "/",
		HttpOnly: false, // Needs to be accessible by JavaScript
		Secure:   h.config.App.Environment == "production",
		SameSite: http.SameSiteStrictMode,
		MaxAge:   int((24 * time.Hour).Seconds()),
	})

	// Set upload key cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "upload_key",
		Value:    h.config.App.UploadKey,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.config.App.Environment == "production",
		SameSite: http.SameSiteStrictMode,
		MaxAge:   int((24 * time.Hour).Seconds()),
	})

	h.logger.Info("User logged in successfully", map[string]interface{}{
		"username": user.Username,
	})

	// Set content type header
	w.Header().Set("Content-Type", "application/json")

	// Return only necessary information
	json.NewEncoder(w).Encode(models.LoginResponse{
		Username: user.Username,
	})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Clear all auth cookies with proper attributes
	utils.ClearTokenCookies(w, h.config.App.Environment == "production")
	http.SetCookie(w, &http.Cookie{
		Name:     "csrf_token",
		Value:    "",
		Path:     "/",
		HttpOnly: false,
		Secure:   h.config.App.Environment == "production",
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})

	// Clear upload key cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "upload_key",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   h.config.App.Environment == "production",
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Logged out successfully",
	})
}

func (h *Handler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	refreshToken := utils.GetTokenFromCookie(r, "refresh_token")
	if refreshToken == "" {
		http.Error(w, "No refresh token provided", http.StatusUnauthorized)
		return
	}

	// Validate refresh token
	claims, err := utils.ValidateToken(refreshToken, h.config.App.JWTSecret)
	if err != nil || claims.TokenType != utils.RefreshToken {
		http.Error(w, "Invalid refresh token", http.StatusUnauthorized)
		return
	}

	// Generate new token pair
	accessToken, newRefreshToken, err := utils.GenerateTokenPair(claims.Username, h.config.App.JWTSecret)
	if err != nil {
		http.Error(w, "Failed to generate new tokens", http.StatusInternalServerError)
		return
	}

	// Set new cookies
	utils.SetTokenCookies(w, accessToken, newRefreshToken, h.config.App.Environment == "production")

	// Generate new CSRF token
	csrfToken := middleware.GenerateCSRFToken()
	http.SetCookie(w, &http.Cookie{
		Name:     "csrf_token",
		Value:    csrfToken,
		Path:     "/",
		HttpOnly: false, // Needs to be accessible by JavaScript
		Secure:   h.config.App.Environment == "production",
		SameSite: http.SameSiteStrictMode,
		MaxAge:   int((24 * time.Hour).Seconds()),
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"username":   claims.Username,
		"csrf_token": csrfToken,
	})
}

func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.logger.Warn("Invalid method for upload", map[string]interface{}{
			"method": r.Method,
		})
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check upload key from both cookie and form value
	uploadKeyCookie, cookieErr := r.Cookie("upload_key")
	formKey := strings.TrimSpace(r.FormValue("key"))
	expectedKey := strings.TrimSpace(strings.Trim(h.config.App.UploadKey, `"'`))

	// Validate either cookie or form key matches
	validCookie := cookieErr == nil && uploadKeyCookie.Value == expectedKey
	validFormKey := formKey == expectedKey

	if !validCookie && !validFormKey {
		h.logger.Warn("Invalid upload key", map[string]interface{}{
			"provided_form_key": formKey,
			"has_cookie":        cookieErr == nil,
			"expected_key":      expectedKey,
		})
		http.Error(w, "Invalid upload key", http.StatusUnauthorized)
		return
	}

	// Try to get file from either "file" or "img" field
	var file multipart.File
	var header *multipart.FileHeader
	var err error

	// Try "img" first (ShareX uses this)
	file, header, err = r.FormFile("img")
	if err != nil {
		// If "img" fails, try "file"
		file, header, err = r.FormFile("file")
		if err != nil {
			h.logger.Warn("Failed to get file from request", map[string]interface{}{
				"error": err.Error(),
			})
			http.Error(w, "Failed to get file", http.StatusBadRequest)
			return
		}
	}
	defer file.Close()

	// Check file size
	maxFileSize, err := h.config.GetMaxFileSize()
	if err != nil {
		h.logger.Error("Failed to parse max file size", map[string]interface{}{
			"error": err.Error(),
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if header.Size > maxFileSize {
		h.logger.Warn("File too large", map[string]interface{}{
			"size":     header.Size,
			"max_size": maxFileSize,
			"filename": header.Filename,
		})
		http.Error(w, "File too large", http.StatusBadRequest)
		return
	}

	// Check total storage size
	maxStorage, err := h.config.GetMaxStorage()
	if err != nil {
		h.logger.Error("Failed to parse max storage size", map[string]interface{}{
			"error": err.Error(),
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Calculate current storage usage
	var currentStorageSize int64
	err = filepath.Walk(h.config.Storage.BasePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			currentStorageSize += info.Size()
		}
		return nil
	})
	if err != nil {
		h.logger.Error("Failed to calculate storage usage", map[string]interface{}{
			"error": err.Error(),
			"path":  h.config.Storage.BasePath,
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Check if adding the new file would exceed the maximum storage
	// Skip check if maxStorage is -1 (FULL)
	if maxStorage != -1 && currentStorageSize+header.Size > maxStorage {
		h.logger.Warn("Storage limit exceeded", map[string]interface{}{
			"current_usage": currentStorageSize,
			"file_size":     header.Size,
			"max_storage":   maxStorage,
		})
		http.Error(w, "Maximum storage limit reached", http.StatusBadRequest)
		return
	}

	// Check file extension
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(header.Filename), "."))
	allowed := false
	for _, allowedExt := range h.config.Storage.AllowedExtensions {
		if ext == allowedExt {
			allowed = true
			break
		}
	}
	if !allowed {
		h.logger.Warn("File type not allowed", map[string]interface{}{
			"extension": ext,
			"filename":  header.Filename,
		})
		http.Error(w, "File type not allowed", http.StatusBadRequest)
		return
	}

	// Check if filename already matches our UUID format
	filename := strings.TrimSuffix(header.Filename, filepath.Ext(header.Filename))
	re := regexp.MustCompile(h.config.App.UUIDFormat)
	var uuid string

	if re.MatchString(filename) {
		// Check if this UUID already exists
		existingImage, err := h.db.GetImage(filename)
		if err != nil {
			h.logger.Error("Failed to check existing image", map[string]interface{}{
				"error": err.Error(),
			})
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		if existingImage == nil {
			// Use the existing UUID from filename
			uuid = filename
		} else {
			// Generate new UUID if this one exists
			uuid, err = utils.GenerateFormattedUUID(h.config.App.UUIDFormat)
			if err != nil {
				h.logger.Error("Failed to generate UUID", map[string]interface{}{
					"error": err.Error(),
				})
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
		}
	} else {
		// Generate new UUID
		uuid, err = utils.GenerateFormattedUUID(h.config.App.UUIDFormat)
		if err != nil {
			h.logger.Error("Failed to generate UUID", map[string]interface{}{
				"error": err.Error(),
			})
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	now := time.Now()
	path := filepath.Join(
		h.config.Storage.BasePath,
		fmt.Sprintf("%d", now.Year()),
		fmt.Sprintf("%02d", now.Month()),
		fmt.Sprintf("%02d", now.Day()),
		fmt.Sprintf("%s.%s", uuid, ext),
	)

	// Create directory if it doesn't exist
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		h.logger.Error("Failed to create directory", map[string]interface{}{
			"error": err.Error(),
			"path":  filepath.Dir(path),
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Create file
	dst, err := os.Create(path)
	if err != nil {
		h.logger.Error("Failed to create file", map[string]interface{}{
			"error": err.Error(),
			"path":  path,
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy file
	if _, err := io.Copy(dst, file); err != nil {
		h.logger.Error("Failed to copy file", map[string]interface{}{
			"error": err.Error(),
			"path":  path,
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Create image record
	image := &models.Image{
		UUID:       uuid,
		Filename:   header.Filename,
		Extension:  ext,
		Size:       header.Size,
		UploadedAt: now,
		IsPrivate:  false,
		PrivateKey: "",
	}

	if err := h.db.CreateImage(image); err != nil {
		h.logger.Error("Failed to create image record", map[string]interface{}{
			"error": err.Error(),
			"uuid":  uuid,
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Return the full image object (format date)
	type jsonResponseImage struct { // Use temporary struct for date formatting
		ID         int64  `json:"id"`
		UUID       string `json:"uuid"`
		Filename   string `json:"filename"`
		Extension  string `json:"extension"`
		Size       int64  `json:"size"`
		UploadedAt string `json:"uploadedAt"` // String format
		IsPrivate  bool   `json:"isPrivate"`
		PrivateKey string `json:"privateKey,omitempty"`
		Views      int64  `json:"views"`
		URL        string `json:"url"`
		FullLink   string `json:"full_link,omitempty"` // Full URL including domain
	}

	baseURL := fmt.Sprintf("/%s.%s", image.UUID, image.Extension)
	responseImage := jsonResponseImage{
		ID:         image.ID,
		UUID:       image.UUID,
		Filename:   image.Filename,
		Extension:  image.Extension,
		Size:       image.Size,
		UploadedAt: image.UploadedAt.UTC().Format(time.RFC3339), // Format date
		IsPrivate:  image.IsPrivate,
		PrivateKey: image.PrivateKey,
		Views:      image.Views, // Should be 0 initially
		URL:        baseURL,
		FullLink:   fmt.Sprintf("http://%s%s", h.config.App.Domain, baseURL),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(responseImage)
}

func (h *Handler) ServeProxyImage(w http.ResponseWriter, r *http.Request) {
	// This endpoint requires authentication, which is handled by the middleware
	path := strings.TrimPrefix(r.URL.Path, "/api/proxy/")
	parts := strings.Split(path, ".")
	if len(parts) != 2 {
		http.Error(w, "Invalid image path", http.StatusBadRequest)
		return
	}

	uuid, ext := parts[0], parts[1]
	image, err := h.db.GetImage(uuid)
	if err != nil {
		h.logger.Error("Failed to get image", map[string]interface{}{
			"error": err.Error(),
			"uuid":  uuid,
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if image == nil {
		http.Error(w, "Image not found", http.StatusNotFound)
		return
	}

	// Get file path
	filePath := filepath.Join(
		h.config.Storage.BasePath,
		fmt.Sprintf("%d", image.UploadedAt.Year()),
		fmt.Sprintf("%02d", image.UploadedAt.Month()),
		fmt.Sprintf("%02d", image.UploadedAt.Day()),
		fmt.Sprintf("%s.%s", uuid, ext),
	)

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.Error(w, "Image not found", http.StatusNotFound)
		return
	}

	// Set content type based on file extension
	contentType := "image/jpeg" // default
	switch strings.ToLower(ext) {
	case "png":
		contentType = "image/png"
	case "gif":
		contentType = "image/gif"
	case "webp":
		contentType = "image/webp"
	case "jpg", "jpeg":
		contentType = "image/jpeg"
	}
	w.Header().Set("Content-Type", contentType)

	// Set cache control headers
	w.Header().Set("Cache-Control", "private, no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	// Serve file
	http.ServeFile(w, r, filePath)
}

func (h *Handler) ServeImage(w http.ResponseWriter, r *http.Request) {
	// Extract UUID and extension from path
	path := strings.TrimPrefix(r.URL.Path, "/")
	parts := strings.Split(path, ".")
	if len(parts) != 2 {
		h.serveStaticFile(w, "404.html")
		return
	}

	uuid, ext := parts[0], parts[1]

	// Get image metadata from database
	image, err := h.db.GetImage(uuid)
	if err != nil {
		h.logger.Error("Failed to get image", map[string]interface{}{
			"error": err.Error(),
			"uuid":  uuid,
		})
		h.serveStaticFile(w, "404.html")
		return
	}

	// Check if image exists
	if image == nil {
		h.serveStaticFile(w, "404.html")
		return
	}

	// Handle private image access
	if image.IsPrivate {
		key := r.URL.Query().Get("key")
		if key == "" {
			// No key provided for private image
			h.serveStaticFile(w, "404.html")
			return
		}

		// Decode base64 key
		decodedKey, err := base64.StdEncoding.DecodeString(key)
		if err != nil {
			// Invalid base64 key
			h.serveStaticFile(w, "404.html")
			return
		}

		// Compare keys
		if string(decodedKey) != image.PrivateKey {
			// Key doesn't match
			h.serveStaticFile(w, "404.html")
			return
		}
	}

	// Get file path
	filePath := filepath.Join(
		h.config.Storage.BasePath,
		fmt.Sprintf("%d", image.UploadedAt.Year()),
		fmt.Sprintf("%02d", image.UploadedAt.Month()),
		fmt.Sprintf("%02d", image.UploadedAt.Day()),
		fmt.Sprintf("%s.%s", uuid, ext),
	)

	// Check if file exists on disk
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		h.serveStaticFile(w, "404.html")
		return
	}

	// Set content type based on file extension
	contentType := "image/jpeg" // default
	switch strings.ToLower(ext) {
	case "png":
		contentType = "image/png"
	case "gif":
		contentType = "image/gif"
	case "webp":
		contentType = "image/webp"
	case "jpg", "jpeg":
		contentType = "image/jpeg"
	}
	w.Header().Set("Content-Type", contentType)

	// Set cache control headers
	if image.IsPrivate {
		w.Header().Set("Cache-Control", "private, no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
	}

	// Serve file
	http.ServeFile(w, r, filePath)

	// Record view if not from admin interface
	referer := r.Header.Get("Referer")
	if referer == "" || (!strings.Contains(referer, "/admin") && !strings.Contains(referer, "/images")) {
		var country string
		if h.config.App.EnableIPTracking {
			// Get IP info
			ipInfo, err := utils.GetIPInfo(r, h.config.App.IPInfoToken)
			if err != nil {
				h.logger.Error("Failed to get IP info", map[string]interface{}{
					"error": err.Error(),
					"ip":    utils.GetIPFromAddr(r),
				})
				country = "Unknown"
			} else {
				country = ipInfo.Country
			}
		} else {
			country = "Unknown"
		}

		// Determine IP value based on tracking setting
		var ip string
		if h.config.App.EnableIPTracking {
			ip = utils.GetIPFromAddr(r)
		} else {
			ip = "IP Tracking disabled"
		}

		// Record view with country information
		if err := h.db.AddImageView(image.ID, ip, country, r.UserAgent()); err != nil {
			h.logger.Error("Failed to record view", map[string]interface{}{
				"error":    err.Error(),
				"image_id": image.ID,
				"ip":       utils.GetIPFromAddr(r),
			})
		}
	}
}

func (h *Handler) DeleteImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get image ID from path
	path := strings.TrimPrefix(r.URL.Path, "/api/delete/")
	id, err := strconv.ParseInt(path, 10, 64)
	if err != nil {
		http.Error(w, "Invalid image ID", http.StatusBadRequest)
		return
	}

	// Get image from database
	image, err := h.db.GetImageByID(id)
	if err != nil {
		h.logger.Error("Failed to get image", map[string]interface{}{
			"error": err.Error(),
			"uuid":  image.UUID,
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if image == nil {
		http.Error(w, "Image not found", http.StatusNotFound)
		return
	}

	// Get file path
	filePath := filepath.Join(
		h.config.Storage.BasePath,
		fmt.Sprintf("%d", image.UploadedAt.Year()),
		fmt.Sprintf("%02d", image.UploadedAt.Month()),
		fmt.Sprintf("%02d", image.UploadedAt.Day()),
		fmt.Sprintf("%s.%s", image.UUID, image.Extension),
	)

	// Delete file
	if err := os.Remove(filePath); err != nil {
		h.logger.Error("Failed to delete file", map[string]interface{}{
			"error": err.Error(),
			"path":  filePath,
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Delete from database
	if err := h.db.DeleteImageByID(id); err != nil {
		h.logger.Error("Failed to delete image record", map[string]interface{}{
			"error": err.Error(),
			"uuid":  image.UUID,
		})
		h.logger.Error("Failed to delete image record: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Image deleted successfully",
	})
}

func (h *Handler) serveStaticFile(w http.ResponseWriter, filename string) {
	filePath := filepath.Join("frontend", "static", filename)
	content, err := os.ReadFile(filePath)
	if err != nil {
		h.logger.Error("Failed to read static file", map[string]interface{}{
			"error":    err.Error(),
			"filename": filename,
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Set appropriate content type based on file extension
	ext := filepath.Ext(filename)
	switch ext {
	case ".html":
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	case ".css":
		w.Header().Set("Content-Type", "text/css")
	case ".js":
		w.Header().Set("Content-Type", "application/javascript")
	default:
		w.Header().Set("Content-Type", "text/plain")
	}

	w.Write(content)
}

var (
	adminStaticFiles = []string{
		"/admin/favicon.ico",
		"/admin/apple-touch-icon.png",
		"/admin/android-chrome-512x512.png",
		"/admin/android-chrome-192x192.png",
		"/admin/site.webmanifest",
	}
	staticFiles = []string{
		"/favicon.ico",
		"/apple-touch-icon.png",
		"/logo.svg",
	}
)

func (h *Handler) handleCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) tryServeFile(w http.ResponseWriter, r *http.Request, basePath string, stripPrefix string) bool {
	filePath := filepath.Join(basePath, strings.TrimPrefix(r.URL.Path, stripPrefix))
	if _, err := os.Stat(filePath); err == nil {
		http.ServeFile(w, r, filePath)
		return true
	}
	return false
}

func (h *Handler) ServeFrontend(w http.ResponseWriter, r *http.Request) {
	// Set security headers
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("X-XSS-Protection", "1; mode=block")
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self'")

	if r.Method == "OPTIONS" {
		h.handleCORS(w)
		return
	}

	// Try serving admin static files
	if contains(adminStaticFiles, r.URL.Path) && h.tryServeFile(w, r, "frontend/dist", "/admin/") {
		return
	}

	// Try serving regular static files
	if contains(staticFiles, r.URL.Path) && h.tryServeFile(w, r, "frontend/static", "/") {
		return
	}

	// Check if the request is for an image
	if filepath.Ext(r.URL.Path) != "" && !strings.HasPrefix(r.URL.Path, "/assets/") && !strings.HasPrefix(r.URL.Path, "/admin/assets/") {
		// Create a new request with the same URL and query parameters
		imageReq := &http.Request{
			Method:     "GET",
			URL:        r.URL,
			Header:     r.Header,
			RemoteAddr: r.RemoteAddr,
		}
		h.ServeImage(w, imageReq)
		return
	}

	// For /admin and its assets, serve from frontend/dist
	if r.URL.Path == "/admin" || r.URL.Path == "/admin/" || strings.HasPrefix(r.URL.Path, "/admin/") || strings.HasPrefix(r.URL.Path, "/assets/") {
		// Get the file path
		filePath := r.URL.Path
		if strings.HasPrefix(filePath, "/admin") {
			filePath = strings.TrimPrefix(filePath, "/admin")
			if filePath == "" || filePath == "/" {
				filePath = "/index.html"
			}
		}

		// Remove leading slash for file path
		filePath = strings.TrimPrefix(filePath, "/")

		// Check if the file exists
		fullPath := filepath.Join("frontend/dist", filePath)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			// If file doesn't exist and it's under /admin/, serve index.html
			if strings.HasPrefix(r.URL.Path, "/admin") {
				http.ServeFile(w, r, filepath.Join("frontend/dist", "index.html"))
				return
			}
			// Otherwise return 404
			w.WriteHeader(http.StatusNotFound)
			h.serveStaticFile(w, "404.html")
			return
		}

		// Set appropriate content type
		if strings.HasSuffix(filePath, ".js") {
			w.Header().Set("Content-Type", "application/javascript")
		} else if strings.HasSuffix(filePath, ".css") {
			w.Header().Set("Content-Type", "text/css")
		} else if strings.HasSuffix(filePath, ".svg") {
			w.Header().Set("Content-Type", "image/svg+xml")
		}

		// Serve the file directly
		http.ServeFile(w, r, fullPath)
		return
	}

	// Serve index.html for root path
	if r.URL.Path == "/" {
		h.serveStaticFile(w, "index.html")
		return
	}

	// Serve 404.html for non-existent paths
	w.WriteHeader(http.StatusNotFound)
	h.serveStaticFile(w, "404.html")
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func (h *Handler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	totalImages, privateImages, totalViews, err := h.db.GetDashboardStats()
	if err != nil {
		h.logger.Error("Failed to get dashboard stats", map[string]interface{}{
			"error": err.Error(),
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_images":   totalImages,
		"private_images": privateImages,
		"total_views":    totalViews,
	})
}

func (h *Handler) ListImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Set content type
	w.Header().Set("Content-Type", "application/json")

	// Get query parameters
	imageType := r.URL.Query().Get("type")
	dateFrom := r.URL.Query().Get("from")
	dateTo := r.URL.Query().Get("to")

	// Get images from database
	images, err := h.db.ListImages(imageType, dateFrom, dateTo)
	if err != nil {
		h.logger.Error("Failed to list images: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Add URL field to each image and format the date
	type ImageWithURL struct {
		ID         int64  `json:"id"`
		UUID       string `json:"uuid"`
		Filename   string `json:"filename"`
		Extension  string `json:"extension"`
		Size       int64  `json:"size"`
		UploadedAt string `json:"uploadedAt"`
		IsPrivate  bool   `json:"isPrivate"`
		PrivateKey string `json:"privateKey,omitempty"`
		Views      int64  `json:"views"`
		URL        string `json:"url"`
	}

	imagesWithURL := make([]ImageWithURL, len(images))
	for i, img := range images {
		// Format the date to ISO 8601 without timezone
		formattedDate := img.UploadedAt.Format("2006-01-02T15:04:05")

		// Create base URL
		baseURL := fmt.Sprintf("/%s.%s", img.UUID, img.Extension)

		// Add private key to URL if image is private
		url := baseURL
		if img.IsPrivate && img.PrivateKey != "" {
			url = fmt.Sprintf("%s?key=%s", baseURL, base64.StdEncoding.EncodeToString([]byte(img.PrivateKey)))
		}

		imagesWithURL[i] = ImageWithURL{
			ID:         img.ID,
			UUID:       img.UUID,
			Filename:   img.Filename,
			Extension:  img.Extension,
			Size:       img.Size,
			UploadedAt: formattedDate,
			IsPrivate:  img.IsPrivate,
			PrivateKey: img.PrivateKey,
			Views:      img.Views,
			URL:        url,
		}
	}

	// Return response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"images": imagesWithURL,
	})
}

func (h *Handler) GetImageStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/stats/")
	if path == "" || strings.Contains(path, "/") {
		http.Error(w, "Invalid image identifier", http.StatusBadRequest)
		return
	}

	// Parse ID from path
	id, err := strconv.ParseInt(path, 10, 64)
	if err != nil {
		http.Error(w, "Invalid image ID", http.StatusBadRequest)
		return
	}

	// Get image from database
	image, err := h.db.GetImageByID(id)
	if err != nil {
		h.logger.Error("Failed to get image: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if image == nil {
		http.Error(w, "Image not found", http.StatusNotFound)
		return
	}

	viewsData, err := h.db.GetImageViews(image.ID)
	if err != nil {
		h.logger.Error("Failed to get image views: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Define temporary structs for JSON response with string dates
	type jsonImageView struct {
		ID          int64  `json:"id"`
		ImageID     int64  `json:"image_id"`
		IP          string `json:"ip"`
		Country     string `json:"country_name"`
		CountryCode string `json:"country_code"`
		UserAgent   string `json:"user_agent"`
		ViewedAt    string `json:"viewed_at"`
	}
	type jsonImage struct {
		ID         int64  `json:"id"`
		UUID       string `json:"uuid"`
		Filename   string `json:"filename"`
		Extension  string `json:"extension"`
		Size       int64  `json:"size"`
		UploadedAt string `json:"uploadedAt"`
		IsPrivate  bool   `json:"isPrivate"`
		PrivateKey string `json:"privateKey,omitempty"`
		Views      int64  `json:"views"`
	}

	// Format views with string dates
	formattedViews := make([]jsonImageView, len(viewsData))
	for i, v := range viewsData {
		countryCode := v.Country
		countryName := "Unknown"

		// Convert country code to country name using CountryCodeMap
		for name, code := range CountryCodeMap {
			if strings.EqualFold(code, countryCode) {
				countryName = name
				break
			}
		}

		// If country code is empty or "unknown", use "Unknown" as country name
		if countryCode == "" || strings.EqualFold(countryCode, "unknown") {
			countryCode = "unknown"
			countryName = "Unknown"
		}

		formattedViews[i] = jsonImageView{
			ID:          v.ID,
			ImageID:     v.ImageID,
			IP:          v.IP,
			Country:     countryName,
			CountryCode: strings.ToUpper(countryCode),
			UserAgent:   v.UserAgent,
			ViewedAt:    v.ViewedAt.UTC().Format(time.RFC3339),
		}
	}

	// Prepare image data with string date
	formattedImage := jsonImage{
		ID:         image.ID,
		UUID:       image.UUID,
		Filename:   image.Filename,
		Extension:  image.Extension,
		Size:       image.Size,
		UploadedAt: image.UploadedAt.UTC().Format(time.RFC3339),
		IsPrivate:  image.IsPrivate,
		PrivateKey: image.PrivateKey,
		Views:      image.Views,
	}

	// Encode the response with formatted data
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"image": formattedImage,
		"views": formattedViews,
	})
}

func (h *Handler) TogglePrivacy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get image ID from path
	path := strings.TrimPrefix(r.URL.Path, "/api/privacy/")
	id, err := strconv.ParseInt(path, 10, 64)
	if err != nil {
		http.Error(w, "Invalid image ID", http.StatusBadRequest)
		return
	}

	// Get image from database
	image, err := h.db.GetImageByID(id)
	if err != nil {
		h.logger.Error("Failed to get image: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if image == nil {
		http.Error(w, "Image not found", http.StatusNotFound)
		return
	}

	// Parse request body
	var req struct {
		IsPrivate bool   `json:"isPrivate"`
		Password  string `json:"password,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update privacy status
	image.IsPrivate = req.IsPrivate

	// Handle private key
	if req.IsPrivate {
		if req.Password == "" {
			http.Error(w, "Password is required for private images", http.StatusBadRequest)
			return
		}
		// Store the password as the private key
		image.PrivateKey = req.Password
	} else {
		image.PrivateKey = ""
	}

	// Update in database
	if err := h.db.UpdateImage(image); err != nil {
		h.logger.Error("Failed to update image: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Return updated image with proper JSON formatting
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":         image.ID,
		"uuid":       image.UUID,
		"filename":   image.Filename,
		"extension":  image.Extension,
		"size":       image.Size,
		"uploadedAt": image.UploadedAt.UTC().Format(time.RFC3339),
		"isPrivate":  image.IsPrivate,
		"privateKey": image.PrivateKey,
		"views":      image.Views,
		"url":        fmt.Sprintf("/%s.%s", image.UUID, image.Extension),
	})
}

func (h *Handler) VerifyToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get access token from cookie
	accessToken := utils.GetTokenFromCookie(r, "access_token")
	if accessToken == "" {
		http.Error(w, "No access token found", http.StatusUnauthorized)
		return
	}

	// Validate token
	claims, err := utils.ValidateToken(accessToken, h.config.App.JWTSecret)
	if err != nil {
		if refreshToken := utils.GetTokenFromCookie(r, "refresh_token"); refreshToken != "" {
			// Try to refresh the token
			refreshClaims, err := utils.ValidateToken(refreshToken, h.config.App.JWTSecret)
			if err != nil || refreshClaims.TokenType != utils.RefreshToken {
				http.Error(w, "Invalid refresh token", http.StatusUnauthorized)
				return
			}

			// Generate new token pair
			newAccessToken, newRefreshToken, err := utils.GenerateTokenPair(refreshClaims.Username, h.config.App.JWTSecret)
			if err != nil {
				http.Error(w, "Failed to generate new tokens", http.StatusInternalServerError)
				return
			}

			// Set new cookies
			utils.SetTokenCookies(w, newAccessToken, newRefreshToken, h.config.App.Environment == "production")

			// Return the username
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"username": refreshClaims.Username,
			})
			return
		}
		http.Error(w, "Invalid access token", http.StatusUnauthorized)
		return
	}

	if claims.TokenType != utils.AccessToken {
		http.Error(w, "Invalid token type", http.StatusUnauthorized)
		return
	}

	// Return the username in the response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"username": claims.Username,
	})
}

func (h *Handler) GetDiskUsage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Calculate application storage usage
	var appStorageSize int64
	err := filepath.Walk(h.config.Storage.BasePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			appStorageSize += info.Size()
		}
		return nil
	})
	if err != nil {
		h.logger.Error("Failed to calculate application storage usage", map[string]interface{}{
			"error": err.Error(),
			"path":  h.config.Storage.BasePath,
		})
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Internal server error",
		})
		return
	}

	// Convert to GB for the frontend
	const GB = 1024 * 1024 * 1024
	appStorageGB := float64(appStorageSize) / GB

	if h.config.IsFullStorageAllowed() {
		// If FULL storage is enabled, show system disk usage
		var total, free uint64
		if err := utils.GetDiskUsage(h.config.Storage.BasePath, &total, &free); err != nil {
			h.logger.Error("Failed to get disk usage", map[string]interface{}{
				"error": err.Error(),
				"path":  h.config.Storage.BasePath,
			})
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "Internal server error",
			})
			return
		}

		used := total - free
		percentage := float64(used) / float64(total) * 100
		totalGB := float64(total) / GB
		usedGB := float64(used) / GB

		json.NewEncoder(w).Encode(map[string]interface{}{
			"total":      totalGB,
			"used":       usedGB,
			"percentage": percentage,
		})
	} else {
		// If specific storage limit is set, show usage against that limit
		maxStorage, err := h.config.GetMaxStorage()
		if err != nil {
			h.logger.Error("Failed to parse max storage size", map[string]interface{}{
				"error": err.Error(),
			})
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "Internal server error",
			})
			return
		}

		maxStorageGB := float64(maxStorage) / GB
		percentage := float64(appStorageSize) / float64(maxStorage) * 100

		json.NewEncoder(w).Encode(map[string]interface{}{
			"total":      maxStorageGB,
			"used":       appStorageGB,
			"percentage": percentage,
		})
	}
}

func (h *Handler) GetViewsData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get views for the last 30 days
	views := make([]models.ViewsData, 30)
	now := time.Now()

	for i := 29; i >= 0; i-- {
		date := now.AddDate(0, 0, -i)
		dateStr := date.Format("2006-01-02")

		// Get views for this date from the database
		viewsForDate, err := h.db.GetViewsForDate(dateStr)
		if err != nil {
			h.logger.Error("Failed to get views for date", map[string]interface{}{
				"error": err.Error(),
				"date":  dateStr,
			})
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		views[29-i] = models.ViewsData{
			Date:  dateStr,
			Views: viewsForDate,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(views)
}

func (h *Handler) GetCountryViews(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	countryViews, err := h.db.GetCountryViews()
	if err != nil {
		h.logger.Error("Failed to get country views", map[string]interface{}{
			"error": err.Error(),
		})
		json.NewEncoder(w).Encode([]map[string]interface{}{})
		return
	}

	if countryViews == nil {
		countryViews = []models.CountryViews{}
	}

	// Format response to match frontend type
	response := make([]map[string]interface{}, len(countryViews))
	for i, cv := range countryViews {
		response[i] = map[string]interface{}{
			"country":    cv.Country,
			"code":       cv.Code,
			"views":      cv.Views,
			"percentage": cv.Percentage,
		}
	}

	json.NewEncoder(w).Encode(response)
}

func (h *Handler) GetImageById(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get image ID from path
	path := strings.TrimPrefix(r.URL.Path, "/api/stats/")
	id, err := strconv.ParseInt(path, 10, 64)
	if err != nil {
		http.Error(w, "Invalid image ID", http.StatusBadRequest)
		return
	}

	// Get image from database
	image, err := h.db.GetImageByID(id)
	if err != nil {
		h.logger.Error("Failed to get image: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if image == nil {
		http.Error(w, "Image not found", http.StatusNotFound)
		return
	}

	// Create base URL
	baseURL := fmt.Sprintf("/%s.%s", image.UUID, image.Extension)

	// Add private key to URL if image is private
	url := baseURL
	if image.IsPrivate && image.PrivateKey != "" {
		url = fmt.Sprintf("%s?key=%s", baseURL, base64.StdEncoding.EncodeToString([]byte(image.PrivateKey)))
	}

	// Format the date
	formattedDate := image.UploadedAt.Format("2006-01-02T15:04:05")

	// Return image with URL
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":         image.ID,
		"uuid":       image.UUID,
		"filename":   image.Filename,
		"extension":  image.Extension,
		"size":       image.Size,
		"uploadedAt": formattedDate,
		"isPrivate":  image.IsPrivate,
		"privateKey": image.PrivateKey,
		"views":      image.Views,
		"url":        url,
	})
}

func (h *Handler) GetConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.config == nil {
		h.logger.Error("Invalid config structure", map[string]interface{}{
			"error": "config is nil",
		})
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"enable_ip_tracking": h.config.App.EnableIPTracking,
		"max_file_size":      h.config.App.MaxFileSize,
	})
}

func (h *Handler) GetRecentViews(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	views, err := h.db.GetAllRecentViews()
	if err != nil {
		h.logger.Error("Failed to get recent views", map[string]interface{}{
			"error": err.Error(),
		})
		json.NewEncoder(w).Encode(map[string]interface{}{
			"views": []struct{}{},
		})
		return
	}

	// Format views with string dates
	formattedViews := make([]map[string]interface{}, len(views))
	for i, v := range views {
		countryCode := v.Country
		countryName := "Unknown"

		// Convert country code to country name using CountryCodeMap
		for name, code := range CountryCodeMap {
			if strings.EqualFold(code, countryCode) {
				countryName = name
				break
			}
		}

		// If country code is empty or "unknown", use "Unknown" as country name
		if countryCode == "" || strings.EqualFold(countryCode, "unknown") {
			countryCode = "unknown"
			countryName = "Unknown"
		}

		formattedViews[i] = map[string]interface{}{
			"id":           v.ID,
			"imageId":      v.ImageID,
			"imageUuid":    v.ImageUUID,
			"ip":           v.IP,
			"country":      v.Country,
			"country_name": countryName,
			"country_code": strings.ToUpper(countryCode),
			"userAgent":    v.UserAgent,
			"viewedAt":     v.ViewedAt.UTC().Format(time.RFC3339),
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"views": formattedViews,
	})
}
