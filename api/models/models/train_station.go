package models

type TrainStation struct {
	Name     string `json:"name"`
	Location `json:",inline" tstype:",extends"`
}

func (trainStation *TrainStation) ToDTO() TrainStationDTO {
	return *trainStation
}
