//go:build !windows

package utils

import (
	"fmt"
	"syscall"
)

// GetDiskUsage returns the total and free disk space for the given path
func GetDiskUsage(path string, total *uint64, free *uint64) error {
	var stat syscall.Statfs_t
	err := syscall.Statfs(path, &stat)
	if err != nil {
		return fmt.Errorf("statfs failed: %v", err)
	}

	*total = uint64(stat.Blocks) * uint64(stat.Bsize)
	*free = uint64(stat.Bavail) * uint64(stat.Bsize)
	return nil
}
