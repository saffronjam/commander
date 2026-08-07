package frmmock

import (
	"api/models/models"
	"api/service/frm_client/frm_models"
)

// Snapshot is one tick's answer for every endpoint. Building it once per tick is
// what makes an aggregating client call internally consistent: the several
// requests behind a single event all read the same tick.
type Snapshot struct {
	Tick int64

	SessionInfo models.SessionInfoRaw
	Extractors  []frm_models.Extractor
	Factories   []frm_models.FactoryMachine
	Generators  []frm_models.Generator
	Circuits    []frm_models.Circuit
	ProdStats   []frm_models.ProdStatItem
	WorldInv    []frm_models.WorldInvItem
	CloudInv    []frm_models.CloudInvItem
	Sink        []frm_models.SinkData
	Players     []frm_models.Player

	static *staticPayloads
}

// staticPayloads are the responses with no dependence on the tick. They are built
// once per world, which is what structurally guarantees the dashboard's identity
// keys cannot drift: the bytes are literally the same every poll.
type staticPayloads struct {
	Belts          []frm_models.Belt
	Splitters      []frm_models.SplitterMerger
	Pipes          []frm_models.Pipe
	PipeJunctions  []frm_models.PipeJunction
	Cables         []frm_models.Cable
	ResourceNodes  []frm_models.ResourceNode
	Hypertubes     []frm_models.Hypertube
	HyperEntrances []frm_models.HypertubeEntrance
	RadarTowers    []frm_models.RadarTower
	Storages       []frm_models.Storage
	SpaceElevator  []frm_models.SpaceElevator
	HubTerminal    []frm_models.HubTerminal
	Schematics     []frm_models.Schematic
}

// buildStatic renders every tick-independent payload for a world.
func buildStatic(w *World) *staticPayloads {
	return &staticPayloads{
		Belts:          renderBelts(w),
		Splitters:      renderSplitters(w),
		Pipes:          renderPipes(w),
		PipeJunctions:  renderPipeJunctions(w),
		Cables:         renderCables(w),
		ResourceNodes:  renderResourceNodes(w),
		Hypertubes:     []frm_models.Hypertube{},
		HyperEntrances: []frm_models.HypertubeEntrance{},
		RadarTowers:    []frm_models.RadarTower{},
		Storages:       []frm_models.Storage{},
		SpaceElevator:  []frm_models.SpaceElevator{},
		HubTerminal:    []frm_models.HubTerminal{},
		Schematics:     []frm_models.Schematic{},
	}
}

// buildSnapshot renders the whole world at one tick.
func buildSnapshot(w *World, cfg Config, static *staticPayloads, tick int64) *Snapshot {
	t := float64(tick) * float64(cfg.TickMs) / 1000

	extractors, factories, generators := renderMachines(w, cfg, t)

	return &Snapshot{
		Tick:        tick,
		SessionInfo: renderSessionInfo(w, t),
		Extractors:  extractors,
		Factories:   factories,
		Generators:  generators,
		Circuits:    renderCircuits(w, cfg, t),
		ProdStats:   renderProdStats(w, t),
		WorldInv:    renderWorldInv(w, t),
		CloudInv:    renderCloudInv(w, t),
		Sink:        renderSink(w, t),
		Players:     renderPlayers(w, t),
		static:      static,
	}
}
