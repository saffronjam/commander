package frmmock

import "api/models/models"

// Capability is a buildable or mechanic the world may use. Generation asks
// allows() rather than testing the phase directly, so a new buildable needs one
// table row and no new conditionals.
type Capability string

// Capabilities the generator gates on.
const (
	CapSmelter       Capability = "Smelter"
	CapConstructor   Capability = "Constructor"
	CapMinerMk1      Capability = "Miner Mk.1"
	CapBiomassBurner Capability = "Biomass Burner"
	CapAssembler     Capability = "Assembler"
	CapCoalGenerator Capability = "Coal Generator"
	CapFoundry       Capability = "Foundry"
	CapMinerMk2      Capability = "Miner Mk.2"
	CapRefinery      Capability = "Refinery"
	CapManufacturer  Capability = "Manufacturer"
	CapPipeline      Capability = "Pipeline"
	CapTrainStation  Capability = "Train Station"
	CapFuelGenerator Capability = "Fuel Generator"
	CapBlender       Capability = "Blender"
	CapDronePort     Capability = "Drone Port"
	CapNuclearPlant  Capability = "Nuclear Power Plant"
	CapParticleAccel Capability = "Particle Accelerator"
	CapMinerMk3      Capability = "Miner Mk.3"
)

// unlockTier is the tech tier that grants each capability.
var unlockTier = map[Capability]int{
	CapSmelter:       0,
	CapConstructor:   0,
	CapMinerMk1:      0,
	CapBiomassBurner: 0,
	CapAssembler:     2,
	CapCoalGenerator: 3,
	CapFoundry:       3,
	CapMinerMk2:      3,
	CapRefinery:      5,
	CapManufacturer:  5,
	CapPipeline:      5,
	CapTrainStation:  6,
	CapFuelGenerator: 6,
	CapBlender:       7,
	CapDronePort:     8,
	CapNuclearPlant:  8,
	CapParticleAccel: 8,
	CapMinerMk3:      8,
}

// phaseTierCap maps a delivered Space Elevator phase to the highest tech tier the
// world can have unlocked.
var phaseTierCap = [6]int{0, 2, 4, 6, 8, 9}

// tierForPhase reports the tier cap for a delivered phase.
func tierForPhase(phase int) int {
	if phase < 0 {
		return 0
	}
	if phase >= len(phaseTierCap) {
		return phaseTierCap[len(phaseTierCap)-1]
	}
	return phaseTierCap[phase]
}

// phaseForTier reports the lowest phase that unlocks a tier, for error messages
// that tell the operator what to change.
func phaseForTier(tier int) int {
	for phase, cap := range phaseTierCap {
		if cap >= tier {
			return phase
		}
	}
	return len(phaseTierCap) - 1
}

// machineSpec is everything generation and rendering need about one machine kind.
// Name is what FRM puts on the wire: its localized display name.
type machineSpec struct {
	Name     string
	Class    string
	Category models.MachineCategory
	Cap      Capability
	Width    float64
	Depth    float64
	Height   float64
	PowerMW  float64
}

// Machine kinds the mock can place, keyed for lookup by generation.
var machineSpecs = map[string]machineSpec{
	"miner": {
		Name: "Miner Mk.1", Class: "Build_MinerMk1_C", Category: models.MachineCategoryExtractor,
		Cap: CapMinerMk1, Width: 1900, Depth: 1900, Height: 1800, PowerMW: 5,
	},
	"smelter": {
		Name: "Smelter", Class: "Build_SmelterMk1_C", Category: models.MachineCategoryFactory,
		Cap: CapSmelter, Width: 600, Depth: 900, Height: 900, PowerMW: 4,
	},
	"constructor": {
		Name: "Constructor", Class: "Build_ConstructorMk1_C", Category: models.MachineCategoryFactory,
		Cap: CapConstructor, Width: 800, Depth: 1600, Height: 800, PowerMW: 4,
	},
	"assembler": {
		Name: "Assembler", Class: "Build_AssemblerMk1_C", Category: models.MachineCategoryFactory,
		Cap: CapAssembler, Width: 1000, Depth: 1500, Height: 1000, PowerMW: 15,
	},
	"foundry": {
		Name: "Foundry", Class: "Build_FoundryMk1_C", Category: models.MachineCategoryFactory,
		Cap: CapFoundry, Width: 1000, Depth: 1900, Height: 900, PowerMW: 16,
	},
	"coalGenerator": {
		Name: "Coal Generator", Class: "Build_GeneratorCoal_C", Category: models.MachineCategoryGenerator,
		Cap: CapCoalGenerator, Width: 1000, Depth: 2600, Height: 3000, PowerMW: 75,
	},
	"biomassBurner": {
		Name: "Biomass Burner", Class: "Build_GeneratorBiomass_C", Category: models.MachineCategoryGenerator,
		Cap: CapBiomassBurner, Width: 800, Depth: 800, Height: 700, PowerMW: 30,
	},
	"fuelGenerator": {
		Name: "Fuel Generator", Class: "Build_GeneratorFuel_C", Category: models.MachineCategoryGenerator,
		Cap: CapFuelGenerator, Width: 2000, Depth: 2000, Height: 2500, PowerMW: 250,
	},
}

