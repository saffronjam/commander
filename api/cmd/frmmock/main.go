// Command frmmock serves Ficsit Remote Monitoring shaped JSON for a generated
// factory, so the dashboard can be pointed at it exactly like a real game server.
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"sigs.k8s.io/yaml"

	"api/internal/frmmock"
)

func main() {
	var (
		configPath = flag.String("config", "", "path to a YAML config file")
		addr       = flag.String("addr", "", "listen address, overrides the config")
		preset     = flag.String("preset", "", fmt.Sprintf("world preset %v, overrides the config", frmmock.PresetNames))
		seed       = flag.Int64("seed", 0, "world seed, overrides the config")
		phase      = flag.Int("phase", 0, "delivered Space Elevator phase 1-5, overrides the config")
		saveName   = flag.String("save-name", "", "save name to report, overrides the config")
	)
	flag.Parse()

	cfg, err := loadConfig(*configPath)
	if err != nil {
		log.Fatalf("frmmock: %v", err)
	}

	applyFlag(addr, &cfg.Addr)
	applyFlag(preset, &cfg.Preset)
	applyFlag(saveName, &cfg.SaveName)
	if *seed != 0 {
		cfg.Seed = *seed
	}
	if *phase != 0 {
		cfg.Phase = *phase
	}

	if err := applyEnv(&cfg); err != nil {
		log.Fatalf("frmmock: %v", err)
	}

	srv, err := frmmock.NewServer(cfg)
	if err != nil {
		log.Fatalf("%v", err)
	}

	world := srv.World()
	log.Printf("frmmock: serving %q on %s", world.SaveName, srv.Config().Addr)
	log.Printf("frmmock: preset=%s phase=%d tier=%d seed=%d", srv.Config().Preset, world.Phase, world.MaxTier, world.Seed)
	log.Printf("frmmock: %d sites, %d machines, %d nodes, %d belts, %d circuits, %d players",
		len(world.Sites), len(world.Machines), len(world.Nodes), len(world.Belts), len(world.Circuits), len(world.Players))

	if err := http.ListenAndServe(srv.Config().Addr, srv.Handler()); err != nil {
		log.Fatalf("frmmock: %v", err)
	}
}

// loadConfig reads the YAML config if one was given, otherwise starts from the
// default preset.
func loadConfig(path string) (frmmock.Config, error) {
	if path == "" {
		if fromEnv := os.Getenv("SD_FRMMOCK_CONFIG_FILE"); fromEnv != "" {
			path = fromEnv
		}
	}
	if path == "" {
		return frmmock.Config{}, nil
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return frmmock.Config{}, fmt.Errorf("read config: %w", err)
	}
	var cfg frmmock.Config
	if err := yaml.Unmarshal(raw, &cfg); err != nil {
		return frmmock.Config{}, fmt.Errorf("parse config %s: %w", path, err)
	}
	return cfg, nil
}

// applyEnv layers SD_FRMMOCK_* overrides over the config, following the same
// explicit one-variable-per-knob style the server's own config uses.
func applyEnv(cfg *frmmock.Config) error {
	applyFlagFromEnv("SD_FRMMOCK_ADDR", &cfg.Addr)
	applyFlagFromEnv("SD_FRMMOCK_PRESET", &cfg.Preset)
	applyFlagFromEnv("SD_FRMMOCK_SAVE_NAME", &cfg.SaveName)
	applyFlagFromEnv("SD_FRMMOCK_EPOCH", &cfg.Epoch)

	if v := os.Getenv("SD_FRMMOCK_SEED"); v != "" {
		parsed, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return fmt.Errorf("invalid SD_FRMMOCK_SEED: %w", err)
		}
		cfg.Seed = parsed
	}
	if v := os.Getenv("SD_FRMMOCK_PHASE"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil {
			return fmt.Errorf("invalid SD_FRMMOCK_PHASE: %w", err)
		}
		cfg.Phase = parsed
	}
	if v := os.Getenv("SD_FRMMOCK_TICK_MS"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil {
			return fmt.Errorf("invalid SD_FRMMOCK_TICK_MS: %w", err)
		}
		cfg.TickMs = parsed
	}
	return nil
}

func applyFlag(from *string, to *string) {
	if from != nil && *from != "" {
		*to = *from
	}
}

func applyFlagFromEnv(name string, to *string) {
	if v := os.Getenv(name); v != "" {
		*to = v
	}
}
