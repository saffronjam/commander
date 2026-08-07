package frmmock

// World is the immutable generated factory. Every response is either a field of
// World or a pure function of (World, tick). Nothing in this package mutates a
// World after GenerateWorld returns.
//
// Cross-references are indices, never pointers or maps, so the whole structure is
// trivially hashable for determinism tests and every wire string is rendered from
// the index the generator stored rather than from a second copy that could drift.
type World struct {
	Seed     int64
	SaveName string
	Phase    int
	MaxTier  int

	Sites    []Site
	Nodes    []Node
	Machines []Machine
	Circuits []Circuit

	Belts         []Conveyor
	Pipes         []Conveyor
	Splitters     []Junction
	PipeJunctions []Junction
	Cables        []Cable

	Players []Player

	Items    []ItemFlow
	SinkFeed []SinkFeed

	PlayDurationBase int
}

// Range is a half-open index window into one of World's slices. A site owns its
// contents by range rather than by holding copies, so there is exactly one
// instance of every entity.
type Range struct {
	Lo, Hi int
}

// SiteKind describes what a site is for, which decides what gets built there.
type SiteKind string

// The site kinds the generator places.
const (
	SiteHub      SiteKind = "hub"
	SiteMining   SiteKind = "mining"
	SiteSmelting SiteKind = "smelting"
	SitePower    SiteKind = "power"
)

// Site is one production area: a cluster of machines sharing a circuit.
type Site struct {
	ID        int
	Name      string
	Kind      SiteKind
	Region    string
	Center    Point
	CircuitID int
	Machines  Range
	Nodes     Range
}

// Node is a resource node. Exploited nodes carry a miner at the same coordinates;
// the rest are scenery that radar towers report.
type Node struct {
	ID         string
	Resource   resourceSpec
	Purity     string
	Multiplier float64
	Loc        Point
	Exploited  bool
	Site       int
}

// MachineHealth is the operating state the generator assigned to a machine. Most
// machines run; a few are deliberately idle or unconfigured so the efficiency
// breakdown on the dashboard has something to show.
type MachineHealth string

// The machine health states.
const (
	HealthRunning      MachineHealth = "running"
	HealthIdle         MachineHealth = "idle"
	HealthPaused       MachineHealth = "paused"
	HealthUnconfigured MachineHealth = "unconfigured"
)

// Machine is one placed building. Spec keys into machineSpecs; Clock is the
// overclock fraction, which is what makes reported efficiency land on believable
// values instead of exactly 100 everywhere.
type Machine struct {
	Spec      string
	Site      int
	Node      int
	Loc       Point
	Rotation  float64
	CircuitID int
	GroupID   int
	Clock     float64
	Phase     float64
	Health    MachineHealth

	OutputItem string
	OutputRate float64
	InputItem  string
	InputRate  float64
}

// Circuit is one power grid. Every circuit has at least one generator, because the
// client drops circuits reporting no production.
type Circuit struct {
	ID            int
	GroupID       int
	ConsumptionMW float64
	CapacityMW    float64
	HasBattery    bool
	BatteryMWh    float64
	FusePhase     float64
}

// Conveyor is a belt, pipe or hypertube. The three have identical wire shapes.
// FromMachine and ToMachine index Machines, so a conveyor cannot dangle.
type Conveyor struct {
	ID          string
	Name        string
	Class       string
	FromMachine int
	ToMachine   int
	From        Point
	To          Point
	Length      float64
	Rate        float64
	Flow        float64
}

// Junction is a splitter, merger or pipe junction.
type Junction struct {
	ID    string
	Name  string
	Class string
	Loc   Point
}

// Cable connects two buildings on the same circuit.
type Cable struct {
	ID          string
	Name        string
	Class       string
	FromMachine int
	ToMachine   int
	From        Point
	To          Point
	Length      float64
}

// ItemStack is one entry in an inventory.
type ItemStack struct {
	Name   string
	Amount float64
}

// Player is a pioneer walking the world. Name must be non-empty or the client
// drops the player, and players are one of the events a session needs to be ready.
type Player struct {
	ID        string
	Name      string
	HP        float64
	Loc       Point
	Inventory []ItemStack
}

// ItemFlow is the economy's steady state for one item. DriftPM is the net rate at
// which world stock changes; it is zero for everything the factory balances, so
// world inventory never has to be clamped.
type ItemFlow struct {
	Name          string
	ProducedPM    float64
	ConsumedPM    float64
	MaxProducedPM float64
	MaxConsumedPM float64
	StockBase     float64
	DriftPM       float64
}

// SinkFeed is one item being fed to the AWESOME Sink.
type SinkFeed struct {
	Item   string
	RatePM float64
}

// allows reports whether the world's tier unlocks a capability.
func (w *World) allows(c Capability) bool {
	return unlockTier[c] <= w.MaxTier
}

// machineSpec resolves a machine's spec, panicking on an unknown key because that
// can only be a generator bug.
func (w *World) machineSpec(i int) machineSpec {
	spec, ok := machineSpecs[w.Machines[i].Spec]
	if !ok {
		panic("frmmock: machine " + w.Machines[i].Spec + " has no spec")
	}
	return spec
}

// pointsPerMinute is the sink's income at the world's steady state.
func (w *World) pointsPerMinute() float64 {
	var total float64
	for _, f := range w.SinkFeed {
		total += f.RatePM * sinkPointValues[f.Item]
	}
	return total
}
