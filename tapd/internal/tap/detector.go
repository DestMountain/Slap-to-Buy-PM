package tap

import (
	"math"
	"time"
)

type Sample struct {
	X float64
	Y float64
	Z float64
}

type Event struct {
	Timestamp time.Time
	Magnitude float64
}

type Detector struct {
	threshold float64
	cooldown  time.Duration
	lastTap   time.Time
	previous  *Sample
}

func NewDetector(threshold float64, cooldown time.Duration) *Detector {
	return &Detector{
		threshold: threshold,
		cooldown:  cooldown,
	}
}

func (d *Detector) Observe(sample Sample, now time.Time) (Event, bool) {
	if d.previous == nil {
		d.previous = &sample
		return Event{}, false
	}

	dx := sample.X - d.previous.X
	dy := sample.Y - d.previous.Y
	dz := sample.Z - d.previous.Z
	magnitude := math.Sqrt(dx*dx + dy*dy + dz*dz)
	d.previous = &sample

	if magnitude < d.threshold {
		return Event{}, false
	}

	if !d.lastTap.IsZero() && now.Sub(d.lastTap) < d.cooldown {
		return Event{}, false
	}

	d.lastTap = now
	return Event{Timestamp: now, Magnitude: magnitude}, true
}
