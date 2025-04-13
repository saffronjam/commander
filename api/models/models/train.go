package models

type TrainType string

const (
	TrainTypeFreight    TrainType = "freight"
	TrainTypeLocomotive TrainType = "locomotive"
)

type TrainStatus string

const (
	TrainStatusSelfDriving   TrainStatus = "selfDriving"
	TrainStatusManualDriving TrainStatus = "manualDriving"
	TrainStatusParked        TrainStatus = "parked"
	TrainStatusDocking       TrainStatus = "docking"
	TrainStatusDerailed      TrainStatus = "derailed"
	TrainStatusUnknown       TrainStatus = "unknown"
)

type TrainVehicle struct {
	Type      TrainType   `json:"type"`
	Capacity  float64     `json:"capacity"`
	Inventory []ItemStats `json:"inventory"`
}

type TrainTimetableEntry struct {
	Station string `json:"station"`
}

type Train struct {
	Name             string                `json:"name"`
	Speed            float64               `json:"speed"`
	Status           TrainStatus           `json:"status"`
	PowerConsumption float64               `json:"powerConsumption"`
	Vehicles         []TrainVehicle        `json:"vehicles"`
	Timetable        []TrainTimetableEntry `json:"timetable"`
	TimetableIndex   int                   `json:"timetableIndex"`
	Location         `json:",inline" tstype:",extends"`
}

func (train *Train) ToDTO() TrainDTO {
	return *train
}
