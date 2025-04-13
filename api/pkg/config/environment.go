package config

import (
	"fmt"
	"os"
	"sigs.k8s.io/yaml"
)

func SetupEnvironment(appMode string) error {
	makeError := func(err error) error {
		return fmt.Errorf("failed to set up environment. details: %w", err)
	}

	filepath, ok := os.LookupEnv("COMMANDER_API_CONFIG_FILE")
	if !ok || filepath == "" {
		filepath = "config.local.yml"
	}

	yamlFile, err := os.ReadFile(filepath)
	if err != nil {
		return makeError(err)
	}

	err = yaml.Unmarshal(yamlFile, &Config)
	if err != nil {
		return makeError(err)
	}

	Config.Mode = appMode
	Config.Filepath = filepath

	return nil
}
