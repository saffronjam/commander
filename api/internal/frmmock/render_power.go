package frmmock

import (
	"api/service/frm_client/frm_models"
	"math"
	"strconv"
)

// circuitByID resolves a circuit, returning a zero circuit if the id is unknown.
// Generation guarantees every machine's circuit exists, and validateWorld enforces
// it, so a miss can only be a generator bug.
func (w *World) circuitByID(id int) Circuit {
	for _, c := range w.Circuits {
		if c.ID == id {
			return c
		}
	}
	return Circuit{}
}

// renderCircuits reports each grid's power. Consumption is summed from the same
// per-machine draw the machine endpoints report, so the power view and the map
// cannot disagree.
func renderCircuits(w *World, cfg Config, t float64) []frm_models.Circuit {
	consumed := map[int]float64{}
	maxConsumed := map[int]float64{}
	produced := map[int]float64{}
	capacity := map[int]float64{}

	for i := range w.Machines {
		m := w.Machines[i]
		spec := w.machineSpec(i)

		if spec.Category == "generator" {
			g := renderGenerator(w, cfg, m, spec, t)
			produced[m.CircuitID] += g.RegulatedDemandProd
			capacity[m.CircuitID] += g.ProductionCapacity
			continue
		}
		info := renderPowerInfo(m, spec, t)
		consumed[m.CircuitID] += info.PowerConsumed
		maxConsumed[m.CircuitID] += info.MaxPowerConsumed
	}

	out := make([]frm_models.Circuit, 0, len(w.Circuits))
	for _, c := range w.Circuits {
		tripped := fuseTripped(w.Seed, c, t, cfg.Dynamics.fuseMeanPeriod())

		draw := consumed[c.ID]
		production := produced[c.ID]
		if tripped {
			draw = 0
			production = 0
		}

		percent, differential := batteryState(w.Seed, c, t, tripped)

		circuit := frm_models.Circuit{
			CircuitID:           strconv.Itoa(c.ID),
			PowerConsumed:       quantise(draw, 4),
			PowerMaxConsumed:    quantise(maxConsumed[c.ID], 4),
			PowerProduction:     quantise(production, 4),
			PowerCapacity:       quantise(capacity[c.ID], 4),
			BatteryPercent:      quantise(percent, 2),
			BatteryCapacity:     c.BatteryMWh,
			BatteryDifferential: differential,
			FuseTriggered:       tripped,
		}

		if c.HasBattery && capacity[c.ID] > 0 {
			toFull := (100 - percent) / 100 * c.BatteryMWh / math.Max(math.Abs(differential), 0.001) * 3600
			toEmpty := percent / 100 * c.BatteryMWh / math.Max(math.Abs(differential), 0.001) * 3600
			full, empty := hhmmss(toFull), hhmmss(toEmpty)
			if differential >= 0 {
				circuit.BatteryTimeFull = &full
			} else {
				circuit.BatteryTimeEmpty = &empty
			}
		}

		// A circuit reporting no production is dropped by the client, so a fully
		// tripped grid still reports its capacity as production of record.
		if circuit.PowerProduction == 0 {
			circuit.PowerProduction = quantise(capacity[c.ID], 4)
		}

		out = append(out, circuit)
	}
	return out
}

func renderCables(w *World) []frm_models.Cable {
	out := make([]frm_models.Cable, 0, len(w.Cables))
	for _, c := range w.Cables {
		out = append(out, frm_models.Cable{
			ID:         c.ID,
			Name:       c.Name,
			ClassName:  c.Class,
			Location0:  location(c.From, 0),
			Location1:  location(c.To, 0),
			Connected0: true,
			Connected1: true,
			Length:     c.Length,
		})
	}
	return out
}
