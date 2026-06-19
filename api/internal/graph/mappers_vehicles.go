package graph

import (
	"api/internal/graph/model"
	"api/models/models"
)

func toDroneStatusEnum(in models.DroneStatus) model.DroneStatus {
	switch in {
	case models.DroneStatusIdle:
		return model.DroneStatusIdle
	case models.DroneStatusFlying:
		return model.DroneStatusFlying
	case models.DroneStatusDocking:
		return model.DroneStatusDocking
	default:
		return model.DroneStatusIdle
	}
}

func toTrainTypeEnum(in models.TrainType) model.TrainType {
	switch in {
	case models.TrainTypeFreight:
		return model.TrainTypeFreight
	case models.TrainTypeLocomotive:
		return model.TrainTypeLocomotive
	default:
		return model.TrainTypeFreight
	}
}

func toTrainStatusEnum(in models.TrainStatus) model.TrainStatus {
	switch in {
	case models.TrainStatusSelfDriving:
		return model.TrainStatusSelfDriving
	case models.TrainStatusManualDriving:
		return model.TrainStatusManualDriving
	case models.TrainStatusParked:
		return model.TrainStatusParked
	case models.TrainStatusDocking:
		return model.TrainStatusDocking
	case models.TrainStatusDerailed:
		return model.TrainStatusDerailed
	case models.TrainStatusUnknown:
		return model.TrainStatusUnknown
	default:
		return model.TrainStatusUnknown
	}
}

func toTrainStationPlatformTypeEnum(in models.TrainStationPlatformType) model.TrainStationPlatformType {
	switch in {
	case models.TrainStationPlatformTypeFreight:
		return model.TrainStationPlatformTypeFreight
	case models.TrainStationPlatformTypeFluidFreight:
		return model.TrainStationPlatformTypeFluidFreight
	default:
		return model.TrainStationPlatformTypeFreight
	}
}

func toTrainStationPlatformModeEnum(in models.TrainStationPlatformMode) model.TrainStationPlatformMode {
	switch in {
	case models.TrainStationPlatformModeImport:
		return model.TrainStationPlatformModeImport
	case models.TrainStationPlatformModeExport:
		return model.TrainStationPlatformModeExport
	default:
		return model.TrainStationPlatformModeImport
	}
}

func toTrainStationPlatformStatusEnum(in models.TrainStationPlatformStatus) model.TrainStationPlatformStatus {
	switch in {
	case models.TrainStationPlatformStatusIdle:
		return model.TrainStationPlatformStatusIdle
	case models.TrainStationPlatformStatusDocking:
		return model.TrainStationPlatformStatusDocking
	default:
		return model.TrainStationPlatformStatusIdle
	}
}

func toTruckStatusEnum(in models.TruckStatus) model.TruckStatus {
	switch in {
	case models.TruckStatusSelfDriving:
		return model.TruckStatusSelfDriving
	case models.TruckStatusManualDriving:
		return model.TruckStatusManualDriving
	case models.TruckStatusParked:
		return model.TruckStatusParked
	case models.TruckStatusUnknown:
		return model.TruckStatusUnknown
	default:
		return model.TruckStatusUnknown
	}
}

func toTractorStatusEnum(in models.TractorStatus) model.TractorStatus {
	switch in {
	case models.TractorStatusSelfDriving:
		return model.TractorStatusSelfDriving
	case models.TractorStatusManualDriving:
		return model.TractorStatusManualDriving
	case models.TractorStatusParked:
		return model.TractorStatusParked
	case models.TractorStatusUnknown:
		return model.TractorStatusUnknown
	default:
		return model.TractorStatusUnknown
	}
}

func toExplorerStatusEnum(in models.ExplorerStatus) model.ExplorerStatus {
	switch in {
	case models.ExplorerStatusSelfDriving:
		return model.ExplorerStatusSelfDriving
	case models.ExplorerStatusManualDriving:
		return model.ExplorerStatusManualDriving
	case models.ExplorerStatusParked:
		return model.ExplorerStatusParked
	case models.ExplorerStatusUnknown:
		return model.ExplorerStatusUnknown
	default:
		return model.ExplorerStatusUnknown
	}
}

func toVehiclePathTypeEnum(in models.VehiclePathType) model.VehiclePathType {
	switch in {
	case models.VehiclePathTypeExplorer:
		return model.VehiclePathTypeExplorer
	case models.VehiclePathTypeFactoryCart:
		return model.VehiclePathTypeFactoryCart
	case models.VehiclePathTypeTruck:
		return model.VehiclePathTypeTruck
	case models.VehiclePathTypeTractor:
		return model.VehiclePathTypeTractor
	default:
		return model.VehiclePathTypeExplorer
	}
}

