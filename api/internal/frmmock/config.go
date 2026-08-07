package frmmock

import (
	"errors"
	"fmt"
	"time"
)

// EpochProcess anchors elapsed time to process start, so every cycle in the
// world restarts from its beginning when the mock restarts.
const EpochProcess = "process"

// Config describes one immutable generation of the mock world. Content knobs are
// pointers: nil means "derive from the phase", which is the only way to be sure a
// default configuration is internally coherent.
type Config struct {
	Addr     string `json:"addr"`
	SaveName string `json:"saveName"`
	Seed     int64  `json:"seed"`
	Preset   string `json:"preset"`

	// Phase is the delivered Space Elevator phase, 1-5. It caps the tech tier and
	// therefore decides what may exist in the world at all.
	Phase int `json:"phase"`

	TickMs int `json:"tickMs"`

	// Epoch is EpochProcess or an RFC3339 timestamp. A fixed timestamp keeps a
	// long-lived demo continuous across restarts at the cost of an implausible
	// play duration.
	Epoch string `json:"epoch"`

	PlayDurationBaseSeconds int `json:"playDurationBaseSeconds"`

	Economy  EconomyConfig  `json:"economy"`
	World    WorldConfig    `json:"world"`
	Dynamics DynamicsConfig `json:"dynamics"`
}

// DynamicsConfig tunes the variation the mock exhibits over time. A nil
// FuseMeanPeriodSeconds takes the default; an explicit 0 disables fuse trips.
type DynamicsConfig struct {
	FuseMeanPeriodSeconds *int  `json:"fuseMeanPeriodSeconds"`
	Batteries             *bool `json:"batteries"`
}

// fuseMeanPeriod reports the configured mean seconds between fuse trips.
func (d DynamicsConfig) fuseMeanPeriod() float64 {
	if d.FuseMeanPeriodSeconds == nil {
		return 720
	}
	return float64(*d.FuseMeanPeriodSeconds)
}

// batteriesEnabled reports whether circuits may carry batteries.
func (d DynamicsConfig) batteriesEnabled() bool {
	return d.Batteries == nil || *d.Batteries
}

// EconomyConfig scales the factory. RawItemsPerMinute of 0 derives the scale from
// the preset.
type EconomyConfig struct {
	RawItemsPerMinute float64 `json:"rawItemsPerMinute"`
	PowerHeadroom     float64 `json:"powerHeadroom"`
}

// WorldConfig counts the things the world contains. A nil field is derived from
// the preset and phase; a set field that the phase cannot support is a validation
// error rather than something silently clamped.
type WorldConfig struct {
	Sites   *int `json:"sites"`
	Players *int `json:"players"`
}

var presets = map[string]Config{
	"starter": {
		Phase:   1,
		Economy: EconomyConfig{RawItemsPerMinute: 240, PowerHeadroom: 0.25},
		World:   WorldConfig{Sites: ptr(1), Players: ptr(1)},
	},
	"growing": {
		Phase:   2,
		Economy: EconomyConfig{RawItemsPerMinute: 1200, PowerHeadroom: 0.25},
		World:   WorldConfig{Sites: ptr(3), Players: ptr(2)},
	},
	"industrial": {
		Phase:   3,
		Economy: EconomyConfig{RawItemsPerMinute: 6000, PowerHeadroom: 0.25},
		World:   WorldConfig{Sites: ptr(6), Players: ptr(2)},
	},
	"megabase": {
		Phase:   5,
		Economy: EconomyConfig{RawItemsPerMinute: 30000, PowerHeadroom: 0.3},
		World:   WorldConfig{Sites: ptr(12), Players: ptr(3)},
	},
}

// PresetNames lists the known presets in increasing size.
var PresetNames = []string{"starter", "growing", "industrial", "megabase"}

// Preset returns a ready-to-serve config for a named preset. It panics on an
// unknown name, so a typo in a test fixture fails loudly rather than serving a
// silently different world.
func Preset(name string) Config {
	cfg, ok := presets[name]
	if !ok {
		panic(fmt.Sprintf("frmmock: unknown preset %q", name))
	}
	cfg.Preset = name
	cfg.applyDefaults()
	return cfg
}

