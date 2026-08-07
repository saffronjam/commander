package frmmock

import "time"

// Clock is the only seam between the mock and wall time. Tests substitute a fixed
// clock so a snapshot can be asserted without sleeping.
type Clock interface {
	Now() time.Time
}

type systemClock struct{}

func (systemClock) Now() time.Time { return time.Now() }

// FixedClock reports one instant forever. Advance moves it deliberately.
type FixedClock struct {
	At time.Time
}

// Now reports the fixed instant.
func (c *FixedClock) Now() time.Time { return c.At }

// Advance moves the clock forward.
func (c *FixedClock) Advance(d time.Duration) { c.At = c.At.Add(d) }
