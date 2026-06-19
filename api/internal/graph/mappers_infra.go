package graph

import (
	"api/internal/graph/model"
	"api/models/models"
)

func toMachineTypeEnum(in models.MachineType) model.MachineType {
	switch in {
	case models.MachineTypeAssembler:
		return model.MachineTypeAssembler
	case models.MachineTypeConstructor:
		return model.MachineTypeConstructor
	case models.MachineTypeFoundry:
		return model.MachineTypeFoundry
	case models.MachineTypeManufacturer:
		return model.MachineTypeManufacturer
	case models.MachineTypeRefinery:
		return model.MachineTypeRefinery
	case models.MachineTypeSmelter:
		return model.MachineTypeSmelter
	case models.MachineTypeBlender:
		return model.MachineTypeBlender
	case models.MachineTypePackager:
		return model.MachineTypePackager
	case models.MachineTypeParticleAccelerator:
		return model.MachineTypeParticleAccelerator
	case models.MachineTypeMiner:
		return model.MachineTypeMiner
	case models.MachineTypeOilExtractor:
		return model.MachineTypeOilExtractor
	case models.MachineTypeWaterExtractor:
		return model.MachineTypeWaterExtractor
	case models.MachineTypeBiomassBurner:
		return model.MachineTypeBiomassBurner
	case models.MachineTypeCoalGenerator:
		return model.MachineTypeCoalGenerator
	case models.MachineTypeFuelGenerator:
		return model.MachineTypeFuelGenerator
	case models.MachineTypeGeothermalGenerator:
		return model.MachineTypeGeothermalGenerator
	case models.MachineTypeNuclearPowerPlant:
		return model.MachineTypeNuclearPowerPlant
	default:
		return model.MachineType("")
	}
}

func toMachineCategoryEnum(in models.MachineCategory) model.MachineCategory {
	switch in {
	case models.MachineCategoryFactory:
		return model.MachineCategoryFactory
	case models.MachineCategoryExtractor:
		return model.MachineCategoryExtractor
	case models.MachineCategoryGenerator:
		return model.MachineCategoryGenerator
	default:
		return model.MachineCategory("")
	}
}

func toMachineStatusEnum(in models.MachineStatus) model.MachineStatus {
	switch in {
	case models.MachineStatusOperating:
		return model.MachineStatusOperating
	case models.MachineStatusIdle:
		return model.MachineStatusIdle
	case models.MachineStatusPaused:
		return model.MachineStatusPaused
	case models.MachineStatusUnconfigured:
		return model.MachineStatusUnconfigured
	case models.MachineStatusUnknown:
		return model.MachineStatusUnknown
	default:
		return model.MachineStatusUnknown
	}
}

func toStorageTypeEnum(in models.StorageType) model.StorageType {
	switch in {
	case models.StorageTypeBlueprintStorageBox:
		return model.StorageTypeBlueprintStorageBox
	case models.StorageTypeDimensionalDepotUploader:
		return model.StorageTypeDimensionalDepotUploader
	case models.StorageTypeIndustrialStorageContainer:
		return model.StorageTypeIndustrialStorageContainer
	case models.StorageTypePersonalStorageBox:
		return model.StorageTypePersonalStorageBox
	case models.StorageTypeStorageContainer:
		return model.StorageTypeStorageContainer
	default:
		return model.StorageType("")
	}
}

func toSplitterMergerTypeEnum(in models.SplitterMergerType) model.SplitterMergerType {
	switch in {
	case models.SplitterMergerTypeConveyorMerger:
		return model.SplitterMergerTypeConveyorMerger
	case models.SplitterMergerTypeConveyorSplitter:
		return model.SplitterMergerTypeConveyorSplitter
	case models.SplitterMergerTypeProgrammableSplitter:
		return model.SplitterMergerTypeProgrammableSplitter
	case models.SplitterMergerTypeSmartSplitter:
		return model.SplitterMergerTypeSmartSplitter
	default:
		return model.SplitterMergerType("")
	}
}

func toTrainRailTypeEnum(in models.TrainRailType) model.TrainRailType {
	switch in {
	case models.TrainRailTypeRailway:
		return model.TrainRailTypeRailway
	default:
		return model.TrainRailType("")
	}
}

func toMachineProdStats(in models.MachineProdStats) *model.MachineProdStats {
	return &model.MachineProdStats{
		Name:       in.Name,
		Stored:     in.Stored,
		Current:    in.Current,
		Max:        in.Max,
		Efficiency: in.Efficiency,
	}
}

func toMachineProdStatsList(in []models.MachineProdStats) []*model.MachineProdStats {
	out := make([]*model.MachineProdStats, len(in))
	for i := range in {
		out[i] = toMachineProdStats(in[i])
	}
	return out
}

func toMachine(in models.Machine) *model.Machine {
	return &model.Machine{
		Type:           toMachineTypeEnum(in.Type),
		Status:         toMachineStatusEnum(in.Status),
		Category:       toMachineCategoryEnum(in.Category),
		Productivity:   in.Productivity,
		Input:          toMachineProdStatsList(in.Input),
		Output:         toMachineProdStatsList(in.Output),
		BoundingBox:    toBoundingBox(in.BoundingBox),
		X:              in.X,
		Y:              in.Y,
		Z:              in.Z,
		Rotation:       in.Rotation,
		CircuitID:      in.CircuitID,
		CircuitGroupID: in.CircuitGroupID,
	}
}

func toMachines(in []models.Machine) []*model.Machine {
	out := make([]*model.Machine, len(in))
	for i := range in {
		out[i] = toMachine(in[i])
	}
	return out
}

