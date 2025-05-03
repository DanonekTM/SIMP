package utils

import (
	"archive/tar"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/dsnet/compress/bzip2"
)

type LogRotator struct {
	logDir       string
	maxLogSize   int64
	maxLogAge    int
	compressLogs bool
	bufferSize   int // Buffer size in bytes
}

func NewLogRotator(logDir string, maxLogSize int64, maxLogAge int, compressLogs bool) *LogRotator {
	return &LogRotator{
		logDir:       logDir,
		maxLogSize:   maxLogSize,
		maxLogAge:    maxLogAge,
		compressLogs: compressLogs,
		bufferSize:   8 * 1024, // Default to 8KB to avoid tar block size issues
	}
}

// SetBufferSize allows configuring the buffer size for log rotation
func (r *LogRotator) SetBufferSize(size int) {
	if size < 1024 { // Minimum 1KB
		size = 1024
	}
	if size > 32*1024 { // Maximum 32KB to avoid tar block size issues
		size = 32 * 1024
	}
	r.bufferSize = size
}

func (r *LogRotator) RotateIfNeeded(filePath string) error {
	// Check if file exists
	info, err := os.Stat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // File doesn't exist yet, no rotation needed
		}
		return fmt.Errorf("failed to stat log file: %w", err)
	}

	// Check file size
	if info.Size() < r.maxLogSize {
		return nil // File size is within limits
	}

	// Generate timestamp for the archive
	timestamp := time.Now().Format("2006-01-02-15-04-05")

	// Get the log type from the filename (debug, error, warn, info)
	base := filepath.Base(filePath)
	logType := base[:len(base)-len(filepath.Ext(base))] // Remove .log extension

	// Create archives directory if it doesn't exist
	archivesDir := filepath.Join(r.logDir, "archives")
	if err := os.MkdirAll(archivesDir, 0755); err != nil {
		return fmt.Errorf("failed to create archives directory: %w", err)
	}

	// Create the compressed archive path
	archivePath := filepath.Join(archivesDir, fmt.Sprintf("%s-%s.tar.bz2", logType, timestamp))

	// Open the current log file for reading
	currentFile, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open current log file: %w", err)
	}
	defer currentFile.Close()

	// Create the compressed archive file
	archiveFile, err := os.Create(archivePath)
	if err != nil {
		return fmt.Errorf("failed to create archive file: %w", err)
	}
	defer archiveFile.Close()

	// Create bzip2 writer
	bzipConfig := &bzip2.WriterConfig{
		Level: bzip2.BestCompression,
	}
	bzipWriter, err := bzip2.NewWriter(archiveFile, bzipConfig)
	if err != nil {
		return fmt.Errorf("failed to create bzip2 writer: %w", err)
	}
	defer bzipWriter.Close()

	// Create tar writer
	tarWriter := tar.NewWriter(bzipWriter)
	defer tarWriter.Close()

	// Get file info for the tar header
	fileInfo, err := currentFile.Stat()
	if err != nil {
		return fmt.Errorf("failed to get file info: %w", err)
	}

	// Create tar header
	header := &tar.Header{
		Name:    base,
		Size:    fileInfo.Size(),
		Mode:    int64(fileInfo.Mode()),
		ModTime: fileInfo.ModTime(),
	}

	// Write tar header
	if err := tarWriter.WriteHeader(header); err != nil {
		return fmt.Errorf("failed to write tar header: %w", err)
	}

	// Use a buffer to read and write in chunks
	buffer := make([]byte, r.bufferSize)
	for {
		n, err := currentFile.Read(buffer)
		if err != nil && err != io.EOF {
			return fmt.Errorf("failed to read from log file: %w", err)
		}
		if n > 0 {
			// Write in smaller chunks to avoid tar block size issues
			chunkSize := 512 // Standard tar block size
			for i := 0; i < n; i += chunkSize {
				end := i + chunkSize
				if end > n {
					end = n
				}
				if _, err := tarWriter.Write(buffer[i:end]); err != nil {
					return fmt.Errorf("failed to write to tar archive: %w", err)
				}
			}
		}
		if err == io.EOF {
			break
		}
	}

	// Close all writers to ensure data is flushed
	if err := tarWriter.Close(); err != nil {
		return fmt.Errorf("failed to close tar writer: %w", err)
	}
	if err := bzipWriter.Close(); err != nil {
		return fmt.Errorf("failed to close bzip2 writer: %w", err)
	}
	if err := archiveFile.Close(); err != nil {
		return fmt.Errorf("failed to close archive file: %w", err)
	}

	// Close the current file before removing it
	currentFile.Close()

	// Remove the original file
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("failed to remove original log file: %w", err)
	}

	// Create new empty log file
	if _, err := os.Create(filePath); err != nil {
		return fmt.Errorf("failed to create new log file: %w", err)
	}

	// Cleanup old archives
	return r.CleanupOldArchives()
}

func (r *LogRotator) CleanupOldArchives() error {
	// Get all files in the log directory and archives directory
	archivesDir := filepath.Join(r.logDir, "archives")

	// Clean up main log directory
	if err := r.cleanupDirectory(r.logDir); err != nil {
		return err
	}

	// Clean up archives directory if it exists
	if _, err := os.Stat(archivesDir); err == nil {
		if err := r.cleanupDirectory(archivesDir); err != nil {
			return err
		}
	}

	return nil
}

func (r *LogRotator) cleanupDirectory(dir string) error {
	files, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("failed to read directory %s: %w", dir, err)
	}

	// Calculate cutoff time
	cutoff := time.Now().AddDate(0, 0, -r.maxLogAge)

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// Get file info
		info, err := file.Info()
		if err != nil {
			continue
		}

		// Check if file is older than max age
		if info.ModTime().Before(cutoff) {
			filePath := filepath.Join(dir, file.Name())
			if err := os.Remove(filePath); err != nil {
				return fmt.Errorf("failed to remove old file %s: %w", filePath, err)
			}
		}
	}

	return nil
}
