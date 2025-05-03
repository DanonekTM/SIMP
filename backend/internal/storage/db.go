package storage

import (
	"database/sql"
	"time"

	"sharex/internal/models"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	*sql.DB
}

func NewDB(dbPath string) (*DB, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	if err := initSchema(db); err != nil {
		return nil, err
	}

	return &DB{db}, nil
}

func initSchema(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS images (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		uuid TEXT UNIQUE NOT NULL,
		filename TEXT NOT NULL,
		extension TEXT NOT NULL,
		size INTEGER NOT NULL,
		uploaded_at DATETIME NOT NULL,
		is_private BOOLEAN NOT NULL DEFAULT 0,
		private_key TEXT,
		views INTEGER NOT NULL DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS image_views (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		image_id INTEGER NOT NULL,
		ip TEXT NOT NULL,
		country TEXT,
		user_agent TEXT,
		viewed_at DATETIME NOT NULL,
		FOREIGN KEY (image_id) REFERENCES images(id)
	);
	`

	_, err := db.Exec(schema)
	return err
}

func (db *DB) CreateUser(username, password string) error {
	query := `INSERT INTO users (username, password) VALUES (?, ?)`
	_, err := db.Exec(query, username, password)
	return err
}

func (db *DB) GetUser(username string) (*models.User, error) {
	query := `SELECT id, username, password FROM users WHERE username = ?`
	user := &models.User{}
	err := db.QueryRow(query, username).Scan(&user.ID, &user.Username, &user.Password)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (db *DB) CreateImage(image *models.Image) error {
	query := `
		INSERT INTO images (uuid, filename, extension, size, uploaded_at, is_private, private_key)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`
	result, err := db.Exec(query,
		image.UUID,
		image.Filename,
		image.Extension,
		image.Size,
		image.UploadedAt,
		image.IsPrivate,
		image.PrivateKey,
	)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	image.ID = id
	return nil
}

func (db *DB) GetImage(uuid string) (*models.Image, error) {
	query := `
		SELECT id, uuid, filename, extension, size, uploaded_at, is_private, private_key, views
		FROM images WHERE uuid = ?
	`
	image := &models.Image{}
	err := db.QueryRow(query, uuid).Scan(
		&image.ID,
		&image.UUID,
		&image.Filename,
		&image.Extension,
		&image.Size,
		&image.UploadedAt,
		&image.IsPrivate,
		&image.PrivateKey,
		&image.Views,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return image, err
}

func (db *DB) DeleteImage(uuid string) error {
	query := `DELETE FROM images WHERE uuid = ?`
	_, err := db.Exec(query, uuid)
	return err
}

func (db *DB) AddImageView(imageID int64, ip, country, userAgent string) error {
	query := `
		INSERT INTO image_views (image_id, ip, country, user_agent, viewed_at)
		VALUES (?, ?, ?, ?, ?)
	`
	_, err := db.Exec(query, imageID, ip, country, userAgent, time.Now())
	if err != nil {
		return err
	}

	// Update view count
	query = `UPDATE images SET views = views + 1 WHERE id = ?`
	_, err = db.Exec(query, imageID)
	return err
}

func (db *DB) GetImageViews(imageID int64) ([]models.ImageView, error) {
	query := `
		SELECT id, image_id, ip, country, user_agent, viewed_at
		FROM image_views
		WHERE image_id = ?
		ORDER BY viewed_at DESC
	`
	rows, err := db.Query(query, imageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var views []models.ImageView
	for rows.Next() {
		var view models.ImageView
		err := rows.Scan(
			&view.ID,
			&view.ImageID,
			&view.IP,
			&view.Country,
			&view.UserAgent,
			&view.ViewedAt,
		)
		if err != nil {
			return nil, err
		}
		views = append(views, view)
	}
	return views, rows.Err()
}

func (db *DB) ListImages(imageType, dateFrom, dateTo string) ([]models.Image, error) {
	query := `
		SELECT id, uuid, filename, extension, size, uploaded_at, is_private, private_key, views
		FROM images
		WHERE 1=1
	`
	args := []interface{}{}

	if imageType != "" && imageType != "all" {
		if imageType == "image" {
			// For "image" type, include all image extensions except gif
			query += " AND extension != 'gif'"
		} else {
			// For specific types like "gif", match the extension
			query += " AND extension = ?"
			args = append(args, imageType)
		}
	}

	if dateFrom != "" {
		query += " AND uploaded_at >= ?"
		args = append(args, dateFrom)
	}

	if dateTo != "" {
		query += " AND uploaded_at <= ?"
		// Add one day to include the entire end date
		endDate, err := time.Parse("2006-01-02", dateTo)
		if err == nil {
			endDate = endDate.AddDate(0, 0, 1)
			args = append(args, endDate.Format("2006-01-02"))
		} else {
			args = append(args, dateTo)
		}
	}

	query += " ORDER BY uploaded_at DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var images []models.Image
	for rows.Next() {
		var image models.Image
		err := rows.Scan(
			&image.ID,
			&image.UUID,
			&image.Filename,
			&image.Extension,
			&image.Size,
			&image.UploadedAt,
			&image.IsPrivate,
			&image.PrivateKey,
			&image.Views,
		)
		if err != nil {
			return nil, err
		}
		images = append(images, image)
	}
	return images, rows.Err()
}

func (db *DB) UpdateImage(image *models.Image) error {
	query := `
		UPDATE images
		SET is_private = ?, private_key = ?
		WHERE uuid = ?
	`
	_, err := db.Exec(query, image.IsPrivate, image.PrivateKey, image.UUID)
	return err
}

func (db *DB) GetImageByID(id int64) (*models.Image, error) {
	query := `
		SELECT id, uuid, filename, extension, size, uploaded_at, is_private, private_key, views
		FROM images WHERE id = ?
	`
	image := &models.Image{}
	err := db.QueryRow(query, id).Scan(
		&image.ID,
		&image.UUID,
		&image.Filename,
		&image.Extension,
		&image.Size,
		&image.UploadedAt,
		&image.IsPrivate,
		&image.PrivateKey,
		&image.Views,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return image, err
}

func (db *DB) DeleteImageByID(id int64) error {
	// First delete all views
	query := `DELETE FROM image_views WHERE image_id = ?`
	_, err := db.Exec(query, id)
	if err != nil {
		return err
	}

	// Then delete the image
	query = `DELETE FROM images WHERE id = ?`
	_, err = db.Exec(query, id)
	return err
}

func (db *DB) GetViewsForDate(date string) (int64, error) {
	query := `
		SELECT COUNT(*) 
		FROM image_views 
		WHERE DATE(viewed_at) = ?
	`
	var count int64
	err := db.QueryRow(query, date).Scan(&count)
	return count, err
}

func (db *DB) GetCountryViews() ([]models.CountryViews, error) {
	query := `
		SELECT 
			country,
			COUNT(*) as views
		FROM image_views
		WHERE country IS NOT NULL
		GROUP BY country
		ORDER BY views DESC
		LIMIT 10
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var countryViews []models.CountryViews
	var totalViews int64

	// First pass: collect all views
	for rows.Next() {
		var country string
		var views int64
		if err := rows.Scan(&country, &views); err != nil {
			return nil, err
		}
		totalViews += views
		countryViews = append(countryViews, models.CountryViews{
			Country: country,
			Views:   views,
		})
	}

	// Second pass: calculate percentages
	for i := range countryViews {
		countryViews[i].Percentage = float64(countryViews[i].Views) / float64(totalViews) * 100
	}

	return countryViews, rows.Err()
}

func (db *DB) GetAllRecentViews() ([]models.RecentView, error) {
	query := `
		SELECT iv.id, iv.image_id, i.uuid, iv.ip, iv.country, iv.user_agent, iv.viewed_at
		FROM image_views iv
		JOIN images i ON iv.image_id = i.id
		ORDER BY viewed_at DESC
		LIMIT 10
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var views []models.RecentView
	for rows.Next() {
		var view models.RecentView
		err := rows.Scan(
			&view.ID,
			&view.ImageID,
			&view.ImageUUID,
			&view.IP,
			&view.Country,
			&view.UserAgent,
			&view.ViewedAt,
		)
		if err != nil {
			return nil, err
		}
		views = append(views, view)
	}

	return views, rows.Err()
}

func (db *DB) GetTotalRecentViewsCount() (int64, error) {
	var count int64
	err := db.QueryRow("SELECT COUNT(*) FROM image_views").Scan(&count)
	return count, err
}

// GetDashboardStats returns the total number of images, private images, and total views
func (db *DB) GetDashboardStats() (int64, int64, int64, error) {
	var totalImages, privateImages, totalViews int64

	// Get total images
	err := db.QueryRow("SELECT COUNT(*) FROM images").Scan(&totalImages)
	if err != nil {
		return 0, 0, 0, err
	}

	// Get private images
	err = db.QueryRow("SELECT COUNT(*) FROM images WHERE is_private = 1").Scan(&privateImages)
	if err != nil {
		return 0, 0, 0, err
	}

	// Get total views with COALESCE to handle NULL
	err = db.QueryRow("SELECT COALESCE(SUM(views), 0) FROM images").Scan(&totalViews)
	if err != nil {
		return 0, 0, 0, err
	}

	return totalImages, privateImages, totalViews, nil
}

// GetTotalImagesCount returns the total number of images matching the filters
func (db *DB) GetTotalImagesCount(imageType, dateFrom, dateTo string) (int64, error) {
	query := "SELECT COUNT(*) FROM images WHERE 1=1"
	args := []interface{}{}

	if imageType != "" && imageType != "all" {
		query += " AND extension = ?"
		args = append(args, imageType)
	}

	if dateFrom != "" {
		query += " AND uploaded_at >= ?"
		args = append(args, dateFrom)
	}

	if dateTo != "" {
		query += " AND uploaded_at <= ?"
		args = append(args, dateTo)
	}

	var count int64
	err := db.QueryRow(query, args...).Scan(&count)
	return count, err
}
