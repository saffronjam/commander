package graph

import (
	"context"

	"api/internal/graph/model"
	"api/internal/session"
	"api/models/models"
)

func (r *queryResolver) SatisfactoryAPIStatus(ctx context.Context, sessionID string) (*model.SatisfactoryAPIStatus, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventApiStatus))
	if !ok {
		return toSatisfactoryApiStatus(models.SatisfactoryApiStatus{}), nil
	}
	s, _ := v.(*models.SatisfactoryApiStatus)
	if s == nil {
		return toSatisfactoryApiStatus(models.SatisfactoryApiStatus{}), nil
	}
	return toSatisfactoryApiStatus(*s), nil
}

func (r *queryResolver) Connectivity(ctx context.Context, sessionID string) (*model.ConnectivityStatus, error) {
	sid := session.ID(sessionID)
	cs := r.Snapshot.Connectivity(sid)
	return toConnectivityStatus(cs.IsOnline, cs.IsDisconnected, cs.Stage), nil
}

func (r *queryResolver) FactoryStats(ctx context.Context, sessionID string) (*model.FactoryStats, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventFactoryStats))
	if !ok {
		return toFactoryStats(models.FactoryStats{}), nil
	}
	fs, _ := v.(*models.FactoryStats)
	if fs == nil {
		return toFactoryStats(models.FactoryStats{}), nil
	}
	return toFactoryStats(*fs), nil
}

func (r *queryResolver) ProdStats(ctx context.Context, sessionID string) (*model.ProdStats, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventProdStats))
	if !ok {
		return toProdStats(models.ProdStats{}), nil
	}
	ps, _ := v.(*models.ProdStats)
	if ps == nil {
		return toProdStats(models.ProdStats{}), nil
	}
	return toProdStats(*ps), nil
}

func (r *queryResolver) GeneratorStats(ctx context.Context, sessionID string) (*model.GeneratorStats, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventGeneratorStats))
	if !ok {
		return toGeneratorStats(models.GeneratorStats{}), nil
	}
	gs, _ := v.(*models.GeneratorStats)
	if gs == nil {
		return toGeneratorStats(models.GeneratorStats{}), nil
	}
	return toGeneratorStats(*gs), nil
}

func (r *queryResolver) SinkStats(ctx context.Context, sessionID string) (*model.SinkStats, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventSinkStats))
	if !ok {
		return toSinkStats(models.SinkStats{}), nil
	}
	ss, _ := v.(*models.SinkStats)
	if ss == nil {
		return toSinkStats(models.SinkStats{}), nil
	}
	return toSinkStats(*ss), nil
}

func (r *queryResolver) Circuits(ctx context.Context, sessionID string) ([]*model.Circuit, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventCircuits))
	if !ok {
		return []*model.Circuit{}, nil
	}
	data, _ := v.([]models.Circuit)
	return toCircuits(data), nil
}

func (r *queryResolver) Players(ctx context.Context, sessionID string) ([]*model.Player, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventPlayers))
	if !ok {
		return []*model.Player{}, nil
	}
	data, _ := v.([]models.Player)
	return toPlayers(data), nil
}

func (r *queryResolver) Drones(ctx context.Context, sessionID string) ([]*model.Drone, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehicles))
	if !ok {
		return []*model.Drone{}, nil
	}
	veh, _ := v.(models.Vehicles)
	return toDrones(veh.Drones), nil
}

func (r *queryResolver) DroneStations(ctx context.Context, sessionID string) ([]*model.DroneStation, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehicleStations))
	if !ok {
		return []*model.DroneStation{}, nil
	}
	st, _ := v.(models.VehicleStations)
	return toDroneStations(st.DroneStations), nil
}

func (r *queryResolver) Trains(ctx context.Context, sessionID string) ([]*model.Train, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehicles))
	if !ok {
		return []*model.Train{}, nil
	}
	veh, _ := v.(models.Vehicles)
	return toTrains(veh.Trains), nil
}

func (r *queryResolver) TrainStations(ctx context.Context, sessionID string) ([]*model.TrainStation, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehicleStations))
	if !ok {
		return []*model.TrainStation{}, nil
	}
	st, _ := v.(models.VehicleStations)
	return toTrainStations(st.TrainStations), nil
}

func (r *queryResolver) Trucks(ctx context.Context, sessionID string) ([]*model.Truck, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehicles))
	if !ok {
		return []*model.Truck{}, nil
	}
	veh, _ := v.(models.Vehicles)
	return toTrucks(veh.Trucks), nil
}

func (r *queryResolver) TruckStations(ctx context.Context, sessionID string) ([]*model.TruckStation, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehicleStations))
	if !ok {
		return []*model.TruckStation{}, nil
	}
	st, _ := v.(models.VehicleStations)
	return toTruckStations(st.TruckStations), nil
}

func (r *queryResolver) Tractors(ctx context.Context, sessionID string) ([]*model.Tractor, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventTractors))
	if !ok {
		return []*model.Tractor{}, nil
	}
	data, _ := v.([]models.Tractor)
	return toTractors(data), nil
}

func (r *queryResolver) Explorers(ctx context.Context, sessionID string) ([]*model.Explorer, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventExplorers))
	if !ok {
		return []*model.Explorer{}, nil
	}
	data, _ := v.([]models.Explorer)
	return toExplorers(data), nil
}

func (r *queryResolver) VehiclePaths(ctx context.Context, sessionID string) ([]*model.VehiclePath, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehiclePaths))
	if !ok {
		return []*model.VehiclePath{}, nil
	}
	data, _ := v.([]models.VehiclePath)
	return toVehiclePaths(data), nil
}
