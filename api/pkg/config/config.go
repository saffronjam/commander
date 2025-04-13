package config

var (
	Config *Type
)

type Type struct {
	Port        int    `json:"port"`
	Mode        string `json:"mode"`
	Mock        bool   `json:"mock"`
	ExternalURL string `json:"externalUrl"`
	Filepath    string `json:"filepath"`

	SatisfactoryAPI struct {
		URL string `json:"url"`
	} `json:"satisfactoryApi"`

	Redis struct {
		URL      string `json:"url"`
		Password string `json:"password,default=default"`
	}
}
