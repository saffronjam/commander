package models

type SatisfactoryApiStatusDTO = SatisfactoryApiStatus
type CircuitDTO = Circuit
type DroneDTO = Drone
type DroneStationDTO = DroneStation
type FactoryStatsDTO = FactoryStats
type GeneratorStatsDTO = GeneratorStats
type MachineDTO = Machine
type MachineProdStatsDTO = MachineProdStats
type PlayerDTO = Player
type ProdStatsDTO = ProdStats
type SinkStatsDTO = SinkStats
type TrainDTO = Train
type TrainStationDTO = TrainStation
type StateDTO = State

type TrainSetupDTO struct {
	Trains        []TrainDTO        `json:"trains"`
	TrainStations []TrainStationDTO `json:"trainStations"`
}

type DroneSetupDTO struct {
	Drones        []DroneDTO        `json:"drones"`
	DroneStations []DroneStationDTO `json:"droneStations"`
}