func toDroneStation(in models.DroneStation) *model.DroneStation {
	return &model.DroneStation{
		Name:            in.Name,
		Fuel:            toFuel(in.Fuel),
		BoundingBox:     toBoundingBox(in.BoundingBox),
		IncomingRate:    in.IncomingRate,
		OutgoingRate:    in.OutgoingRate,
		InputInventory:  toItemStatsList(in.InputInventory),
		OutputInventory: toItemStatsList(in.OutputInventory),
		X:               in.X,
		Y:               in.Y,
		Z:               in.Z,
		Rotation:        in.Rotation,
		CircuitID:       in.CircuitID,
		CircuitGroupID:  in.CircuitGroupID,
	}
}

func toDroneStations(in []models.DroneStation) []*model.DroneStation {
	out := make([]*model.DroneStation, 0, len(in))
	for i := range in {
		out = append(out, toDroneStation(in[i]))
	}
	return out
}

func toDrone(in models.Drone) *model.Drone {
	var paired *model.DroneStation
	if in.Paired != nil {
		paired = toDroneStation(*in.Paired)
	}
	var destination *model.DroneStation
	if in.Destination != nil {
		destination = toDroneStation(*in.Destination)
	}
	return &model.Drone{
		Name:           in.Name,
		Speed:          in.Speed,
		Status:         toDroneStatusEnum(in.Status),
		Home:           toDroneStation(in.Home),
		Paired:         paired,
		Destination:    destination,
		X:              in.X,
		Y:              in.Y,
		Z:              in.Z,
		Rotation:       in.Rotation,
		CircuitID:      in.CircuitID,
		CircuitGroupID: in.CircuitGroupID,
	}
}

func toDrones(in []models.Drone) []*model.Drone {
	out := make([]*model.Drone, 0, len(in))
	for i := range in {
		out = append(out, toDrone(in[i]))
	}
	return out
}

func toTrainVehicle(in models.TrainVehicle) *model.TrainVehicle {
	return &model.TrainVehicle{
		Type:      toTrainTypeEnum(in.Type),
		Capacity:  in.Capacity,
		Inventory: toItemStatsList(in.Inventory),
	}
}

func toTrainVehicles(in []models.TrainVehicle) []*model.TrainVehicle {
	out := make([]*model.TrainVehicle, 0, len(in))
	for i := range in {
		out = append(out, toTrainVehicle(in[i]))
	}
	return out
}

func toTrainTimetableEntry(in models.TrainTimetableEntry) *model.TrainTimetableEntry {
	return &model.TrainTimetableEntry{
		Station: in.Station,
	}
}

func toTrainTimetableEntries(in []models.TrainTimetableEntry) []*model.TrainTimetableEntry {
	out := make([]*model.TrainTimetableEntry, 0, len(in))
	for i := range in {
		out = append(out, toTrainTimetableEntry(in[i]))
	}
	return out
}

func toTrain(in models.Train) *model.Train {
	return &model.Train{
		ID:               in.ID,
		Name:             in.Name,
		Speed:            in.Speed,
		Status:           toTrainStatusEnum(in.Status),
		PowerConsumption: in.PowerConsumption,
		Vehicles:         toTrainVehicles(in.Vehicles),
		Timetable:        toTrainTimetableEntries(in.Timetable),
		TimetableIndex:   in.TimetableIndex,
		X:                in.X,
		Y:                in.Y,
		Z:                in.Z,
		Rotation:         in.Rotation,
		CircuitID:        in.CircuitID,
		CircuitGroupID:   in.CircuitGroupID,
	}
}

func toTrains(in []models.Train) []*model.Train {
	out := make([]*model.Train, 0, len(in))
	for i := range in {
		out = append(out, toTrain(in[i]))
	}
	return out
}

func toTrainStationPlatform(in models.TrainStationPlatform) *model.TrainStationPlatform {
	return &model.TrainStationPlatform{
		ID:           in.ID,
		Type:         toTrainStationPlatformTypeEnum(in.Type),
		Mode:         toTrainStationPlatformModeEnum(in.Mode),
		Status:       toTrainStationPlatformStatusEnum(in.Status),
		BoundingBox:  toBoundingBox(in.BoundingBox),
		Inventory:    toItemStatsList(in.Inventory),
		TransferRate: in.TransferRate,
		InflowRate:   in.InflowRate,
		OutflowRate:  in.OutflowRate,
		X:            in.X,
		Y:            in.Y,
		Z:            in.Z,
		Rotation:     in.Rotation,
	}
}

