package frmmock

import (
	"api/service/frm_client/frm_models"
	"reflect"
)

// endpoint is one FRM path. Static endpoints have no dependence on the tick, so
// their bytes are marshalled once per world and reused forever — which is what
// guarantees the dashboard's coordinate-derived identity keys never drift.
type endpoint struct {
	path   string
	static bool
	render func(*Snapshot) any
}

// endpointSet lists every FRM path the mock answers. It is initialised with an
// unkeyed literal on purpose: adding a field without supplying its endpoint does
// not compile, which is the only compile-time totality check Go offers.
//
// The fields are exported so routes() can read them by reflection. The type itself
// is unexported, so nothing here is public API.
type endpointSet struct {
	Root, SessionInfo,
	Extractor, Factory, Generators,
	Power, Cables,
	ProdStats, WorldInv, CloudInv, ResourceSink,
	Player,
	Trains, TrainStation, Drone, DroneStation, Truck, TruckStation, Tractor, Explorer,
	Belts, SplitterMerger, Pipes, PipeJunctions, Hypertube, HyperEntrance,
	StorageInv, SpaceElevator, HubTerminal, RadarTower, ResourceNode, Schematics endpoint
}

// empty renders a fixed empty list, which is a legal FRM answer. Endpoints the mock
// does not populate yet must still answer, because an aggregating client call
// aborts its whole event on the first error.
func empty[T any]() func(*Snapshot) any {
	v := []T{}
	return func(*Snapshot) any { return v }
}

var served = endpointSet{
	endpoint{"/", true, func(*Snapshot) any { return struct{}{} }},
	endpoint{"/getSessionInfo", false, func(s *Snapshot) any { return s.SessionInfo }},

	endpoint{"/getExtractor", false, func(s *Snapshot) any { return s.Extractors }},
	endpoint{"/getFactory", false, func(s *Snapshot) any { return s.Factories }},
	endpoint{"/getGenerators", false, func(s *Snapshot) any { return s.Generators }},

	endpoint{"/getPower", false, func(s *Snapshot) any { return s.Circuits }},
	endpoint{"/getCables", true, func(s *Snapshot) any { return s.static.Cables }},

	endpoint{"/getProdStats", false, func(s *Snapshot) any { return s.ProdStats }},
	endpoint{"/getWorldInv", false, func(s *Snapshot) any { return s.WorldInv }},
	endpoint{"/getCloudInv", false, func(s *Snapshot) any { return s.CloudInv }},
	endpoint{"/getResourceSink", false, func(s *Snapshot) any { return s.Sink }},

	endpoint{"/getPlayer", false, func(s *Snapshot) any { return s.Players }},

	endpoint{"/getTrains", true, empty[frm_models.Train]()},
	endpoint{"/getTrainStation", true, empty[frm_models.TrainStation]()},
	endpoint{"/getDrone", true, empty[frm_models.Drone]()},
	endpoint{"/getDroneStation", true, empty[frm_models.DroneStation]()},
	endpoint{"/getTruck", true, empty[frm_models.Truck]()},
	endpoint{"/getTruckStation", true, empty[frm_models.TruckStation]()},
	endpoint{"/getTractor", true, empty[frm_models.Tractor]()},
	endpoint{"/getExplorer", true, empty[frm_models.Explorer]()},

	endpoint{"/getBelts", true, func(s *Snapshot) any { return s.static.Belts }},
	endpoint{"/getSplitterMerger", true, func(s *Snapshot) any { return s.static.Splitters }},
	endpoint{"/getPipes", true, func(s *Snapshot) any { return s.static.Pipes }},
	endpoint{"/getPipeJunctions", true, func(s *Snapshot) any { return s.static.PipeJunctions }},
	endpoint{"/getHypertube", true, func(s *Snapshot) any { return s.static.Hypertubes }},
	endpoint{"/getHyperEntrance", true, func(s *Snapshot) any { return s.static.HyperEntrances }},

	endpoint{"/getStorageInv", true, func(s *Snapshot) any { return s.static.Storages }},
	endpoint{"/getSpaceElevator", true, func(s *Snapshot) any { return s.static.SpaceElevator }},
	endpoint{"/getHubTerminal", true, func(s *Snapshot) any { return s.static.HubTerminal }},
	endpoint{"/getRadarTower", true, func(s *Snapshot) any { return s.static.RadarTowers }},
	endpoint{"/getResourceNode", true, func(s *Snapshot) any { return s.static.ResourceNodes }},
	endpoint{"/getSchematics", true, func(s *Snapshot) any { return s.static.Schematics }},
}

// routes enumerates served by reflection rather than by a second hand-written list,
// so the unkeyed literal above stays the single place an endpoint is declared.
func (e endpointSet) routes() []endpoint {
	v := reflect.ValueOf(e)
	out := make([]endpoint, 0, v.NumField())
	for i := range v.NumField() {
		out = append(out, v.Field(i).Interface().(endpoint))
	}
	return out
}

// Paths lists every path the mock serves, for tests and for logging at startup.
func Paths() []string {
	routes := served.routes()
	out := make([]string, 0, len(routes))
	for _, r := range routes {
		out = append(out, r.path)
	}
	return out
}

// stubbedPaths are the two endpoints the dashboard's client has commented out
// because upstream FRM is broken. Answering them would hide a future regression, so
// the mock returns 404 and a test pins that.
var stubbedPaths = []string{"/getTrainRails", "/getVehiclePaths"}
