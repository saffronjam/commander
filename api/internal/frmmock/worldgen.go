package frmmock

import (
	"fmt"
	"math"
)

// region is a named rectangle of the world. The regions partition the playable
// area so sites land in plausible, non-overlapping places. They are named after
// biomes for readability and do not reproduce the real map's geometry.
type region struct {
	Name string
	Rect Rect
	Base float64
}

var regions = []region{
	{"Grass Fields", Rect{-60000, -40000, 60000, 80000}, 800},
	{"Rocky Desert", Rect{60000, -120000, 200000, 20000}, 2400},
	{"Dune Desert", Rect{180000, -40000, 380000, 160000}, 1600},
	{"Northern Forest", Rect{-120000, -330000, 20000, -180000}, 3200},
	{"Titan Forest", Rect{30000, 80000, 160000, 220000}, 6400},
	{"Spire Coast", Rect{-300000, -40000, -160000, 140000}, 400},
	{"Blue Crater", Rect{-260000, 160000, -80000, 330000}, 5200},
	{"Red Bamboo Fields", Rect{220000, 180000, 400000, 340000}, 2000},
}

// chain is one production step: a machine kind turning an input item into an
// output item at a rate.
type chain struct {
	Spec       string
	InputItem  string
	InputRate  float64
	OutputItem string
	OutputRate float64
}

// baseChain is the production the mock builds at every phase. Rates are the real
// default recipes, per machine at 100% clock.
var baseChain = []chain{
	{Spec: "smelter", InputItem: "Iron Ore", InputRate: 30, OutputItem: "Iron Ingot", OutputRate: 30},
	{Spec: "constructor", InputItem: "Iron Ingot", InputRate: 30, OutputItem: "Iron Plate", OutputRate: 20},
	{Spec: "constructor", InputItem: "Iron Ingot", InputRate: 15, OutputItem: "Iron Rod", OutputRate: 15},
}

// GenerateWorld builds the immutable world for a config. It is deterministic: the
// same config always produces an identical world.
func GenerateWorld(cfg Config) (*World, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	w := &World{
		Seed:             cfg.Seed,
		SaveName:         cfg.SaveName,
		Phase:            cfg.Phase,
		MaxTier:          tierForPhase(cfg.Phase),
		PlayDurationBase: cfg.PlayDurationBaseSeconds,
	}

	siteCount := 1
	if cfg.World.Sites != nil {
		siteCount = *cfg.World.Sites
	}

	generateSites(w, cfg, siteCount)
	generateInfra(w)
	generatePlayers(w, cfg)
	generateEconomy(w, cfg)

	if err := validateWorld(w); err != nil {
		return nil, err
	}
	return w, nil
}

// generateSites lays out sites across regions, each with its own circuit, nodes,
// miners, factory machines and a generator to power them.
func generateSites(w *World, cfg Config, siteCount int) {
	s := derive(cfg.Seed, "sites", 0)

	for i := range siteCount {
		reg := regions[i%len(regions)]
		rs := derive(cfg.Seed, "site-center", i)
		center := clampToWorld(Point{
			X: rs.between(reg.Rect.MinX+8000, reg.Rect.MaxX-8000),
			Y: rs.between(reg.Rect.MinY+8000, reg.Rect.MaxY-8000),
			Z: reg.Base,
		})

		kind := SiteMining
		if i == 0 {
			kind = SiteHub
		}

		site := Site{
			ID:        i,
			Name:      fmt.Sprintf("%s %s", reg.Name, siteSuffix(kind, i)),
			Kind:      kind,
			Region:    reg.Name,
			Center:    center,
			CircuitID: i + 1,
		}

		site.Nodes.Lo = len(w.Nodes)
		generateNodes(w, cfg, i, center)
		site.Nodes.Hi = len(w.Nodes)

		site.Machines.Lo = len(w.Machines)
		generateMiners(w, cfg, i, site)
		generateFactory(w, cfg, i, site)
		generatePower(w, cfg, i, site)
		site.Machines.Hi = len(w.Machines)

		w.Sites = append(w.Sites, site)
		w.Circuits = append(w.Circuits, buildCircuit(w, site, s, cfg.Dynamics.batteriesEnabled()))
	}
}

