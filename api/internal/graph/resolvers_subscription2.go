package graph

import (
	"context"

	"api/internal/session"
	"api/models/models"
	"api/pkg/eventbus"

	"api/internal/graph/model"
)

func (r *subscriptionResolver) MachinesChanged(ctx context.Context, sessionID string) (<-chan []*model.Machine, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventMachines))
	out := make(chan []*model.Machine, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventMachines)); ok {
			if d, ok := v.([]models.Machine); ok {
				select {
				case out <- toMachines(d):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.([]models.Machine)
				if !ok {
					continue
				}
				select {
				case out <- toMachines(d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) StoragesChanged(ctx context.Context, sessionID string) (<-chan []*model.Storage, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventStorages))
	out := make(chan []*model.Storage, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventStorages)); ok {
			if d, ok := v.([]models.Storage); ok {
				select {
				case out <- toStorages(d):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.([]models.Storage)
				if !ok {
					continue
				}
				select {
				case out <- toStorages(d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) BeltsChanged(ctx context.Context, sessionID string) (<-chan []*model.Belt, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventBelts))
	out := make(chan []*model.Belt, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventBelts)); ok {
			if d, ok := v.(models.Belts); ok {
				select {
				case out <- toBelts(d.Belts):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.(models.Belts)
				if !ok {
					continue
				}
				select {
				case out <- toBelts(d.Belts):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) SplitterMergersChanged(ctx context.Context, sessionID string) (<-chan []*model.SplitterMerger, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventBelts))
	out := make(chan []*model.SplitterMerger, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventBelts)); ok {
			if d, ok := v.(models.Belts); ok {
				select {
				case out <- toSplitterMergers(d.SplitterMergers):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.(models.Belts)
				if !ok {
					continue
				}
				select {
				case out <- toSplitterMergers(d.SplitterMergers):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) PipesChanged(ctx context.Context, sessionID string) (<-chan []*model.Pipe, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventPipes))
	out := make(chan []*model.Pipe, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventPipes)); ok {
			if d, ok := v.(models.Pipes); ok {
				select {
				case out <- toPipes(d.Pipes):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.(models.Pipes)
				if !ok {
					continue
				}
				select {
				case out <- toPipes(d.Pipes):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) PipeJunctionsChanged(ctx context.Context, sessionID string) (<-chan []*model.PipeJunction, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventPipes))
	out := make(chan []*model.PipeJunction, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventPipes)); ok {
			if d, ok := v.(models.Pipes); ok {
				select {
				case out <- toPipeJunctions(d.PipeJunctions):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.(models.Pipes)
				if !ok {
					continue
				}
				select {
				case out <- toPipeJunctions(d.PipeJunctions):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) CablesChanged(ctx context.Context, sessionID string) (<-chan []*model.Cable, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventCables))
	out := make(chan []*model.Cable, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventCables)); ok {
			if d, ok := v.([]models.Cable); ok {
				select {
				case out <- toCables(d):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.([]models.Cable)
				if !ok {
					continue
				}
				select {
				case out <- toCables(d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) TrainRailsChanged(ctx context.Context, sessionID string) (<-chan []*model.TrainRail, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventTrainRails))
	out := make(chan []*model.TrainRail, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventTrainRails)); ok {
			if d, ok := v.([]models.TrainRail); ok {
				select {
				case out <- toTrainRails(d):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.([]models.TrainRail)
				if !ok {
					continue
				}
				select {
				case out <- toTrainRails(d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) HypertubesChanged(ctx context.Context, sessionID string) (<-chan []*model.Hypertube, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventHypertubes))
	out := make(chan []*model.Hypertube, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventHypertubes)); ok {
			if d, ok := v.(models.Hypertubes); ok {
				select {
				case out <- toHypertubes(d.Hypertubes):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.(models.Hypertubes)
				if !ok {
					continue
				}
				select {
				case out <- toHypertubes(d.Hypertubes):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) HypertubeEntrancesChanged(ctx context.Context, sessionID string) (<-chan []*model.HypertubeEntrance, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventHypertubes))
	out := make(chan []*model.HypertubeEntrance, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventHypertubes)); ok {
			if d, ok := v.(models.Hypertubes); ok {
				select {
				case out <- toHypertubeEntrances(d.HypertubeEntrances):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.(models.Hypertubes)
				if !ok {
					continue
				}
				select {
				case out <- toHypertubeEntrances(d.HypertubeEntrances):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) SpaceElevatorChanged(ctx context.Context, sessionID string) (<-chan *model.SpaceElevator, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventSpaceElevator))
	out := make(chan *model.SpaceElevator, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventSpaceElevator)); ok {
			if d, ok := v.(*models.SpaceElevator); ok && d != nil {
				select {
				case out <- toSpaceElevator(*d):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.(*models.SpaceElevator)
				if !ok || d == nil {
					continue
				}
				select {
				case out <- toSpaceElevator(*d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) HubChanged(ctx context.Context, sessionID string) (<-chan *model.Hub, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventHub))
	out := make(chan *model.Hub, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventHub)); ok {
			if d, ok := v.(*models.Hub); ok && d != nil {
				select {
				case out <- toHub(*d):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.(*models.Hub)
				if !ok || d == nil {
					continue
				}
				select {
				case out <- toHub(*d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) RadarTowersChanged(ctx context.Context, sessionID string) (<-chan []*model.RadarTower, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventRadarTowers))
	out := make(chan []*model.RadarTower, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventRadarTowers)); ok {
			if d, ok := v.([]models.RadarTower); ok {
				select {
				case out <- toRadarTowers(d):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.([]models.RadarTower)
				if !ok {
					continue
				}
				select {
				case out <- toRadarTowers(d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) ResourceNodesChanged(ctx context.Context, sessionID string) (<-chan []*model.ResourceNode, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventResourceNodes))
	out := make(chan []*model.ResourceNode, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventResourceNodes)); ok {
			if d, ok := v.([]models.ResourceNode); ok {
				select {
				case out <- toResourceNodes(d):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.([]models.ResourceNode)
				if !ok {
					continue
				}
				select {
				case out <- toResourceNodes(d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

func (r *subscriptionResolver) SchematicsChanged(ctx context.Context, sessionID string) (<-chan []*model.Schematic, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventSchematics))
	out := make(chan []*model.Schematic, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventSchematics)); ok {
			if d, ok := v.([]models.Schematic); ok {
				select {
				case out <- toSchematics(d):
				case <-ctx.Done():
					return
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				d, ok := se.Data.([]models.Schematic)
				if !ok {
					continue
				}
				select {
				case out <- toSchematics(d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}
