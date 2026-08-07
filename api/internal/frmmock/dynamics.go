package frmmock

import (
	"fmt"
	"math"
)

// dayCycleSeconds is the length of one Satisfactory day: 45 minutes of daylight
// followed by 5 of night.
const (
	dayLengthSeconds   = 2700
	nightLengthSeconds = 300
	dayCycleSeconds    = dayLengthSeconds + nightLengthSeconds
)

// tri is a triangle wave over [0,1) returning [0,1]. Buffers fill and drain
// linearly, so a triangle is the honest shape; a sine would imply an easing that
// belts do not have.
func tri(x float64) float64 {
	x = x - math.Floor(x)
	if x < 0.5 {
		return 2 * x
	}
	return 2 * (1 - x)
}

// bufferPeriodSeconds is how long a machine's input buffer takes to fill and
// drain once. Staggering machines by phase is what makes an aggregate production
// figure wobble instead of sitting still.
const bufferPeriodSeconds = 96

// bufferLevel reports a machine's input buffer fullness in [0,1] at t seconds.
func bufferLevel(m Machine, t float64) float64 {
	return tri(t/bufferPeriodSeconds + m.Phase)
}

// efficiency reports a machine's instantaneous output fraction in [0,1]. A running
// machine dips only when its input buffer bottoms out, which is what a real
// starved machine does.
func efficiency(m Machine, t float64) float64 {
	switch m.Health {
	case HealthPaused, HealthUnconfigured:
		return 0
	case HealthIdle:
		return 0
	}
	const starveThreshold = 0.18
	level := bufferLevel(m, t)
	if level >= starveThreshold {
		return 1
	}
	return level / starveThreshold
}

// isProducing reports whether a machine counts as producing right now.
func isProducing(m Machine, t float64) bool {
	return efficiency(m, t) > 0
}

// fuseWindowSeconds is how long a tripped fuse stays tripped.
const fuseWindowSeconds = 45

// fuseTripped reports whether a circuit's fuse is currently blown. The schedule is
// derived from the seed so a demo replays identically, and a trip is the most
// visible legitimate dip a power chart can show.
func fuseTripped(seed int64, c Circuit, t float64, meanPeriod float64) bool {
	if meanPeriod <= 0 {
		return false
	}
	window := math.Floor(t / meanPeriod)
	s := derive(seed, "fuse", c.ID*100003+int(window))
	if s.float() > 0.25 {
		return false
	}
	offset := s.between(0, meanPeriod-fuseWindowSeconds)
	within := t - window*meanPeriod
	return within >= offset && within < offset+fuseWindowSeconds
}

// geothermalFactor is the output fraction of a geothermal generator, the only
// generator in the game whose production genuinely varies on its own.
func geothermalFactor(t, phase float64) float64 {
	const period = 240
	return 0.55 + 0.45*math.Sin(2*math.Pi*(t/period+phase))
}

// batteryState reports a circuit's charge percentage and its charge or discharge
// rate in MW. A tripped fuse discharges the battery, which is what produces the
// visible transient the dashboard charts.
func batteryState(seed int64, c Circuit, t float64, tripped bool) (percent, differentialMW float64) {
	if !c.HasBattery {
		return 0, 0
	}
	const period = 600
	base := 45 + 40*tri(t/period+c.FusePhase)
	if tripped {
		return math.Max(0, base-25), -c.ConsumptionMW
	}
	surplus := c.CapacityMW - c.ConsumptionMW
	return base, quantise(math.Min(surplus, c.CapacityMW*0.1), 3)
}

// hhmmss formats a duration in seconds the way FRM does. The client parses these
// by splitting on colons, so the layout matters more than the precision.
func hhmmss(seconds float64) string {
	if seconds <= 0 || math.IsInf(seconds, 0) || math.IsNaN(seconds) {
		return "00:00:00"
	}
	total := int(seconds)
	return fmt.Sprintf("%02d:%02d:%02d", total/3600, (total%3600)/60, total%60)
}

// gameClock maps elapsed seconds onto the in-game clock.
func gameClock(t float64) (hours, minutes int, seconds float64, isDay bool, passedDays int) {
	within := math.Mod(t, dayCycleSeconds)
	if within < 0 {
		within += dayCycleSeconds
	}
	frac := within / dayCycleSeconds
	totalMinutes := frac * 24 * 60
	hours = int(totalMinutes) / 60
	minutes = int(totalMinutes) % 60
	seconds = quantise(math.Mod(totalMinutes*60, 60), 2)
	isDay = within < dayLengthSeconds
	passedDays = int(t / dayCycleSeconds)
	return hours, minutes, seconds, isDay, passedDays
}

// stockAt reports an item's world inventory at t seconds. Only items with a
// positive drift move, so nothing ever has to be clamped.
func stockAt(f ItemFlow, t float64) float64 {
	return f.StockBase + f.DriftPM*t/60
}

// sinkTotalAt reports the AWESOME Sink point total at t seconds.
func sinkTotalAt(w *World, t float64) float64 {
	return w.pointsPerMinute() * t / 60
}