func siteSuffix(kind SiteKind, i int) string {
	switch kind {
	case SiteHub:
		return "Hub"
	default:
		return fmt.Sprintf("Works %d", i)
	}
}

// generateNodes places exploited nodes on a jittered lattice near the site centre,
// plus scenery nodes scattered further out.
func generateNodes(w *World, cfg Config, siteID int, center Point) {
	s := derive(cfg.Seed, "nodes", siteID)

	exploited := 2 + s.intn(3)
	for i := range exploited {
		res := resourceSpecs[i%2]
		purity, mult := pickPurity(s)
		angle := s.between(0, 2*math.Pi)
		radius := s.between(1200, 3600)
		loc := clampToWorld(Point{
			X: center.X + math.Cos(angle)*radius,
			Y: center.Y + math.Sin(angle)*radius,
			Z: center.Z,
		})
		w.Nodes = append(w.Nodes, Node{
			ID:         fmt.Sprintf("node-%d-%d", siteID, i),
			Resource:   res,
			Purity:     purity,
			Multiplier: mult,
			Loc:        loc,
			Exploited:  true,
			Site:       siteID,
		})
	}

	scenery := 4 + s.intn(5)
	for i := range scenery {
		res := pick(s, resourceSpecs)
		purity, mult := pickPurity(s)
		angle := s.between(0, 2*math.Pi)
		radius := s.between(8000, 40000)
		loc := clampToWorld(Point{
			X: center.X + math.Cos(angle)*radius,
			Y: center.Y + math.Sin(angle)*radius,
			Z: center.Z + s.between(-400, 900),
		})
		w.Nodes = append(w.Nodes, Node{
			ID:         fmt.Sprintf("node-%d-s%d", siteID, i),
			Resource:   res,
			Purity:     purity,
			Multiplier: mult,
			Loc:        loc,
			Exploited:  false,
			Site:       siteID,
		})
	}
}

// generateMiners puts one miner exactly on each exploited node, so the map shows
// the miner and the node at the same place as the real game does.
func generateMiners(w *World, cfg Config, siteID int, site Site) {
	s := derive(cfg.Seed, "miners", siteID)

	for ni := site.Nodes.Lo; ni < site.Nodes.Hi; ni++ {
		node := w.Nodes[ni]
		if !node.Exploited {
			continue
		}
		rate := 60 * node.Multiplier
		w.Machines = append(w.Machines, Machine{
			Spec:       "miner",
			Site:       siteID,
			Node:       ni,
			Loc:        node.Loc,
			Rotation:   quantise(s.between(0, 360), 1),
			CircuitID:  site.CircuitID,
			GroupID:    site.CircuitID,
			Clock:      1,
			Phase:      s.float(),
			Health:     HealthRunning,
			OutputItem: node.Resource.Name,
			OutputRate: rate,
		})
	}
}

// generateFactory lays machine rows out behind the site centre, one row per
// production step, with the last machine of a step clocked down so the step's
// total throughput matches its target exactly.
func generateFactory(w *World, cfg Config, siteID int, site Site) {
	s := derive(cfg.Seed, "factory", siteID)

	oreRate := 0.0
	for ni := site.Nodes.Lo; ni < site.Nodes.Hi; ni++ {
		if w.Nodes[ni].Exploited {
			oreRate += 60 * w.Nodes[ni].Multiplier
		}
	}

	target := oreRate
	rowY := site.Center.Y + 4000

	for _, c := range baseChain {
		if !w.allows(machineSpecs[c.Spec].Cap) {
			continue
		}
		spec := machineSpecs[c.Spec]
		count := max(int(math.Ceil(target/c.InputRate)), 1)

		rowX := site.Center.X - float64(count)*(spec.Width+200)/2
		for i := range count {
			clock := 1.0
			if i == count-1 {
				remainder := target - float64(count-1)*c.InputRate
				clock = math.Min(1, math.Max(0.05, remainder/c.InputRate))
			}
			loc := clampToWorld(Point{
				X: rowX + float64(i)*(spec.Width+200),
				Y: rowY,
				Z: site.Center.Z,
			})
			w.Machines = append(w.Machines, Machine{
				Spec:       c.Spec,
				Site:       siteID,
				Node:       -1,
				Loc:        loc,
				Rotation:   90,
				CircuitID:  site.CircuitID,
				GroupID:    site.CircuitID,
				Clock:      quantise(clock, 4),
				Phase:      s.float(),
				Health:     machineHealth(s),
				InputItem:  c.InputItem,
				InputRate:  quantise(c.InputRate*clock, 3),
				OutputItem: c.OutputItem,
				OutputRate: quantise(c.OutputRate*clock, 3),
			})
		}
		target = target / c.InputRate * c.OutputRate
		rowY += spec.Depth + 600
	}
}

