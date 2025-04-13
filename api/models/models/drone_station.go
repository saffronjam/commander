package models

type DroneStation struct {
	Name     string  `json:"name"`
	FuelName *string `json:"fuelName,omitempty"`
	Location `json:",inline" tstype:",extends"`
}

func (droneStation *DroneStation) ToDTO() DroneStationDTO {
	return *droneStation
}