func toStorage(in models.Storage) *model.Storage {
	return &model.Storage{
		ID:          in.ID,
		Type:        toStorageTypeEnum(in.Type),
		Inventory:   toItemStatsList(in.Inventory),
		BoundingBox: toBoundingBox(in.BoundingBox),
		X:           in.X,
		Y:           in.Y,
		Z:           in.Z,
		Rotation:    in.Rotation,
	}
}

func toStorages(in []models.Storage) []*model.Storage {
	out := make([]*model.Storage, len(in))
	for i := range in {
		out[i] = toStorage(in[i])
	}
	return out
}

func toBelt(in models.Belt) *model.Belt {
	return &model.Belt{
		ID:             in.ID,
		Name:           in.Name,
		Location0:      toLocation(in.Location0),
		Location1:      toLocation(in.Location1),
		Connected0:     in.Connected0,
		Connected1:     in.Connected1,
		SplineData:     toLocations(in.SplineData),
		Length:         in.Length,
		ItemsPerMinute: in.ItemsPerMinute,
	}
}

func toBelts(in []models.Belt) []*model.Belt {
	out := make([]*model.Belt, len(in))
	for i := range in {
		out[i] = toBelt(in[i])
	}
	return out
}

func toSplitterMerger(in models.SplitterMerger) *model.SplitterMerger {
	return &model.SplitterMerger{
		ID:          in.ID,
		Type:        toSplitterMergerTypeEnum(in.Type),
		X:           in.X,
		Y:           in.Y,
		Z:           in.Z,
		Rotation:    in.Rotation,
		BoundingBox: toBoundingBox(in.BoundingBox),
	}
}

func toSplitterMergers(in []models.SplitterMerger) []*model.SplitterMerger {
	out := make([]*model.SplitterMerger, len(in))
	for i := range in {
		out[i] = toSplitterMerger(in[i])
	}
	return out
}

func toPipe(in models.Pipe) *model.Pipe {
	return &model.Pipe{
		ID:             in.ID,
		Name:           in.Name,
		Location0:      toLocation(in.Location0),
		Location1:      toLocation(in.Location1),
		Connected0:     in.Connected0,
		Connected1:     in.Connected1,
		SplineData:     toLocations(in.SplineData),
		Length:         in.Length,
		ItemsPerMinute: in.ItemsPerMinute,
	}
}

func toPipes(in []models.Pipe) []*model.Pipe {
	out := make([]*model.Pipe, len(in))
	for i := range in {
		out[i] = toPipe(in[i])
	}
	return out
}

func toPipeJunction(in models.PipeJunction) *model.PipeJunction {
	return &model.PipeJunction{
		ID:       in.ID,
		Name:     in.Name,
		X:        in.X,
		Y:        in.Y,
		Z:        in.Z,
		Rotation: in.Rotation,
	}
}

func toPipeJunctions(in []models.PipeJunction) []*model.PipeJunction {
	out := make([]*model.PipeJunction, len(in))
	for i := range in {
		out[i] = toPipeJunction(in[i])
	}
	return out
}

func toCable(in models.Cable) *model.Cable {
	return &model.Cable{
		ID:         in.ID,
		Name:       in.Name,
		Location0:  toLocation(in.Location0),
		Location1:  toLocation(in.Location1),
		Connected0: in.Connected0,
		Connected1: in.Connected1,
		Length:     in.Length,
	}
}

func toCables(in []models.Cable) []*model.Cable {
	out := make([]*model.Cable, len(in))
	for i := range in {
		out[i] = toCable(in[i])
	}
	return out
}

func toTrainRail(in models.TrainRail) *model.TrainRail {
	return &model.TrainRail{
		ID:         in.ID,
		Type:       toTrainRailTypeEnum(in.Type),
		Location0:  toLocation(in.Location0),
		Location1:  toLocation(in.Location1),
		Connected0: in.Connected0,
		Connected1: in.Connected1,
		SplineData: toLocations(in.SplineData),
		Length:     in.Length,
	}
}

func toTrainRails(in []models.TrainRail) []*model.TrainRail {
	out := make([]*model.TrainRail, len(in))
	for i := range in {
		out[i] = toTrainRail(in[i])
	}
	return out
}

func toHypertube(in models.Hypertube) *model.Hypertube {
	return &model.Hypertube{
		ID:          in.ID,
		Location0:   toLocation(in.Location0),
		Location1:   toLocation(in.Location1),
		SplineData:  toLocations(in.SplineData),
		BoundingBox: toBoundingBox(in.BoundingBox),
	}
}

func toHypertubes(in []models.Hypertube) []*model.Hypertube {
	out := make([]*model.Hypertube, len(in))
	for i := range in {
		out[i] = toHypertube(in[i])
	}
	return out
}

func toHypertubeEntrance(in models.HypertubeEntrance) *model.HypertubeEntrance {
	return &model.HypertubeEntrance{
		ID:          in.ID,
		X:           in.X,
		Y:           in.Y,
		Z:           in.Z,
		Rotation:    in.Rotation,
		BoundingBox: toBoundingBox(in.BoundingBox),
		PowerInfo:   toPowerInfo(in.PowerInfo),
	}
}

func toHypertubeEntrances(in []models.HypertubeEntrance) []*model.HypertubeEntrance {
	out := make([]*model.HypertubeEntrance, len(in))
	for i := range in {
		out[i] = toHypertubeEntrance(in[i])
	}
	return out
}
