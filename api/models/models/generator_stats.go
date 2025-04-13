package models

type PowerType string

const (
	PowerTypeBiomass    PowerType = "biomass"
	PowerTypeCoal       PowerType = "coal"
	PowerTypeFuel       PowerType = "fuel"
	PowerTypeGeothermal PowerType = "geothermal"
	PowerTypeNuclear    PowerType = "nuclear"
	PowerTypeUnknown    PowerType = "unknown"
)

type PowerSource struct {
	Count           int     `json:"count"`
	TotalProduction float64 `json:"totalProduction"`
}

type GeneratorStats struct {
	Sources  map[PowerType]PowerSource `json:"sources"`
	Machines []Machine                 `json:"machines"`
}

func (generatorStats *GeneratorStats) ToDTO() GeneratorStatsDTO {
	return *generatorStats
}