// applyDefaults fills every field a caller may reasonably leave empty. It never
// overwrites a value the caller set.
func (c *Config) applyDefaults() {
	if c.Preset == "" {
		c.Preset = "industrial"
	}
	if base, ok := presets[c.Preset]; ok {
		if c.Phase == 0 {
			c.Phase = base.Phase
		}
		if c.Economy.RawItemsPerMinute == 0 {
			c.Economy.RawItemsPerMinute = base.Economy.RawItemsPerMinute
		}
		if c.Economy.PowerHeadroom == 0 {
			c.Economy.PowerHeadroom = base.Economy.PowerHeadroom
		}
		if c.World.Sites == nil {
			c.World.Sites = base.World.Sites
		}
		if c.World.Players == nil {
			c.World.Players = base.World.Players
		}
	}
	if c.Addr == "" {
		c.Addr = ":8080"
	}
	if c.SaveName == "" {
		c.SaveName = "FrmMock"
	}
	if c.Seed == 0 {
		c.Seed = 1
	}
	if c.TickMs == 0 {
		c.TickMs = 1000
	}
	if c.Epoch == "" {
		c.Epoch = EpochProcess
	}
	if c.PlayDurationBaseSeconds == 0 {
		c.PlayDurationBaseSeconds = 172800
	}
}

// Validate reports every problem at once rather than stopping at the first, so a
// single run tells the operator everything they need to change.
func (c *Config) Validate() error {
	var problems []error

	if c.SaveName == "" {
		// A session cannot be created against a server that reports no save name.
		problems = append(problems, errors.New("saveName must not be empty"))
	}
	if _, ok := presets[c.Preset]; !ok {
		problems = append(problems, fmt.Errorf("preset %q is unknown, want one of %v", c.Preset, PresetNames))
	}
	if c.Phase < 1 || c.Phase > 5 {
		problems = append(problems, fmt.Errorf("phase %d is out of range, want 1-5", c.Phase))
	}
	if c.TickMs < 50 || c.TickMs > 10000 {
		problems = append(problems, fmt.Errorf("tickMs %d is out of range, want 50-10000", c.TickMs))
	}
	if c.Epoch != EpochProcess {
		if _, err := time.Parse(time.RFC3339, c.Epoch); err != nil {
			problems = append(problems, fmt.Errorf("epoch %q is neither %q nor an RFC3339 timestamp", c.Epoch, EpochProcess))
		}
	}
	if c.Economy.RawItemsPerMinute <= 0 {
		problems = append(problems, fmt.Errorf("economy.rawItemsPerMinute must be positive, got %g", c.Economy.RawItemsPerMinute))
	}
	if c.Economy.PowerHeadroom < 0 {
		problems = append(problems, fmt.Errorf("economy.powerHeadroom must not be negative, got %g", c.Economy.PowerHeadroom))
	}
	if c.PlayDurationBaseSeconds < 0 {
		problems = append(problems, fmt.Errorf("playDurationBaseSeconds must not be negative, got %d", c.PlayDurationBaseSeconds))
	}
	if c.World.Sites != nil && *c.World.Sites < 1 {
		problems = append(problems, fmt.Errorf("world.sites must be at least 1, got %d", *c.World.Sites))
	}
	if c.World.Players != nil && *c.World.Players < 0 {
		problems = append(problems, fmt.Errorf("world.players must not be negative, got %d", *c.World.Players))
	}
	if c.Dynamics.FuseMeanPeriodSeconds != nil && *c.Dynamics.FuseMeanPeriodSeconds < 0 {
		problems = append(problems, fmt.Errorf("dynamics.fuseMeanPeriodSeconds must not be negative, got %d", *c.Dynamics.FuseMeanPeriodSeconds))
	}

	if len(problems) == 0 {
		return nil
	}
	return fmt.Errorf("frmmock: config is not coherent: %w", errors.Join(problems...))
}

func ptr[T any](v T) *T { return &v }
