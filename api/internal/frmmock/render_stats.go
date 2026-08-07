package frmmock

import (
	"api/service/frm_client/frm_models"
	"math"
)

// renderProdStats reports each item's throughput. The figures are summed from the
// same per-machine efficiency the machine endpoints report, so the production page
// and the map agree.
func renderProdStats(w *World, t float64) []frm_models.ProdStatItem {
	produced := map[string]float64{}
	consumed := map[string]float64{}

	for i := range w.Machines {
		m := w.Machines[i]
		if w.machineSpec(i).Category == "generator" {
			continue
		}
		eff := efficiency(m, t)
		if m.OutputItem != "" {
			produced[m.OutputItem] += m.OutputRate * eff
		}
		if m.InputItem != "" {
			consumed[m.InputItem] += m.InputRate * eff
		}
	}

	out := make([]frm_models.ProdStatItem, 0, len(w.Items))
	for _, f := range w.Items {
		out = append(out, frm_models.ProdStatItem{
			Name:            f.Name,
			CurrentProd:     quantise(produced[f.Name], 3),
			MaxProd:         quantise(f.MaxProducedPM, 3),
			ProdPercent:     quantise(percentOf(produced[f.Name], f.MaxProducedPM), 2),
			CurrentConsumed: quantise(consumed[f.Name], 3),
			MaxConsumed:     quantise(f.MaxConsumedPM, 3),
			ConsPercent:     quantise(percentOf(consumed[f.Name], f.MaxConsumedPM), 2),
		})
	}
	return out
}

func percentOf(current, max float64) float64 {
	if max <= 0 {
		return 0
	}
	return math.Min(100, current/max*100)
}

func renderWorldInv(w *World, t float64) []frm_models.WorldInvItem {
	out := make([]frm_models.WorldInvItem, 0, len(w.Items))
	for _, f := range w.Items {
		out = append(out, frm_models.WorldInvItem{
			Name:   f.Name,
			Amount: int(stockAt(f, t)),
		})
	}
	return out
}

// renderCloudInv reports the Dimensional Depot. Only items the factory banks a
// surplus of are uploaded, which is what a real depot holds.
func renderCloudInv(w *World, t float64) []frm_models.CloudInvItem {
	out := make([]frm_models.CloudInvItem, 0, len(w.SinkFeed))
	for _, feed := range w.SinkFeed {
		amount := 0
		for _, f := range w.Items {
			if f.Name == feed.Item {
				amount = int(math.Min(stockAt(f, t), 4800))
				break
			}
		}
		out = append(out, frm_models.CloudInvItem{
			Name:      feed.Item,
			ClassName: "Desc_" + feed.Item + "_C",
			Amount:    amount,
			MaxAmount: 4800,
		})
	}
	return out
}

// renderSink reports the AWESOME Sink. GraphPoints carries a minute-resolution
// history because the dashboard charts the curve, and a flat line reads as broken.
func renderSink(w *World, t float64) []frm_models.SinkData {
	rate := w.pointsPerMinute()
	total := sinkTotalAt(w, t)
	coupons, percent := couponsFor(total)

	const samples = 60
	graph := make([]float64, samples)
	for i := range samples {
		at := t - float64(samples-1-i)*60
		if at < 0 {
			at = 0
		}
		s := derive(w.Seed, "sinkgraph", int(at/60))
		graph[i] = quantise(rate*s.between(0.88, 1.12), 3)
	}
	graph[samples-1] = quantise(rate, 3)

	return []frm_models.SinkData{{
		TotalPoints: quantise(total, 1),
		NumCoupon:   coupons,
		Percent:     quantise(percent, 2),
		GraphPoints: graph,
	}}
}
