package graph

import (
	"api/internal/graph/model"
	"api/models/models"
)

func toLocation(in models.Location) *model.Location {
	return &model.Location{
		X:        in.X,
		Y:        in.Y,
		Z:        in.Z,
		Rotation: in.Rotation,
	}
}

func toLocations(in []models.Location) []*model.Location {
	out := make([]*model.Location, 0, len(in))
	for i := range in {
		out = append(out, toLocation(in[i]))
	}
	return out
}

func toBoundingBox(in models.BoundingBox) *model.BoundingBox {
	return &model.BoundingBox{
		Min: toLocation(in.Min),
		Max: toLocation(in.Max),
	}
}

func toItemStats(in models.ItemStats) *model.ItemStats {
	return &model.ItemStats{
		Name:  in.Name,
		Count: in.Count,
	}
}

func toItemStatsList(in []models.ItemStats) []*model.ItemStats {
	out := make([]*model.ItemStats, 0, len(in))
	for i := range in {
		out = append(out, toItemStats(in[i]))
	}
	return out
}

func toFuel(in *models.Fuel) *model.Fuel {
	if in == nil {
		return nil
	}
	return &model.Fuel{
		Name:   in.Name,
		Amount: in.Amount,
	}
}
