package graph

import (
	"context"

	"api/internal/graph/model"
	"api/internal/session"
	"api/models/models"
)

func (r *queryResolver) Machines(ctx context.Context, sessionID string) ([]*model.Machine, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventMachines))
	if !ok {
		return []*model.Machine{}, nil
	}
	data, _ := v.([]models.Machine)
	return toMachines(data), nil
}

func (r *queryResolver) Storages(ctx context.Context, sessionID string) ([]*model.Storage, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventStorages))
	if !ok {
		return []*model.Storage{}, nil
	}
	data, _ := v.([]models.Storage)
	return toStorages(data), nil
}

func (r *queryResolver) Belts(ctx context.Context, sessionID string) ([]*model.Belt, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventBelts))
	if !ok {
		return []*model.Belt{}, nil
	}
	data, _ := v.(models.Belts)
	return toBelts(data.Belts), nil
}

func (r *queryResolver) SplitterMergers(ctx context.Context, sessionID string) ([]*model.SplitterMerger, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventBelts))
	if !ok {
		return []*model.SplitterMerger{}, nil
	}
	data, _ := v.(models.Belts)
	return toSplitterMergers(data.SplitterMergers), nil
}

func (r *queryResolver) Pipes(ctx context.Context, sessionID string) ([]*model.Pipe, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventPipes))
	if !ok {
		return []*model.Pipe{}, nil
	}
	data, _ := v.(models.Pipes)
	return toPipes(data.Pipes), nil
}

func (r *queryResolver) PipeJunctions(ctx context.Context, sessionID string) ([]*model.PipeJunction, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventPipes))
	if !ok {
		return []*model.PipeJunction{}, nil
	}
	data, _ := v.(models.Pipes)
	return toPipeJunctions(data.PipeJunctions), nil
}

func (r *queryResolver) Cables(ctx context.Context, sessionID string) ([]*model.Cable, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventCables))
	if !ok {
		return []*model.Cable{}, nil
	}
	data, _ := v.([]models.Cable)
	return toCables(data), nil
}

func (r *queryResolver) TrainRails(ctx context.Context, sessionID string) ([]*model.TrainRail, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventTrainRails))
	if !ok {
		return []*model.TrainRail{}, nil
	}
	data, _ := v.([]models.TrainRail)
	return toTrainRails(data), nil
}

func (r *queryResolver) Hypertubes(ctx context.Context, sessionID string) ([]*model.Hypertube, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventHypertubes))
	if !ok {
		return []*model.Hypertube{}, nil
	}
	data, _ := v.(models.Hypertubes)
	return toHypertubes(data.Hypertubes), nil
}

func (r *queryResolver) HypertubeEntrances(ctx context.Context, sessionID string) ([]*model.HypertubeEntrance, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventHypertubes))
	if !ok {
		return []*model.HypertubeEntrance{}, nil
	}
	data, _ := v.(models.Hypertubes)
	return toHypertubeEntrances(data.HypertubeEntrances), nil
}

func (r *queryResolver) SpaceElevator(ctx context.Context, sessionID string) (*model.SpaceElevator, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventSpaceElevator))
	if !ok {
		return nil, nil
	}
	se, _ := v.(*models.SpaceElevator)
	if se == nil {
		return nil, nil
	}
	return toSpaceElevator(*se), nil
}

func (r *queryResolver) Hub(ctx context.Context, sessionID string) (*model.Hub, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventHub))
	if !ok {
		return nil, nil
	}
	hub, _ := v.(*models.Hub)
	if hub == nil {
		return nil, nil
	}
	return toHub(*hub), nil
}

func (r *queryResolver) RadarTowers(ctx context.Context, sessionID string) ([]*model.RadarTower, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventRadarTowers))
	if !ok {
		return []*model.RadarTower{}, nil
	}
	data, _ := v.([]models.RadarTower)
	return toRadarTowers(data), nil
}

func (r *queryResolver) ResourceNodes(ctx context.Context, sessionID string) ([]*model.ResourceNode, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventResourceNodes))
	if !ok {
		return []*model.ResourceNode{}, nil
	}
	data, _ := v.([]models.ResourceNode)
	return toResourceNodes(data), nil
}

func (r *queryResolver) Schematics(ctx context.Context, sessionID string) ([]*model.Schematic, error) {
	sid := session.ID(sessionID)
	v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventSchematics))
	if !ok {
		return []*model.Schematic{}, nil
	}
	data, _ := v.([]models.Schematic)
	return toSchematics(data), nil
}