func toTrainStationPlatforms(in []models.TrainStationPlatform) []*model.TrainStationPlatform {
	out := make([]*model.TrainStationPlatform, 0, len(in))
	for i := range in {
		out = append(out, toTrainStationPlatform(in[i]))
	}
	return out
}

func toTrainStation(in models.TrainStation) *model.TrainStation {
	return &model.TrainStation{
		Name:           in.Name,
		BoundingBox:    toBoundingBox(in.BoundingBox),
		Platforms:      toTrainStationPlatforms(in.Platforms),
		X:              in.X,
		Y:              in.Y,
		Z:              in.Z,
		Rotation:       in.Rotation,
		CircuitID:      in.CircuitID,
		CircuitGroupID: in.CircuitGroupID,
	}
}

func toTrainStations(in []models.TrainStation) []*model.TrainStation {
	out := make([]*model.TrainStation, 0, len(in))
	for i := range in {
		out = append(out, toTrainStation(in[i]))
	}
	return out
}

func toTruck(in models.Truck) *model.Truck {
	return &model.Truck{
		ID:             in.ID,
		Name:           in.Name,
		Speed:          in.Speed,
		Status:         toTruckStatusEnum(in.Status),
		Fuel:           toFuel(in.Fuel),
		Inventory:      toItemStatsList(in.Inventory),
		X:              in.X,
		Y:              in.Y,
		Z:              in.Z,
		Rotation:       in.Rotation,
		CircuitID:      in.CircuitID,
		CircuitGroupID: in.CircuitGroupID,
	}
}

func toTrucks(in []models.Truck) []*model.Truck {
	out := make([]*model.Truck, 0, len(in))
	for i := range in {
		out = append(out, toTruck(in[i]))
	}
	return out
}

func toTruckStation(in models.TruckStation) *model.TruckStation {
	return &model.TruckStation{
		Name:            in.Name,
		BoundingBox:     toBoundingBox(in.BoundingBox),
		TransferRate:    in.TransferRate,
		MaxTransferRate: in.MaxTransferRate,
		Inventory:       toItemStatsList(in.Inventory),
		X:               in.X,
		Y:               in.Y,
		Z:               in.Z,
		Rotation:        in.Rotation,
		CircuitID:       in.CircuitID,
		CircuitGroupID:  in.CircuitGroupID,
	}
}

func toTruckStations(in []models.TruckStation) []*model.TruckStation {
	out := make([]*model.TruckStation, 0, len(in))
	for i := range in {
		out = append(out, toTruckStation(in[i]))
	}
	return out
}

func toTractor(in models.Tractor) *model.Tractor {
	return &model.Tractor{
		ID:             in.ID,
		Name:           in.Name,
		Speed:          in.Speed,
		Status:         toTractorStatusEnum(in.Status),
		Fuel:           toFuel(in.Fuel),
		Inventory:      toItemStatsList(in.Inventory),
		X:              in.X,
		Y:              in.Y,
		Z:              in.Z,
		Rotation:       in.Rotation,
		CircuitID:      in.CircuitID,
		CircuitGroupID: in.CircuitGroupID,
	}
}

func toTractors(in []models.Tractor) []*model.Tractor {
	out := make([]*model.Tractor, 0, len(in))
	for i := range in {
		out = append(out, toTractor(in[i]))
	}
	return out
}

func toExplorer(in models.Explorer) *model.Explorer {
	return &model.Explorer{
		ID:             in.ID,
		Name:           in.Name,
		Speed:          in.Speed,
		Status:         toExplorerStatusEnum(in.Status),
		Fuel:           toFuel(in.Fuel),
		Inventory:      toItemStatsList(in.Inventory),
		X:              in.X,
		Y:              in.Y,
		Z:              in.Z,
		Rotation:       in.Rotation,
		CircuitID:      in.CircuitID,
		CircuitGroupID: in.CircuitGroupID,
	}
}

func toExplorers(in []models.Explorer) []*model.Explorer {
	out := make([]*model.Explorer, 0, len(in))
	for i := range in {
		out = append(out, toExplorer(in[i]))
	}
	return out
}

func toVehiclePath(in models.VehiclePath) *model.VehiclePath {
	return &model.VehiclePath{
		Name:        in.Name,
		VehicleType: toVehiclePathTypeEnum(in.VehicleType),
		PathLength:  in.PathLength,
		Vertices:    toLocations(in.Vertices),
	}
}

func toVehiclePaths(in []models.VehiclePath) []*model.VehiclePath {
	out := make([]*model.VehiclePath, 0, len(in))
	for i := range in {
		out = append(out, toVehiclePath(in[i]))
	}
	return out
}
