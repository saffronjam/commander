package models

type MachineEfficiency struct {
	MachinesOperating    int `json:"machinesOperating"`
	MachinesIdle         int `json:"machinesIdle"`
	MachinesPaused       int `json:"machinesPaused"`
	MachinesUnconfigured int `json:"machinesUnconfigured"`
}

type FactoryStats struct {
	TotalMachines int               `json:"totalMachines"`
	Efficiency    MachineEfficiency `json:"efficiency"`
	Machines      []Machine         `json:"machines"`
}

func (factoryStats *FactoryStats) ToDTO() FactoryStatsDTO {
	return *factoryStats
}