// beltMark is one conveyor tier: the display name FRM reports and its throughput.
type beltMark struct {
	Name  string
	Class string
	Rate  float64
	Tier  int
}

// beltMarks is ordered by throughput so the smallest sufficient mark can be
// chosen for a given flow.
var beltMarks = []beltMark{
	{"Conveyor Belt Mk.1", "Build_ConveyorBeltMk1_C", 60, 0},
	{"Conveyor Belt Mk.2", "Build_ConveyorBeltMk2_C", 120, 2},
	{"Conveyor Belt Mk.3", "Build_ConveyorBeltMk3_C", 270, 3},
	{"Conveyor Belt Mk.4", "Build_ConveyorBeltMk4_C", 480, 6},
	{"Conveyor Belt Mk.5", "Build_ConveyorBeltMk5_C", 780, 7},
	{"Conveyor Belt Mk.6", "Build_ConveyorBeltMk6_C", 1200, 9},
}

// beltForFlow picks the smallest belt mark that carries the flow and is unlocked
// at the given tier, falling back to the best unlocked mark.
func beltForFlow(flow float64, maxTier int) beltMark {
	best := beltMarks[0]
	for _, m := range beltMarks {
		if m.Tier > maxTier {
			continue
		}
		best = m
		if m.Rate >= flow {
			return m
		}
	}
	return best
}

// resourceSpec names a raw resource as FRM reports it. Name must match a scraped
// icon filename or the map silently renders no icon for the node.
type resourceSpec struct {
	Name  string
	Class string
	Form  string
}

// Raw resources the mock places nodes for.
var resourceSpecs = []resourceSpec{
	{"Iron Ore", "Desc_OreIron_C", "Solid"},
	{"Copper Ore", "Desc_OreCopper_C", "Solid"},
	{"Limestone", "Desc_Stone_C", "Solid"},
	{"Coal", "Desc_Coal_C", "Solid"},
	{"Caterium Ore", "Desc_OreGold_C", "Solid"},
	{"Raw Quartz", "Desc_RawQuartz_C", "Solid"},
	{"Sulfur", "Desc_Sulfur_C", "Solid"},
	{"Bauxite", "Desc_OreBauxite_C", "Solid"},
}

// purities are the three node purities FRM reports, weighted the way the real map
// distributes them.
var purities = []struct {
	Name       string
	Multiplier float64
	Weight     float64
}{
	{"Impure", 0.5, 0.3},
	{"Normal", 1.0, 0.5},
	{"Pure", 2.0, 0.2},
}

// pickPurity draws a purity from the weighted distribution.
func pickPurity(s *stream) (string, float64) {
	r := s.float()
	var acc float64
	for _, p := range purities {
		acc += p.Weight
		if r < acc {
			return p.Name, p.Multiplier
		}
	}
	return purities[len(purities)-1].Name, purities[len(purities)-1].Multiplier
}

// sinkPointValues is the AWESOME Sink point value of each item the mock may feed
// into it.
var sinkPointValues = map[string]float64{
	"Screw":                 2,
	"Iron Rod":              4,
	"Iron Plate":            6,
	"Wire":                  6,
	"Concrete":              12,
	"Cable":                 24,
	"Copper Sheet":          24,
	"Steel Beam":            64,
	"Reinforced Iron Plate": 120,
	"Rotor":                 140,
	"Modular Frame":         408,
}

// couponCost is the AWESOME Sink cost of the n-th coupon, n starting at 1.
func couponCost(n int) float64 {
	group := max((n+2)/3, 1)
	d := float64(group - 1)
	return 500*d*d + 1000
}

// couponsFor reports how many coupons a point total has earned and how far the
// total is towards the next one, as a percentage.
func couponsFor(total float64) (int, float64) {
	var spent float64
	n := 0
	for {
		cost := couponCost(n + 1)
		if spent+cost > total {
			return n, 100 * (total - spent) / cost
		}
		spent += cost
		n++
	}
}
