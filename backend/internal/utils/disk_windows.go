//go:build windows

package utils

import (
	"fmt"
	"syscall"
	"unsafe"
)

// GetDiskUsage returns the total and free disk space for the given path
func GetDiskUsage(path string, total *uint64, free *uint64) error {
	var freeBytesAvailable, totalBytes, totalFreeBytes uint64
	pathPtr, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return err
	}

	ret, _, err := syscall.NewLazyDLL("kernel32.dll").NewProc("GetDiskFreeSpaceExW").Call(
		uintptr(unsafe.Pointer(pathPtr)),
		uintptr(unsafe.Pointer(&freeBytesAvailable)),
		uintptr(unsafe.Pointer(&totalBytes)),
		uintptr(unsafe.Pointer(&totalFreeBytes)),
	)

	if ret == 0 {
		return fmt.Errorf("GetDiskFreeSpaceExW failed: %v", err)
	}

	*total = totalBytes
	*free = freeBytesAvailable
	return nil
}
