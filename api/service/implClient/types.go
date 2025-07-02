package implClient

type Location struct {
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
	Rotation float64 `json:"rotation"`
}

type PowerInfo struct {
	PowerConsumed    float64 `json:"PowerConsumed"`
	MaxPowerConsumed float64 `json:"MaxPowerConsumed"`
}

type RawItemAmount struct {
	Name   string  `json:"Name"`
	Amount float64 `json:"Amount"`
}

type RawProduction struct {
	Name        string  `json:"Name"`
	Amount      float64 `json:"Amount"` // Stored amount
	CurrentProd float64 `json:"CurrentProd"`
	MaxProd     float64 `json:"MaxProd"`
	ProdPercent float64 `json:"ProdPercent"` // Efficiency 0-100
}

type RawIngredient struct {
	Name            string  `json:"Name"`
	Amount          float64 `json:"Amount"` // Stored amount
	CurrentConsumed float64 `json:"CurrentConsumed"`
	MaxConsumed     float64 `json:"MaxConsumed"`
	ConsPercent     float64 `json:"ConsPercent"` // Efficiency 0-100
}

type RawExtractor struct {
	Name         string          `json:"Name"`
	IsProducing  bool            `json:"IsProducing"`
	IsPaused     bool            `json:"IsPaused"`
	IsConfigured bool            `json:"IsConfigured"`
	Location     Location        `json:"location"`
	PowerInfo    PowerInfo       `json:"PowerInfo"`
	Production   []RawProduction `json:"production"`
}

type RawFactoryMachine struct {
	Name         string          `json:"Name"`
	IsProducing  bool            `json:"IsProducing"`
	IsPaused     bool            `json:"IsPaused"`
	IsConfigured bool            `json:"IsConfigured"`
	Location     Location        `json:"location"`
	PowerInfo    PowerInfo       `json:"PowerInfo"`
	Ingredients  []RawIngredient `json:"ingredients"`
	Production   []RawProduction `json:"production"`
}

type RawGenerator struct {
	Name                     string   `json:"Name"`
	Location                 Location `json:"location"`
	PowerProduction          float64  `json:"PowerProduction"`          // Current actual
	PowerProductionPotential float64  `json:"PowerProductionPotential"` // Max possible
	RegulatedDemandProd      float64  `json:"RegulatedDemandProd"`      // Used for some types
}

type RawCircuit struct {
	CircuitID           string  `json:"CircuitID"`
	PowerConsumed       float64 `json:"PowerConsumed"`       // MW
	PowerMaxConsumed    float64 `json:"PowerMaxConsumed"`    // MW
	PowerProduction     float64 `json:"PowerProduction"`     // MW
	PowerCapacity       float64 `json:"PowerCapacity"`       // MW
	BatteryPercent      float64 `json:"BatteryPercent"`      // 0-100
	BatteryCapacity     float64 `json:"BatteryCapacity"`     // MWh
	BatteryDifferential float64 `json:"BatteryDifferential"` // MW
	BatteryTimeFull     *string `json:"BatteryTimeFull"`     // "HH:MM:SS", nullable
	BatteryTimeEmpty    *string `json:"BatteryTimeEmpty"`    // "HH:MM:SS", nullable
	FuseTriggered       bool    `json:"FuseTriggered"`
}

type RawProdStatItem struct {
	Name            string  `json:"Name"`
	CurrentProd     float64 `json:"CurrentProd"`
	MaxProd         float64 `json:"MaxProd"`
	ProdPercent     float64 `json:"ProdPercent"`
	CurrentConsumed float64 `json:"CurrentConsumed"`
	MaxConsumed     float64 `json:"MaxConsumed"`
	ConsPercent     float64 `json:"ConsPercent"`
}

type RawWorldInvItem struct {
	Name   string `json:"Name"`
	Amount int    `json:"Amount"`
}

type RawSinkData struct {
	TotalPoints float64   `json:"TotalPoints"`
	NumCoupon   int       `json:"NumCoupon"`
	Percent     float64   `json:"Percent"`     // Towards next coupon
	GraphPoints []float64 `json:"GraphPoints"` // Points per minute history
}

type RawPlayer struct {
	Id        string          `json:"Id"` // Assuming ID is string
	Name      string          `json:"Name"`
	PlayerHP  float64         `json:"PlayerHP"`
	Inventory []RawItemAmount `json:"Inventory"`
}

type RawTrainTimeTableEntry struct {
	StationName string `json:"StationName"`
}

type RawTrainVehicle struct {
	Type      string          `json:"Type"`
	Capacity  int             `json:"Capacity"`
	Inventory []RawItemAmount `json:"Inventory"`
}

type RawTrain struct {
	Name           string                   `json:"Name"`
	ForwardSpeed   float64                  `json:"ForwardSpeed"`
	Location       Location                 `json:"location"`
	TimeTable      []RawTrainTimeTableEntry `json:"TimeTable"`
	TimeTableIndex int                      `json:"TimeTableIndex"`
	Status         string                   `json:"Status"` // "Self-Driving", "Manual Driving", "Parked"
	Derailed       bool                     `json:"Derailed"`
	PowerInfo      PowerInfo                `json:"PowerInfo"`
	Vehicles       []RawTrainVehicle        `json:"Vehicles"`
}

type RawTrainStation struct {
	Name     string   `json:"Name"`
	Location Location `json:"location"`
}

type RawDrone struct {
	Name               string   `json:"Name"`
	Location           Location `json:"location"`
	FlyingSpeed        float64  `json:"FlyingSpeed"`
	HomeStation        string   `json:"HomeStation"`        // Name
	TargetStation      string   `json:"TargetStation"`      // Paired Station Name
	DestinationStation string   `json:"DestinationStation"` // Current flight target Name
}

type RawDroneStationFuel struct {
	FuelName string `json:"FuelName"` // Can be "N/A"
}

type RawDroneStation struct {
	Name       string              `json:"Name"`
	Location   Location            `json:"location"`
	ActiveFuel RawDroneStationFuel `json:"ActiveFuel"`
}
