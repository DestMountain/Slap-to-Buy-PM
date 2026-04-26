//go:build darwin && arm64

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/taigrr/apple-silicon-accelerometer/sensor"
	"github.com/taigrr/apple-silicon-accelerometer/shm"

	"spank-prediction/tapd/internal/tap"
)

type message map[string]any

func main() {
	if os.Geteuid() != 0 {
		write(message{
			"type":    "error",
			"message": "tapd must run as root because AppleSPUHIDDevice requires elevated IOKit access",
		})
		os.Exit(1)
	}

	accel, err := shm.CreateRing(shm.NameAccel)
	must(err)
	defer accel.Close()
	defer accel.Unlink()

	gyro, err := shm.CreateRing(shm.NameGyro)
	must(err)
	defer gyro.Close()
	defer gyro.Unlink()

	als, err := shm.CreateSnapshot(shm.NameALS, shm.ALSSize)
	must(err)
	defer als.Close()
	defer als.Unlink()

	lid, err := shm.CreateSnapshot(shm.NameLid, shm.LidSize)
	must(err)
	defer lid.Close()
	defer lid.Unlink()

	write(message{
		"type":     "status",
		"message":  "IMU ready.",
		"sensorId": "AppleSPUHIDDevice/Bosch-BMI286",
	})

	go streamTaps(accel)

	runtime.LockOSThread()
	err = sensor.Run(sensor.Config{
		AccelRing: accel,
		GyroRing:  gyro,
		ALSSnap:   als,
		LidSnap:   lid,
	})
	must(err)
}

func streamTaps(accel *shm.RingBuffer) {
	const (
		maxBatch      = 24
		warmupSamples = 100
	)

	detector := tap.NewDetector(0.30, 220*time.Millisecond)
	var lastTotal uint64
	var samplesSeen int
	ticker := time.NewTicker(12 * time.Millisecond)
	defer ticker.Stop()

	for now := range ticker.C {
		samples, nextTotal := accel.ReadNew(lastTotal, shm.AccelScale)
		lastTotal = nextTotal
		if len(samples) > maxBatch {
			samples = samples[len(samples)-maxBatch:]
		}

		for _, sample := range samples {
			if !validAccelSample(sample) {
				continue
			}

			event, ok := detector.Observe(tap.Sample{
				X: sample.X,
				Y: sample.Y,
				Z: sample.Z,
			}, now)
			samplesSeen++
			if samplesSeen <= warmupSamples {
				continue
			}

			if !ok {
				continue
			}

			write(message{
				"type":      "tap",
				"timestamp": event.Timestamp.UnixMilli(),
				"magnitude": event.Magnitude,
				"sensorId":  "AppleSPUHIDDevice/Bosch-BMI286",
			})
		}
	}
}

func validAccelSample(sample shm.Sample) bool {
	const maxAbsG = 16.0
	return abs(sample.X) <= maxAbsG && abs(sample.Y) <= maxAbsG && abs(sample.Z) <= maxAbsG
}

func abs(value float64) float64 {
	if value < 0 {
		return -value
	}
	return value
}

func must(err error) {
	if err == nil {
		return
	}

	write(message{
		"type":    "error",
		"message": err.Error(),
	})
	os.Exit(1)
}

func write(payload message) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		fmt.Fprintf(os.Stderr, "json encode failed: %v\n", err)
		return
	}

	fmt.Println(string(encoded))
}
