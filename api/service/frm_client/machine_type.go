package frm_client

import (
	"api/models/models"
	"api/pkg/log"
	"strings"
)

// machineTypeByName maps the display name FRM reports for a building onto the
// domain's machine type. FRM sends a localized display name like "Coal Generator",
// while the domain and the GraphQL enum use camelCase keys, so the two have to be
// translated rather than cast.
var machineTypeByName = map[string]models.MachineType{
	"smelter":             models.MachineTypeSmelter,
	"constructor":         models.MachineTypeConstructor,
	"assembler":           models.MachineTypeAssembler,
	"foundry":             models.MachineTypeFoundry,
	"manufacturer":        models.MachineTypeManufacturer,
	"refinery":            models.MachineTypeRefinery,
	"blender":             models.MachineTypeBlender,
	"packager":            models.MachineTypePackager,
	"particleaccelerator": models.MachineTypeParticleAccelerator,

	"miner":          models.MachineTypeMiner,
	"minermk1":       models.MachineTypeMiner,
	"minermk2":       models.MachineTypeMiner,
	"minermk3":       models.MachineTypeMiner,
	"oilextractor":   models.MachineTypeOilExtractor,
	"waterextractor": models.MachineTypeWaterExtractor,

	"biomassburner":         models.MachineTypeBiomassBurner,
	"coalgenerator":         models.MachineTypeCoalGenerator,
	"coalpoweredgenerator":  models.MachineTypeCoalGenerator,
	"fuelgenerator":         models.MachineTypeFuelGenerator,
	"fuelpoweredgenerator":  models.MachineTypeFuelGenerator,
	"geothermalgenerator":   models.MachineTypeGeothermalGenerator,
	"nuclearpowerplant":     models.MachineTypeNuclearPowerPlant,
	"nuclearpoweredgenator": models.MachineTypeNuclearPowerPlant,
}

// normalizeBuildingName reduces a display name to a lookup key by dropping
// everything that varies between FRM versions and localizations of the same name:
// spaces, punctuation and case.
func normalizeBuildingName(name string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(name) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// machineTypeFromName translates FRM's building display name into the domain's
// machine type. An unmapped name yields the empty type, which the GraphQL layer
// renders as an invalid enum, so it is logged rather than passed on silently.
func machineTypeFromName(name string) models.MachineType {
	if t, ok := machineTypeByName[normalizeBuildingName(name)]; ok {
		return t
	}
	log.Warnf("Unknown building name from FRM, machine type will be empty: %q", name)
	return ""
}
