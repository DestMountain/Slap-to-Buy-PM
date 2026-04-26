//go:build !darwin || !arm64

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"runtime"
)

func main() {
	payload := map[string]any{
		"type":    "error",
		"message": fmt.Sprintf("unsupported platform %s/%s", runtime.GOOS, runtime.GOARCH),
	}
	encoded, _ := json.Marshal(payload)
	fmt.Println(string(encoded))
	os.Exit(1)
}