// machineHealth marks a small share of machines as not running, so the efficiency
// breakdown has something other than one bar.
func machineHealth(s *stream) MachineHealth {
	switch r := s.float(); {
	case r < 0.02:
		return HealthPaused
	case r < 0.03:
		return HealthUnconfigured
	case r < 0.08:
		return HealthIdle
	default:
		return HealthRunning
	}
}

// generatePower puts enough generators on the site's circuit to cover its draw
// plus headroom. Every circuit needs at least one generator, because the client
// drops circuits that report no production.
func generatePower(w *World, cfg Config, siteID int, site Site) {
	s := derive(cfg.Seed, "power", siteID)

	var demandMW float64
	for i := site.Machines.Lo; i < len(w.Machines); i++ {
		spec := w.machineSpec(i)
		if spec.Category == "generator" {
			continue
		}
		demandMW += spec.PowerMW * math.Pow(w.Machines[i].Clock, 1.321)
	}

	specKey := "biomassBurner"
	if w.allows(CapCoalGenerator) {
		specKey = "coalGenerator"
	}
	if w.allows(CapFuelGenerator) && siteID%3 == 2 {
		specKey = "fuelGenerator"
	}
	spec := machineSpecs[specKey]

	need := demandMW * (1 + cfg.Economy.PowerHeadroom)
	count := max(int(math.Ceil(need/spec.PowerMW)), 1)

	rowY := site.Center.Y - 6000
	rowX := site.Center.X - float64(count)*(spec.Width+400)/2
	for i := range count {
		loc := clampToWorld(Point{
			X: rowX + float64(i)*(spec.Width+400),
			Y: rowY,
			Z: site.Center.Z,
		})
		w.Machines = append(w.Machines, Machine{
			Spec:      specKey,
			Site:      siteID,
			Node:      -1,
			Loc:       loc,
			Rotation:  270,
			CircuitID: site.CircuitID,
			GroupID:   site.CircuitID,
			Clock:     1,
			Phase:     s.float(),
			Health:    HealthRunning,
			InputItem: generatorFuel(specKey),
		})
	}
}

func generatorFuel(specKey string) string {
	switch specKey {
	case "coalGenerator":
		return "Coal"
	case "fuelGenerator":
		return "Fuel"
	default:
		return "Biomass"
	}
}

// buildCircuit sums the site's draw and capacity so the power view's totals agree
// with the machines the map shows.
func buildCircuit(w *World, site Site, s *stream, cfgBatteries bool) Circuit {
	var consumption, capacity float64
	for i := site.Machines.Lo; i < site.Machines.Hi; i++ {
		spec := w.machineSpec(i)
		if spec.Category == "generator" {
			capacity += spec.PowerMW
			continue
		}
		if w.Machines[i].Health == HealthPaused || w.Machines[i].Health == HealthUnconfigured {
			continue
		}
		consumption += spec.PowerMW * math.Pow(w.Machines[i].Clock, 1.321)
	}

	hasBattery := cfgBatteries && s.float() < 0.5
	batteryMWh := 0.0
	if hasBattery {
		batteryMWh = quantise(s.between(100, 600), 1)
	}

	return Circuit{
		ID:            site.CircuitID,
		GroupID:       site.CircuitID,
		ConsumptionMW: quantise(consumption, 3),
		CapacityMW:    quantise(capacity, 3),
		HasBattery:    hasBattery,
		BatteryMWh:    batteryMWh,
		FusePhase:     s.float(),
	}
}

