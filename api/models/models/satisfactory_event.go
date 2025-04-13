package models

type SatisfactoryEventType string

const (
	SatisfactoryEventApiStatus      SatisfactoryEventType = "satisfactoryApiCheck"
	SatisfactoryEventCircuits       SatisfactoryEventType = "circuits"
	SatisfactoryEventFactoryStats   SatisfactoryEventType = "factoryStats"
	SatisfactoryEventProdStats      SatisfactoryEventType = "prodStats"
	SatisfactoryEventSinkStats      SatisfactoryEventType = "sinkStats"
	SatisfactoryEventPlayers        SatisfactoryEventType = "players"
	SatisfactoryEventGeneratorStats SatisfactoryEventType = "generatorStats"
	SatisfactoryEventTrains         SatisfactoryEventType = "trains"
	SatisfactoryEventTrainStations  SatisfactoryEventType = "trainsStations"
	SatisfactoryEventTrainSetup     SatisfactoryEventType = "trainSetup"
	SatisfactoryEventDrones         SatisfactoryEventType = "drones"
	SatisfactoryEventDroneStations  SatisfactoryEventType = "droneStations"
	SatisfactoryEventDroneSetup     SatisfactoryEventType = "droneSetup"

	SatisfactoryEventKey string = "satisfactory_events"
)

type SatisfactoryEvent struct {
	Type SatisfactoryEventType `json:"type"`
	Data any                   `json:"data"`
}

type SseSatisfactoryEvent struct {
	SatisfactoryEvent `json:",inline" tstype:",extends"`
	ClientID          int64 `json:"clientId"`
}
