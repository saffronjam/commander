package config

var (
	Config *Type
)

type Type struct {
	Port                  int    `json:"port"`
	Mode                  string `json:"mode"`
	ExternalURL           string `json:"externalUrl"`
	Filepath              string `json:"filepath"`
	DBPath                string `json:"dbPath"`
	AssetsDir             string `json:"assetsDir"`
	MaxSampleGameDuration int64  `json:"maxSampleGameDuration"`

	Auth struct {
		BootstrapPassword string
	}
}
