package graph

import (
	"context"
	"encoding/json"

	"api/internal/graph/model"
	"api/internal/session"
	"api/internal/store"
	"api/models/models"
)

func (r *queryResolver) HistorySaves(ctx context.Context, sessionID string) ([]string, error) {
	saves, err := r.Store.ListHistorySaves(ctx, session.ID(sessionID))
	if err != nil {
		return nil, err
	}
	if saves == nil {
		return []string{}, nil
	}
	return saves, nil
}

func (r *queryResolver) CircuitsHistory(ctx context.Context, sessionID string, saveName string, since *int, maxPoints *int) ([]*model.CircuitsHistoryPoint, error) {
	sinceID := int64(-1)
	if since != nil {
		sinceID = int64(*since)
	}
	q := store.HistoryQuery{SessionID: session.ID(sessionID), SaveName: saveName, DataType: string(models.SatisfactoryEventCircuits), Since: sinceID}
	pts, err := r.Store.QueryHistory(ctx, q)
	if err != nil {
		return nil, err
	}
	out := make([]*model.CircuitsHistoryPoint, 0, len(pts))
	for _, p := range pts {
		var d []models.Circuit
		if err := json.Unmarshal(p.Data, &d); err != nil {
			continue
		}
		out = append(out, &model.CircuitsHistoryPoint{GameTimeID: int(p.GameTimeID), Circuits: toCircuits(d)})
	}
	return out, nil
}

func (r *queryResolver) FactoryStatsHistory(ctx context.Context, sessionID string, saveName string, since *int, maxPoints *int) ([]*model.FactoryStatsHistoryPoint, error) {
	sinceID := int64(-1)
	if since != nil {
		sinceID = int64(*since)
	}
	q := store.HistoryQuery{SessionID: session.ID(sessionID), SaveName: saveName, DataType: string(models.SatisfactoryEventFactoryStats), Since: sinceID}
	pts, err := r.Store.QueryHistory(ctx, q)
	if err != nil {
		return nil, err
	}
	out := make([]*model.FactoryStatsHistoryPoint, 0, len(pts))
	for _, p := range pts {
		var d models.FactoryStats
		if err := json.Unmarshal(p.Data, &d); err != nil {
			continue
		}
		out = append(out, &model.FactoryStatsHistoryPoint{GameTimeID: int(p.GameTimeID), FactoryStats: toFactoryStats(d)})
	}
	return out, nil
}

func (r *queryResolver) ProdStatsHistory(ctx context.Context, sessionID string, saveName string, since *int, maxPoints *int) ([]*model.ProdStatsHistoryPoint, error) {
	sinceID := int64(-1)
	if since != nil {
		sinceID = int64(*since)
	}
	q := store.HistoryQuery{SessionID: session.ID(sessionID), SaveName: saveName, DataType: string(models.SatisfactoryEventProdStats), Since: sinceID}
	pts, err := r.Store.QueryHistory(ctx, q)
	if err != nil {
		return nil, err
	}
	out := make([]*model.ProdStatsHistoryPoint, 0, len(pts))
	for _, p := range pts {
		var d models.ProdStats
		if err := json.Unmarshal(p.Data, &d); err != nil {
			continue
		}
		out = append(out, &model.ProdStatsHistoryPoint{GameTimeID: int(p.GameTimeID), ProdStats: toProdStats(d)})
	}
	return out, nil
}

func (r *queryResolver) GeneratorStatsHistory(ctx context.Context, sessionID string, saveName string, since *int, maxPoints *int) ([]*model.GeneratorStatsHistoryPoint, error) {
	sinceID := int64(-1)
	if since != nil {
		sinceID = int64(*since)
	}
	q := store.HistoryQuery{SessionID: session.ID(sessionID), SaveName: saveName, DataType: string(models.SatisfactoryEventGeneratorStats), Since: sinceID}
	pts, err := r.Store.QueryHistory(ctx, q)
	if err != nil {
		return nil, err
	}
	out := make([]*model.GeneratorStatsHistoryPoint, 0, len(pts))
	for _, p := range pts {
		var d models.GeneratorStats
		if err := json.Unmarshal(p.Data, &d); err != nil {
			continue
		}
		out = append(out, &model.GeneratorStatsHistoryPoint{GameTimeID: int(p.GameTimeID), GeneratorStats: toGeneratorStats(d)})
	}
	return out, nil
}

func (r *queryResolver) SinkStatsHistory(ctx context.Context, sessionID string, saveName string, since *int, maxPoints *int) ([]*model.SinkStatsHistoryPoint, error) {
	sinceID := int64(-1)
	if since != nil {
		sinceID = int64(*since)
	}
	q := store.HistoryQuery{SessionID: session.ID(sessionID), SaveName: saveName, DataType: string(models.SatisfactoryEventSinkStats), Since: sinceID}
	pts, err := r.Store.QueryHistory(ctx, q)
	if err != nil {
		return nil, err
	}
	out := make([]*model.SinkStatsHistoryPoint, 0, len(pts))
	for _, p := range pts {
		var d models.SinkStats
		if err := json.Unmarshal(p.Data, &d); err != nil {
			continue
		}
		out = append(out, &model.SinkStatsHistoryPoint{GameTimeID: int(p.GameTimeID), SinkStats: toSinkStats(d)})
	}
	return out, nil
}
