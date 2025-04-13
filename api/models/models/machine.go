package models

type MachineType string

const (
	MachineTypeAssembler           MachineType = "assembler"
	MachineTypeConstructor         MachineType = "constructor"
	MachineTypeFoundry             MachineType = "foundry"
	MachineTypeManufacturer        MachineType = "manufacturer"
	MachineTypeRefinery            MachineType = "refinery"
	MachineTypeSmelter             MachineType = "smelter"
	MachineTypeBlender             MachineType = "blender"
	MachineTypePackager            MachineType = "packager"
	MachineTypeParticleAccelerator MachineType = "particleAccelerator"

	MachineTypeMiner          MachineType = "miner"
	MachineTypeOilExtractor   MachineType = "oilExtractor"
	MachineTypeWaterExtractor MachineType = "waterExtractor"

	MachineTypeBiomassBurner       MachineType = "biomassBurner"
	MachineTypeCoalGenerator       MachineType = "coalGenerator"
	MachineTypeFuelGenerator       MachineType = "fuelGenerator"
	MachineTypeGeothermalGenerator MachineType = "geothermalGenerator"
	MachineTypeNuclearPowerPlant   MachineType = "nuclearPowerPlant"
)

type MachineCategory string

const (
	MachineCategoryFactory   MachineCategory = "factory"
	MachineCategoryExtractor MachineCategory = "extractor"
	MachineCategoryGenerator MachineCategory = "generator"
)

type MachineStatus string

const (
	MachineStatusOperating    MachineStatus = "operating"
	MachineStatusIdle         MachineStatus = "idle"
	MachineStatusPaused       MachineStatus = "paused"
	MachineStatusUnconfigured MachineStatus = "unconfigured"
	MachineStatusUnknown      MachineStatus = "unknown"
)

type MachineProdStats struct {
	Name       string  `json:"name"`
	Stored     float64 `json:"stored"`
	Current    float64 `json:"current"`
	Max        float64 `json:"max"`
	Efficiency float64 `json:"efficiency"`
}

type Machine struct {
	Type     MachineType        `json:"type"`
	Status   MachineStatus      `json:"status"`
	Category MachineCategory    `json:"category"`
	Input    []MachineProdStats `json:"input"`
	Output   []MachineProdStats `json:"output"`
	Location `json:",inline" tstype:",extends"`
}

func (machine *Machine) ToDTO() MachineDTO {
	return *machine
}
