package frmmock

import (
	"api/service/frm_client/frm_models"
	"math"
)

// renderMachines splits the world's machines into the three arrays FRM serves them
// from. They are built together so the three endpoints behind a machines event
// always agree.
func renderMachines(w *World, cfg Config, t float64) ([]frm_models.Extractor, []frm_models.FactoryMachine, []frm_models.Generator) {
	extractors := make([]frm_models.Extractor, 0, len(w.Machines))
	factories := make([]frm_models.FactoryMachine, 0, len(w.Machines))
	generators := make([]frm_models.Generator, 0, len(w.Machines))

	for i := range w.Machines {
		m := w.Machines[i]
		spec := w.machineSpec(i)

		switch spec.Category {
		case "extractor":
			extractors = append(extractors, renderExtractor(w, m, spec, t))
		case "generator":
			generators = append(generators, renderGenerator(w, cfg, m, spec, t))
		default:
			factories = append(factories, renderFactory(w, m, spec, t))
		}
	}
	return extractors, factories, generators
}

func renderExtractor(w *World, m Machine, spec machineSpec, t float64) frm_models.Extractor {
	eff := efficiency(m, t)
	rate := m.OutputRate * eff

	return frm_models.Extractor{
		Name:                spec.Name,
		IsProducing:         isProducing(m, t),
		IsPaused:            m.Health == HealthPaused,
		IsConfigured:        m.Health != HealthUnconfigured,
		IsFullSpeed:         eff >= 1,
		CanStart:            true,
		BaseProd:            quantise(m.OutputRate, 3),
		DynamicProdCapacity: quantise(m.OutputRate*m.Clock, 3),
		Location:            location(m.Loc, m.Rotation),
		BoundingBox:         boxAround(m.Loc, spec.Width, spec.Depth, spec.Height),
		PowerInfo:           renderPowerInfo(m, spec, t),
		Production: []frm_models.Production{{
			Name:        m.OutputItem,
			Amount:      quantise(bufferLevel(m, t)*100, 1),
			CurrentProd: quantise(rate, 3),
			MaxProd:     quantise(m.OutputRate, 3),
			ProdPercent: quantise(eff*100, 2),
		}},
	}
}

func renderFactory(w *World, m Machine, spec machineSpec, t float64) frm_models.FactoryMachine {
	eff := efficiency(m, t)

	var ingredients []frm_models.Ingredient
	if m.InputItem != "" {
		ingredients = []frm_models.Ingredient{{
			Name:            m.InputItem,
			Amount:          quantise(bufferLevel(m, t)*100, 1),
			CurrentConsumed: quantise(m.InputRate*eff, 3),
			MaxConsumed:     quantise(m.InputRate, 3),
			ConsPercent:     quantise(eff*100, 2),
		}}
	}

	var production []frm_models.Production
	if m.OutputItem != "" {
		production = []frm_models.Production{{
			Name:        m.OutputItem,
			Amount:      quantise(bufferLevel(m, t)*50, 1),
			CurrentProd: quantise(m.OutputRate*eff, 3),
			MaxProd:     quantise(m.OutputRate, 3),
			ProdPercent: quantise(eff*100, 2),
		}}
	}

	return frm_models.FactoryMachine{
		Name:                spec.Name,
		IsProducing:         isProducing(m, t),
		IsPaused:            m.Health == HealthPaused,
		IsConfigured:        m.Health != HealthUnconfigured,
		IsFullSpeed:         eff >= 1,
		CanStart:            true,
		BaseProd:            quantise(m.OutputRate, 3),
		DynamicProdCapacity: quantise(m.OutputRate*m.Clock, 3),
		Productivity:        quantise(eff*100, 2),
		Location:            location(m.Loc, m.Rotation),
		BoundingBox:         boxAround(m.Loc, spec.Width, spec.Depth, spec.Height),
		PowerInfo:           renderPowerInfo(m, spec, t),
		Ingredients:         ingredients,
		Production:          production,
	}
}

// renderGenerator reports a generator throttled to its circuit's demand, which is
// how the game behaves and what keeps the power chart believable.
func renderGenerator(w *World, cfg Config, m Machine, spec machineSpec, t float64) frm_models.Generator {
	circuit := w.circuitByID(m.CircuitID)
	demandRatio := 1.0
	if circuit.CapacityMW > 0 {
		demandRatio = math.Min(1, circuit.ConsumptionMW/circuit.CapacityMW)
	}

	output := spec.PowerMW * demandRatio
	capacity := spec.PowerMW
	if spec.Name == "Geothermal Generator" {
		capacity = spec.PowerMW * geothermalFactor(t, m.Phase)
		output = capacity
	}

	return frm_models.Generator{
		Name:                spec.Name,
		Location:            location(m.Loc, m.Rotation),
		BoundingBox:         boxAround(m.Loc, spec.Width, spec.Depth, spec.Height),
		BaseProd:            quantise(spec.PowerMW, 3),
		RegulatedDemandProd: quantise(output, 3),
		ProductionCapacity:  quantise(capacity, 3),
		CircuitID:           m.CircuitID,
	}
}

// renderPowerInfo reports a machine's draw. The sum across a circuit's machines is
// what the circuit reports, so both views agree.
func renderPowerInfo(m Machine, spec machineSpec, t float64) frm_models.PowerInfo {
	maxDraw := spec.PowerMW * math.Pow(m.Clock, 1.321)
	draw := maxDraw
	if m.Health == HealthPaused || m.Health == HealthUnconfigured {
		draw = 0
	} else if m.Health == HealthIdle {
		draw = maxDraw * 0.05
	}

	return frm_models.PowerInfo{
		PowerConsumed:    quantise(draw, 4),
		MaxPowerConsumed: quantise(maxDraw, 4),
		CircuitID:        m.CircuitID,
		CircuitGroupID:   m.GroupID,
	}
}
