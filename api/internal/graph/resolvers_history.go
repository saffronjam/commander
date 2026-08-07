package graph

import (
	"context"
	"encoding/json"

	"api/internal/graph/model"
	"api/internal/session"
	"api/internal/store"
	"api/models/models"
)

// maxHistoryPoints bounds every history response. An unbounded query would scan
// and serialize the whole retention window, so the cap applies even when the
// client asks for no downsampling.
const maxHistoryPoints = 2000

// historyQuery builds the bounded store query shared by every history resolver.
func historyQuery(sessionID string, dataType models.SatisfactoryEventType, since, bucketSeconds *int) store.HistoryQuery {
	sinceID := int64(-1)
	if since != nil {
		sinceID = int64(*since)
	}
	bucket := 0
	if bucketSeconds != nil && *bucketSeconds > 1 {
		bucket = *bucketSeconds
	}
	return store.HistoryQuery{
		SessionID:     session.ID(sessionID),
		DataType:      string(dataType),
		Since:         sinceID,
		Limit:         maxHistoryPoints,
		BucketSeconds: bucket,
	}
}

func (r *queryResolver) CircuitsHistory(ctx context.Context, sessionID string, since *int, bucketSeconds *int) ([]*model.CircuitsHistoryPoint, error) {
	q := historyQuery(sessionID, models.SatisfactoryEventCircuits, since, bucketSeconds)
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

func (r *queryResolver) FactoryStatsHistory(ctx context.Context, sessionID string, since *int, bucketSeconds *int) ([]*model.FactoryStatsHistoryPoint, error) {
	q := historyQuery(sessionID, models.SatisfactoryEventFactoryStats, since, bucketSeconds)
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

func (r *queryResolver) ProdStatsHistory(ctx context.Context, sessionID string, since *int, bucketSeconds *int) ([]*model.ProdStatsHistoryPoint, error) {
	q := historyQuery(sessionID, models.SatisfactoryEventProdStats, since, bucketSeconds)
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

func (r *queryResolver) GeneratorStatsHistory(ctx context.Context, sessionID string, since *int, bucketSeconds *int) ([]*model.GeneratorStatsHistoryPoint, error) {
	q := historyQuery(sessionID, models.SatisfactoryEventGeneratorStats, since, bucketSeconds)
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

func (r *queryResolver) SinkStatsHistory(ctx context.Context, sessionID string, since *int, bucketSeconds *int) ([]*model.SinkStatsHistoryPoint, error) {
	q := historyQuery(sessionID, models.SatisfactoryEventSinkStats, since, bucketSeconds)
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
