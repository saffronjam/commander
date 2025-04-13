package models

type State struct {
	SatisfactoryApiStatus SatisfactoryApiStatus `json:"satisfactoryApiStatus"`

	FactoryStats   FactoryStats   `json:"factoryStats"`
	ProdStats      ProdStats      `json:"prodStats"`
	GeneratorStats GeneratorStats `json:"generatorStats"`
	SinkStats      SinkStats      `json:"sinkStats"`

	Circuits      []Circuit      `json:"circuits"`
	Players       []Player       `json:"players"`
	Drones        []Drone        `json:"drones"`
	Trains        []Train        `json:"trains"`
	TrainStations []TrainStation `json:"trainStations"`
	DroneStations []DroneStation `json:"droneStations"`
}

func (state *State) ToDTO() StateDTO {
	return *state
}
