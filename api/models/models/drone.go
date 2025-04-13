package models

type DroneStatus string

const (
	DroneStatusIdle    DroneStatus = "idle"
	DroneStatusFlying  DroneStatus = "flying"
	DroneStatusDocking DroneStatus = "docking"
)

type Drone struct {
	Name        string        `json:"name"`
	Speed       float64       `json:"speed"`
	Status      DroneStatus   `json:"status"`
	Home        DroneStation  `json:"home"`
	Paired      *DroneStation `json:"paired,omitempty"`
	Destination *DroneStation `json:"destination,omitempty"`
	*Location   `json:",inline,omitempty" tstype:",extends"`
}

func (drone *Drone) ToDTO() DroneDTO {
	return *drone
}
