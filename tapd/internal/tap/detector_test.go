package tap

import (
	"testing"
	"time"
)

func TestDetectorEmitsTapAboveThreshold(t *testing.T) {
	detector := NewDetector(0.18, 300*time.Millisecond)
	now := time.Unix(100, 0)

	if _, ok := detector.Observe(Sample{X: 0, Y: 0, Z: 1}, now); ok {
		t.Fatal("first sample should establish the baseline")
	}

	event, ok := detector.Observe(Sample{X: 0.2, Y: 0.1, Z: 1.2}, now.Add(20*time.Millisecond))
	if !ok {
		t.Fatal("expected tap event")
	}

	if event.Magnitude <= 0.18 {
		t.Fatalf("expected magnitude over threshold, got %f", event.Magnitude)
	}
}

func TestDetectorAppliesCooldown(t *testing.T) {
	detector := NewDetector(0.1, 300*time.Millisecond)
	now := time.Unix(100, 0)

	detector.Observe(Sample{X: 0, Y: 0, Z: 1}, now)
	if _, ok := detector.Observe(Sample{X: 0.2, Y: 0, Z: 1}, now.Add(20*time.Millisecond)); !ok {
		t.Fatal("expected first tap")
	}

	if _, ok := detector.Observe(Sample{X: -0.2, Y: 0, Z: 1}, now.Add(80*time.Millisecond)); ok {
		t.Fatal("second tap should be suppressed during cooldown")
	}

	if _, ok := detector.Observe(Sample{X: 0.2, Y: 0, Z: 1}, now.Add(420*time.Millisecond)); !ok {
		t.Fatal("expected tap after cooldown")
	}
}