// generateInfra wires the site up: a belt from each miner into the first factory
// row, a belt between rows, a merger per site, and cables joining every machine to
// its circuit.
func generateInfra(w *World) {
	for _, site := range w.Sites {
		var miners, factories, generators []int
		for i := site.Machines.Lo; i < site.Machines.Hi; i++ {
			switch w.machineSpec(i).Category {
			case "extractor":
				miners = append(miners, i)
			case "generator":
				generators = append(generators, i)
			default:
				factories = append(factories, i)
			}
		}

		if len(factories) > 0 {
			for _, m := range miners {
				w.Belts = append(w.Belts, conveyor(w, "belt", len(w.Belts), m, factories[0],
					beltForFlow(w.Machines[m].OutputRate, w.MaxTier)))
			}
			for i := 0; i+1 < len(factories); i++ {
				w.Belts = append(w.Belts, conveyor(w, "belt", len(w.Belts), factories[i], factories[i+1],
					beltForFlow(w.Machines[factories[i]].OutputRate, w.MaxTier)))
			}
		}

		if len(miners) > 1 {
			mid := midpoint(w.Machines[miners[0]].Loc, w.Machines[miners[len(miners)-1]].Loc)
			w.Splitters = append(w.Splitters, Junction{
				ID:    fmt.Sprintf("merger-%d", site.ID),
				Name:  "Conveyor Merger",
				Class: "Build_ConveyorAttachmentMerger_C",
				Loc:   mid,
			})
		}

		if w.allows(CapPipeline) && len(generators) > 0 {
			mark := beltMark{Name: "Pipeline Mk.1", Class: "Build_Pipeline_C", Rate: 300}
			w.Pipes = append(w.Pipes, conveyor(w, "pipe", len(w.Pipes), generators[0], generators[len(generators)-1], mark))
			w.PipeJunctions = append(w.PipeJunctions, Junction{
				ID:    fmt.Sprintf("pipejunction-%d", site.ID),
				Name:  "Pipeline Junction Cross",
				Class: "Build_PipelineJunction_Cross_C",
				Loc:   midpoint(w.Machines[generators[0]].Loc, w.Machines[generators[len(generators)-1]].Loc),
			})
		}

		all := append(append([]int{}, miners...), factories...)
		all = append(all, generators...)
		for i := 0; i+1 < len(all); i++ {
			w.Cables = append(w.Cables, cable(w, len(w.Cables), all[i], all[i+1]))
		}
	}
}

func midpoint(a, b Point) Point {
	return Point{X: (a.X + b.X) / 2, Y: (a.Y + b.Y) / 2, Z: (a.Z + b.Z) / 2}
}

// conveyor builds a belt or pipe between two machines, taking both endpoints from
// the machines themselves so it can never dangle.
func conveyor(w *World, kind string, index, from, to int, mark beltMark) Conveyor {
	a, b := w.Machines[from].Loc, w.Machines[to].Loc
	return Conveyor{
		ID:          fmt.Sprintf("%s-%06d", kind, index),
		Name:        mark.Name,
		Class:       mark.Class,
		FromMachine: from,
		ToMachine:   to,
		From:        a,
		To:          b,
		Length:      quantise(dist2D(a, b), 1),
		Rate:        mark.Rate,
		Flow:        quantise(math.Min(mark.Rate, w.Machines[from].OutputRate), 3),
	}
}

func cable(w *World, index, from, to int) Cable {
	a, b := w.Machines[from].Loc, w.Machines[to].Loc
	return Cable{
		ID:          fmt.Sprintf("cable-%06d", index),
		Name:        "Power Line",
		Class:       "Build_PowerLine_C",
		FromMachine: from,
		ToMachine:   to,
		From:        a,
		To:          b,
		Length:      quantise(dist2D(a, b), 1),
	}
}

var playerNames = []string{"Pioneer", "Ada", "Simon", "Nova", "Kestrel"}

