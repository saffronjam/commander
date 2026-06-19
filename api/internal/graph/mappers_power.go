package graph

import (
	"sort"

	"api/internal/graph/model"
	"api/models/models"
)

func toPowerTypeEnum(in models.PowerType) model.PowerType {
	switch in {
	case models.PowerTypeBiomass:
		return model.PowerTypeBiomass
	case models.PowerTypeCoal:
		return model.PowerTypeCoal
	case models.PowerTypeFuel:
		return model.PowerTypeFuel
	case models.PowerTypeGeothermal:
		return model.PowerTypeGeothermal
	case models.PowerTypeNuclear:
		return model.PowerTypeNuclear
	case models.PowerTypeUnknown:
		return model.PowerTypeUnknown
	default:
		return model.PowerTypeUnknown
	}
}

func toCircuitConsumption(in models.CircuitConsumption) *model.CircuitConsumption {
	return &model.CircuitConsumption{
		Total: in.Total,
		Max:   in.Max,
	}
}

func toCircuitProduction(in models.CircuitProduction) *model.CircuitProduction {
	return &model.CircuitProduction{
		Total: in.Total,
	}
}

func toCircuitCapacity(in models.CircuitCapacity) *model.CircuitCapacity {
	return &model.CircuitCapacity{
		Total: in.Total,
	}
}

func toCircuitBattery(in models.CircuitBattery) *model.CircuitBattery {
	return &model.CircuitBattery{
		Percentage:   in.Percentage,
		Capacity:     in.Capacity,
		Differential: in.Differential,
		UntilFull:    in.UntilFull,
		UntilEmpty:   in.UntilEmpty,
	}
}

func toCircuit(in models.Circuit) *model.Circuit {
	return &model.Circuit{
		ID:            in.ID,
		FuseTriggered: in.FuseTriggered,
		Consumption:   toCircuitConsumption(in.Consumption),
		Production:    toCircuitProduction(in.Production),
		Capacity:      toCircuitCapacity(in.Capacity),
		Battery:       toCircuitBattery(in.Battery),
	}
}

func toCircuits(in []models.Circuit) []*model.Circuit {
	out := make([]*model.Circuit, 0, len(in))
	for i := range in {
		out = append(out, toCircuit(in[i]))
	}
	return out
}

func toPowerInfo(in models.PowerInfo) *model.PowerInfo {
	return &model.PowerInfo{
		CircuitID:        in.CircuitID,
		CircuitGroupID:   in.CircuitGroupID,
		PowerConsumed:    in.PowerConsumed,
		MaxPowerConsumed: in.MaxPowerConsumed,
	}
}

func toPowerSource(in models.PowerSource) *model.PowerSource {
	return &model.PowerSource{
		Count:           in.Count,
		TotalProduction: in.TotalProduction,
	}
}

func toGeneratorStats(in models.GeneratorStats) *model.GeneratorStats {
	types := make([]models.PowerType, 0, len(in.Sources))
	for t := range in.Sources {
		types = append(types, t)
	}
	sort.Slice(types, func(i, j int) bool {
		return string(toPowerTypeEnum(types[i])) < string(toPowerTypeEnum(types[j]))
	})

	sources := make([]*model.PowerSourceEntry, 0, len(types))
	for _, t := range types {
		source := in.Sources[t]
		sources = append(sources, &model.PowerSourceEntry{
			Type:   toPowerTypeEnum(t),
			Source: toPowerSource(source),
		})
	}

	return &model.GeneratorStats{
		Sources: sources,
	}
}

func toMachineEfficiency(in models.MachineEfficiency) *model.MachineEfficiency {
	return &model.MachineEfficiency{
		MachinesOperating:    in.MachinesOperating,
		MachinesIdle:         in.MachinesIdle,
		MachinesPaused:       in.MachinesPaused,
		MachinesUnconfigured: in.MachinesUnconfigured,
		MachinesUnknown:      in.MachinesUnknown,
	}
}

func toFactoryStats(in models.FactoryStats) *model.FactoryStats {
	return &model.FactoryStats{
		TotalMachines: in.TotalMachines,
		Efficiency:    toMachineEfficiency(in.Efficiency),
	}
}

func toItemProdStats(in models.ItemProdStats) *model.ItemProdStats {
	return &model.ItemProdStats{
		Name:                in.Name,
		Count:               in.Count,
		ProducedPerMinute:   in.ProducedPerMinute,
		MaxProducePerMinute: in.MaxProducePerMinute,
		ProduceEfficiency:   in.ProduceEfficiency,
		ConsumedPerMinute:   in.ConsumedPerMinute,
		MaxConsumePerMinute: in.MaxConsumePerMinute,
		ConsumeEfficiency:   in.ConsumeEfficiency,
		CloudCount:          in.CloudCount,
		Minable:             in.Minable,
	}
}

func toItemProdStatsList(in []models.ItemProdStats) []*model.ItemProdStats {
	out := make([]*model.ItemProdStats, 0, len(in))
	for i := range in {
		out = append(out, toItemProdStats(in[i]))
	}
	return out
}

func toProdStats(in models.ProdStats) *model.ProdStats {
	return &model.ProdStats{
		MinableProducedPerMinute: in.MinableProducedPerMinute,
		MinableConsumedPerMinute: in.MinableConsumedPerMinute,
		ItemsProducedPerMinute:   in.ItemsProducedPerMinute,
		ItemsConsumedPerMinute:   in.ItemsConsumedPerMinute,
		Items:                    toItemProdStatsList(in.Items),
	}
}

func toSinkStats(in models.SinkStats) *model.SinkStats {
	return &model.SinkStats{
		TotalPoints:        in.TotalPoints,
		Coupons:            in.Coupons,
		NextCouponProgress: in.NextCouponProgress,
		PointsPerMinute:    in.PointsPerMinute,
	}
}
