package frm_client

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

	"api/internal/frmmock"
	"api/models/models"
	"api/service/client"
)

// validMachineTypes is every MachineType the domain declares. A raw FRM display
// name cast straight to MachineType is not one of them, which is what makes the
// machine type arrive empty at the GraphQL layer.
var validMachineTypes = map[models.MachineType]bool{
	models.MachineTypeAssembler: true, models.MachineTypeConstructor: true,
	models.MachineTypeFoundry: true, models.MachineTypeManufacturer: true,
	models.MachineTypeRefinery: true, models.MachineTypeSmelter: true,
	models.MachineTypeBlender: true, models.MachineTypePackager: true,
	models.MachineTypeParticleAccelerator: true, models.MachineTypeMiner: true,
	models.MachineTypeOilExtractor: true, models.MachineTypeWaterExtractor: true,
	models.MachineTypeBiomassBurner: true, models.MachineTypeCoalGenerator: true,
	models.MachineTypeFuelGenerator: true, models.MachineTypeGeothermalGenerator: true,
	models.MachineTypeNuclearPowerPlant: true,
}

// mockClient serves a generated world and returns a real client pointed at it, so
// every converter in this package runs against a payload that is shape-correct by
// construction.
func mockClient(t *testing.T, preset string) client.Client {
	t.Helper()
	srv := httptest.NewServer(frmmock.Handler(frmmock.Preset(preset)))
	t.Cleanup(srv.Close)
	return NewClientWithAddress(strings.TrimPrefix(srv.URL, "http://"))
}

// The translation layer has no coverage against a full payload otherwise: every
// converter here is only exercised against a live game.
func TestClientReadsEveryEndpointFromMock(t *testing.T) {
	c := mockClient(t, "starter")
	ctx := context.Background()

	t.Run("session info", func(t *testing.T) {
		info, err := c.GetSessionInfo(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if info.SaveName == "" {
			t.Fatal("want a save name, got empty")
		}
		if info.TotalPlayDuration <= 0 {
			t.Fatalf("want a positive play duration, got %d", info.TotalPlayDuration)
		}
	})

	t.Run("api status", func(t *testing.T) {
		status, err := c.GetSatisfactoryApiStatus(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if !status.Running {
			t.Fatal("want the mock to report running")
		}
	})

	t.Run("circuits", func(t *testing.T) {
		circuits, err := c.ListCircuits(ctx)
		if err != nil {
			t.Fatal(err)
		}
		// Circuits reporting no production are dropped by ListCircuits, so an empty
		// result means the mock generated a circuit with no generator on it.
		if len(circuits) == 0 {
			t.Fatal("want at least one circuit with production")
		}
		for _, circuit := range circuits {
			if circuit.Production.Total <= 0 {
				t.Fatalf("circuit %s survived with no production", circuit.ID)
			}
		}
	})

	t.Run("machines", func(t *testing.T) {
		machines, err := c.GetMachines(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if len(machines) == 0 {
			t.Fatal("want machines")
		}
		for _, m := range machines {
			if !validMachineTypes[m.Type] {
				t.Fatalf("machine type %q is not a models.MachineType constant, so the GraphQL layer maps it to an empty enum", m.Type)
			}
			if m.BoundingBox.Max.X == m.BoundingBox.Min.X {
				t.Fatalf("machine %s has a zero-width bounding box, so the map cannot draw it", m.Type)
			}
		}
	})

	t.Run("factory stats", func(t *testing.T) {
		stats, err := c.GetFactoryStats(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if stats.TotalMachines == 0 {
			t.Fatal("want a non-zero machine count")
		}
	})

	t.Run("prod stats", func(t *testing.T) {
		stats, err := c.GetProdStats(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if len(stats.Items) == 0 {
			t.Fatal("want production statistics for at least one item")
		}
	})

	t.Run("generator stats", func(t *testing.T) {
		stats, err := c.GetGeneratorStats(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if stats == nil || len(stats.Sources) == 0 {
			t.Fatal("want at least one power type: generators whose name does not match are dropped")
		}
	})

	t.Run("sink stats", func(t *testing.T) {
		if _, err := c.GetSinkStats(ctx); err != nil {
			t.Fatal(err)
		}
	})

	t.Run("players", func(t *testing.T) {
		players, err := c.ListPlayers(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if len(players) == 0 {
			t.Fatal("want players: an empty name would have dropped them")
		}
	})

	t.Run("belts and pipes", func(t *testing.T) {
		belts, err := c.GetBelts(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if len(belts.Belts) == 0 {
			t.Fatal("want belts")
		}
		if _, err := c.GetPipes(ctx); err != nil {
			t.Fatal(err)
		}
	})

	t.Run("cables", func(t *testing.T) {
		cables, err := c.ListCables(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if len(cables) == 0 {
			t.Fatal("want cables")
		}
	})

	t.Run("resource nodes", func(t *testing.T) {
		nodes, err := c.ListResourceNodes(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if len(nodes) == 0 {
			t.Fatal("want resource nodes")
		}
		for _, n := range nodes {
			if n.ResourceType == "" {
				t.Fatalf("node %s resolved to no resource type", n.ID)
			}
		}
	})

	t.Run("vehicles and stations answer", func(t *testing.T) {
		if _, err := c.GetVehicles(ctx); err != nil {
			t.Fatal(err)
		}
		if _, err := c.GetVehicleStations(ctx); err != nil {
			t.Fatal(err)
		}
	})

	t.Run("world endpoints answer", func(t *testing.T) {
		if _, err := c.ListRadarTowers(ctx); err != nil {
			t.Fatal(err)
		}
		if _, err := c.ListSchematics(ctx); err != nil {
			t.Fatal(err)
		}
		if _, err := c.GetSpaceElevator(ctx); err != nil {
			t.Fatal(err)
		}
		if _, err := c.GetHub(ctx); err != nil {
			t.Fatal(err)
		}
		if _, err := c.ListTrainRails(ctx); err != nil {
			t.Fatal(err)
		}
		if _, err := c.ListVehiclePaths(ctx); err != nil {
			t.Fatal(err)
		}
	})
}

// Every preset must generate a world the client can read, so a preset cannot ship
// broken.
func TestEveryPresetIsReadable(t *testing.T) {
	for _, preset := range frmmock.PresetNames {
		t.Run(preset, func(t *testing.T) {
			c := mockClient(t, preset)
			if _, err := c.GetMachines(context.Background()); err != nil {
				t.Fatal(err)
			}
			if _, err := c.ListCircuits(context.Background()); err != nil {
				t.Fatal(err)
			}
		})
	}
}
