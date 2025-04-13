package models

type CircuitConsumption struct {
	Total float64 `json:"total"`
	Max   float64 `json:"max"`
}

type CircuitProduction struct {
	Total float64 `json:"total"`
}

type CircuitCapacity struct {
	Total float64 `json:"total"`
}

type CircuitBattery struct {
	Percentage   float64 `json:"percentage"`
	Capacity     float64 `json:"capacity"`
	Differential float64 `json:"differential"`
	UntilFull    float64 `json:"untilFull"`  // parsed from 00:00:00 to float64
	UntilEmpty   float64 `json:"untilEmpty"` // parsed from 00:00:00 to float64
}

type Circuit struct {
	ID            string `json:"id"`
	FuseTriggered bool   `json:"fuseTriggered"`

	Consumption CircuitConsumption `json:"consumption"`
	Production  CircuitProduction  `json:"production"`
	Capacity    CircuitCapacity    `json:"capacity"`
	Battery     CircuitBattery     `json:"battery"`
}

func (circuit *Circuit) ToDTO() CircuitDTO {
	return *circuit
}
