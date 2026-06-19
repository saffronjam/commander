package graph

import (
	"context"

	"api/internal/graph/model"
	"api/internal/session"
	"api/models/models"
	"api/pkg/eventbus"
)

// SatisfactoryAPIStatusChanged streams API status updates for the session.
func (r *subscriptionResolver) SatisfactoryAPIStatusChanged(ctx context.Context, sessionID string) (<-chan *model.SatisfactoryAPIStatus, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventApiStatus))
	out := make(chan *model.SatisfactoryAPIStatus, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventApiStatus)); ok {
			if s, ok := v.(*models.SatisfactoryApiStatus); ok && s != nil {
				select {
				case out <- toSatisfactoryApiStatus(*s):
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
				s, ok := se.Data.(*models.SatisfactoryApiStatus)
				if !ok || s == nil {
					continue
				}
				select {
				case out <- toSatisfactoryApiStatus(*s):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// ConnectivityChanged streams connectivity transitions for the session.
func (r *subscriptionResolver) ConnectivityChanged(ctx context.Context, sessionID string) (<-chan *model.ConnectivityStatus, error) {
	sid := session.ID(sessionID)
	ch := r.EventBus.SubscribeSession(sessionID, eventbus.KindConnectivity)
	out := make(chan *model.ConnectivityStatus, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		cs := r.Snapshot.Connectivity(sid)
		select {
		case out <- toConnectivityStatus(cs.IsOnline, cs.IsDisconnected, cs.Stage):
		case <-ctx.Done():
			return
		}
		for {
			select {
			case <-ctx.Done():
				return
			case _, ok := <-ch:
				if !ok {
					return
				}
				cs := r.Snapshot.Connectivity(sid)
				select {
				case out <- toConnectivityStatus(cs.IsOnline, cs.IsDisconnected, cs.Stage):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// SessionUpdated streams session metadata updates for the session.
func (r *subscriptionResolver) SessionUpdated(ctx context.Context, sessionID string) (<-chan *model.Session, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventSessionUpdate))
	out := make(chan *model.Session, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
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
				s, ok := se.Data.(*models.Session)
				if !ok || s == nil {
					continue
				}
				select {
				case out <- toSession(*s, r.Snapshot.Stage(sid)):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// CircuitsChanged streams power circuit updates for the session.
func (r *subscriptionResolver) CircuitsChanged(ctx context.Context, sessionID string) (<-chan []*model.Circuit, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventCircuits))
	out := make(chan []*model.Circuit, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventCircuits)); ok {
			if d, ok := v.([]models.Circuit); ok {
				select {
				case out <- toCircuits(d):
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
				d, ok := se.Data.([]models.Circuit)
				if !ok {
					continue
				}
				select {
				case out <- toCircuits(d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// FactoryStatsChanged streams factory statistics updates for the session.
func (r *subscriptionResolver) FactoryStatsChanged(ctx context.Context, sessionID string) (<-chan *model.FactoryStats, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventFactoryStats))
	out := make(chan *model.FactoryStats, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventFactoryStats)); ok {
			if fs, ok := v.(*models.FactoryStats); ok && fs != nil {
				select {
				case out <- toFactoryStats(*fs):
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
				fs, ok := se.Data.(*models.FactoryStats)
				if !ok || fs == nil {
					continue
				}
				select {
				case out <- toFactoryStats(*fs):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// ProdStatsChanged streams production statistics updates for the session.
func (r *subscriptionResolver) ProdStatsChanged(ctx context.Context, sessionID string) (<-chan *model.ProdStats, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventProdStats))
	out := make(chan *model.ProdStats, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventProdStats)); ok {
			if ps, ok := v.(*models.ProdStats); ok && ps != nil {
				select {
				case out <- toProdStats(*ps):
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
				ps, ok := se.Data.(*models.ProdStats)
				if !ok || ps == nil {
					continue
				}
				select {
				case out <- toProdStats(*ps):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// GeneratorStatsChanged streams generator statistics updates for the session.
func (r *subscriptionResolver) GeneratorStatsChanged(ctx context.Context, sessionID string) (<-chan *model.GeneratorStats, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventGeneratorStats))
	out := make(chan *model.GeneratorStats, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventGeneratorStats)); ok {
			if gs, ok := v.(*models.GeneratorStats); ok && gs != nil {
				select {
				case out <- toGeneratorStats(*gs):
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
				gs, ok := se.Data.(*models.GeneratorStats)
				if !ok || gs == nil {
					continue
				}
				select {
				case out <- toGeneratorStats(*gs):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// SinkStatsChanged streams awesome sink statistics updates for the session.
func (r *subscriptionResolver) SinkStatsChanged(ctx context.Context, sessionID string) (<-chan *model.SinkStats, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventSinkStats))
	out := make(chan *model.SinkStats, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventSinkStats)); ok {
			if ss, ok := v.(*models.SinkStats); ok && ss != nil {
				select {
				case out <- toSinkStats(*ss):
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
				ss, ok := se.Data.(*models.SinkStats)
				if !ok || ss == nil {
					continue
				}
				select {
				case out <- toSinkStats(*ss):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// PlayersChanged streams player list updates for the session.
func (r *subscriptionResolver) PlayersChanged(ctx context.Context, sessionID string) (<-chan []*model.Player, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventPlayers))
	out := make(chan []*model.Player, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventPlayers)); ok {
			if d, ok := v.([]models.Player); ok {
				select {
				case out <- toPlayers(d):
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
				d, ok := se.Data.([]models.Player)
				if !ok {
					continue
				}
				select {
				case out <- toPlayers(d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// DronesChanged streams drone updates for the session.
func (r *subscriptionResolver) DronesChanged(ctx context.Context, sessionID string) (<-chan []*model.Drone, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventVehicles))
	out := make(chan []*model.Drone, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehicles)); ok {
			if d, ok := v.(models.Vehicles); ok {
				select {
				case out <- toDrones(d.Drones):
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
				d, ok := se.Data.(models.Vehicles)
				if !ok {
					continue
				}
				select {
				case out <- toDrones(d.Drones):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// DroneStationsChanged streams drone station updates for the session.
func (r *subscriptionResolver) DroneStationsChanged(ctx context.Context, sessionID string) (<-chan []*model.DroneStation, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventVehicleStations))
	out := make(chan []*model.DroneStation, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehicleStations)); ok {
			if d, ok := v.(models.VehicleStations); ok {
				select {
				case out <- toDroneStations(d.DroneStations):
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
				d, ok := se.Data.(models.VehicleStations)
				if !ok {
					continue
				}
				select {
				case out <- toDroneStations(d.DroneStations):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// TrainsChanged streams train updates for the session.
func (r *subscriptionResolver) TrainsChanged(ctx context.Context, sessionID string) (<-chan []*model.Train, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventVehicles))
	out := make(chan []*model.Train, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehicles)); ok {
			if d, ok := v.(models.Vehicles); ok {
				select {
				case out <- toTrains(d.Trains):
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
				d, ok := se.Data.(models.Vehicles)
				if !ok {
					continue
				}
				select {
				case out <- toTrains(d.Trains):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// TrainStationsChanged streams train station updates for the session.
func (r *subscriptionResolver) TrainStationsChanged(ctx context.Context, sessionID string) (<-chan []*model.TrainStation, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventVehicleStations))
	out := make(chan []*model.TrainStation, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehicleStations)); ok {
			if d, ok := v.(models.VehicleStations); ok {
				select {
				case out <- toTrainStations(d.TrainStations):
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
				d, ok := se.Data.(models.VehicleStations)
				if !ok {
					continue
				}
				select {
				case out <- toTrainStations(d.TrainStations):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// TrucksChanged streams truck updates for the session.
func (r *subscriptionResolver) TrucksChanged(ctx context.Context, sessionID string) (<-chan []*model.Truck, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventVehicles))
	out := make(chan []*model.Truck, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehicles)); ok {
			if d, ok := v.(models.Vehicles); ok {
				select {
				case out <- toTrucks(d.Trucks):
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
				d, ok := se.Data.(models.Vehicles)
				if !ok {
					continue
				}
				select {
				case out <- toTrucks(d.Trucks):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// TruckStationsChanged streams truck station updates for the session.
func (r *subscriptionResolver) TruckStationsChanged(ctx context.Context, sessionID string) (<-chan []*model.TruckStation, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventVehicleStations))
	out := make(chan []*model.TruckStation, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehicleStations)); ok {
			if d, ok := v.(models.VehicleStations); ok {
				select {
				case out <- toTruckStations(d.TruckStations):
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
				d, ok := se.Data.(models.VehicleStations)
				if !ok {
					continue
				}
				select {
				case out <- toTruckStations(d.TruckStations):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// TractorsChanged streams tractor updates for the session.
func (r *subscriptionResolver) TractorsChanged(ctx context.Context, sessionID string) (<-chan []*model.Tractor, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventTractors))
	out := make(chan []*model.Tractor, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventTractors)); ok {
			if d, ok := v.([]models.Tractor); ok {
				select {
				case out <- toTractors(d):
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
				d, ok := se.Data.([]models.Tractor)
				if !ok {
					continue
				}
				select {
				case out <- toTractors(d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// ExplorersChanged streams explorer updates for the session.
func (r *subscriptionResolver) ExplorersChanged(ctx context.Context, sessionID string) (<-chan []*model.Explorer, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventExplorers))
	out := make(chan []*model.Explorer, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventExplorers)); ok {
			if d, ok := v.([]models.Explorer); ok {
				select {
				case out <- toExplorers(d):
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
				d, ok := se.Data.([]models.Explorer)
				if !ok {
					continue
				}
				select {
				case out <- toExplorers(d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}

// VehiclePathsChanged streams vehicle path updates for the session.
func (r *subscriptionResolver) VehiclePathsChanged(ctx context.Context, sessionID string) (<-chan []*model.VehiclePath, error) {
	sid := session.ID(sessionID)
	save := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, save, string(models.SatisfactoryEventVehiclePaths))
	out := make(chan []*model.VehiclePath, 1)
	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)
		if v, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventVehiclePaths)); ok {
			if d, ok := v.([]models.VehiclePath); ok {
				select {
				case out <- toVehiclePaths(d):
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
				d, ok := se.Data.([]models.VehiclePath)
				if !ok {
					continue
				}
				select {
				case out <- toVehiclePaths(d):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}