// generatePlayers places pioneers near the first site. A player with an empty name
// is dropped by the client, and players are one of the events a session needs.
func generatePlayers(w *World, cfg Config) {
	count := 0
	if cfg.World.Players != nil {
		count = *cfg.World.Players
	}
	if count == 0 || len(w.Sites) == 0 {
		return
	}

	center := w.Sites[0].Center
	for i := range count {
		s := derive(cfg.Seed, "player", i)
		w.Players = append(w.Players, Player{
			ID:   fmt.Sprintf("player-%d", i),
			Name: playerNames[i%len(playerNames)],
			HP:   quantise(s.between(70, 100), 0),
			Loc: clampToWorld(Point{
				X: center.X + s.between(-3000, 3000),
				Y: center.Y + s.between(-3000, 3000),
				Z: center.Z + 100,
			}),
			Inventory: []ItemStack{
				{Name: "Iron Plate", Amount: float64(20 + s.intn(80))},
				{Name: "Iron Rod", Amount: float64(10 + s.intn(60))},
			},
		})
	}
}

// generateEconomy sums what the placed machines produce and consume, so the
// production statistics agree with the buildings on the map rather than being
// invented separately.
func generateEconomy(w *World, cfg Config) {
	produced := map[string]float64{}
	consumed := map[string]float64{}
	maxProduced := map[string]float64{}
	maxConsumed := map[string]float64{}

	for i := range w.Machines {
		m := w.Machines[i]
		spec := w.machineSpec(i)
		running := m.Health == HealthRunning || m.Health == HealthIdle

		if m.OutputItem != "" && spec.Category != "generator" {
			maxProduced[m.OutputItem] += m.OutputRate / math.Max(m.Clock, 0.0001)
			if running {
				produced[m.OutputItem] += m.OutputRate
			}
		}
		if m.InputItem != "" {
			maxConsumed[m.InputItem] += m.InputRate / math.Max(m.Clock, 0.0001)
			if running {
				consumed[m.InputItem] += m.InputRate
			}
		}
	}

	// Generator fuel is consumed but never produced here, so it is stocked rather
	// than balanced.
	names := map[string]struct{}{}
	for n := range produced {
		names[n] = struct{}{}
	}
	for n := range consumed {
		names[n] = struct{}{}
	}

	ordered := make([]string, 0, len(names))
	for _, res := range resourceSpecs {
		if _, ok := names[res.Name]; ok {
			ordered = append(ordered, res.Name)
			delete(names, res.Name)
		}
	}
	for _, c := range baseChain {
		if _, ok := names[c.OutputItem]; ok {
			ordered = append(ordered, c.OutputItem)
			delete(names, c.OutputItem)
		}
	}
	for n := range names {
		ordered = append(ordered, n)
	}

	for i, name := range ordered {
		s := derive(cfg.Seed, "stock", i)
		drift := 0.0
		if _, isSinkable := sinkPointValues[name]; isSinkable && produced[name] > consumed[name] {
			drift = quantise(produced[name]-consumed[name], 3)
		}
		w.Items = append(w.Items, ItemFlow{
			Name:          name,
			ProducedPM:    quantise(produced[name], 3),
			ConsumedPM:    quantise(consumed[name], 3),
			MaxProducedPM: quantise(maxProduced[name], 3),
			MaxConsumedPM: quantise(maxConsumed[name], 3),
			StockBase:     quantise(s.between(200, 4000), 0),
			DriftPM:       drift,
		})
		if drift > 0 {
			w.SinkFeed = append(w.SinkFeed, SinkFeed{Item: name, RatePM: drift})
		}
	}
}

// validateWorld enforces the invariants the renderers and the dashboard rely on.
// A generator bug is a startup failure rather than a subtly wrong demo.
func validateWorld(w *World) error {
	if len(w.Sites) == 0 {
		return fmt.Errorf("frmmock: world has no sites")
	}
	if len(w.Circuits) == 0 {
		return fmt.Errorf("frmmock: world has no circuits")
	}

	generators := map[int]int{}
	for i := range w.Machines {
		if w.machineSpec(i).Category == "generator" {
			generators[w.Machines[i].CircuitID]++
		}
	}
	for _, c := range w.Circuits {
		if generators[c.ID] == 0 {
			return fmt.Errorf("frmmock: circuit %d has no generator, so the client would drop it", c.ID)
		}
	}

	for _, m := range w.Machines {
		p := Point{X: m.Loc.X, Y: m.Loc.Y}
		if p.X < WorldMinX || p.X > WorldMaxX || p.Y < WorldMinY || p.Y > WorldMaxY {
			return fmt.Errorf("frmmock: machine at %v is outside the world bounds", m.Loc)
		}
	}
	return nil
}
