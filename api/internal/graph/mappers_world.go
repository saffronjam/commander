package graph

import (
	"api/internal/graph/model"
	"api/models/models"
)

func toResourceNodePurityEnum(in models.ResourceNodePurity) model.ResourceNodePurity {
	switch in {
	case models.ResourceNodePurityImpure:
		return model.ResourceNodePurityImpure
	case models.ResourceNodePurityNormal:
		return model.ResourceNodePurityNormal
	case models.ResourceNodePurityPure:
		return model.ResourceNodePurityPure
	default:
		return model.ResourceNodePurityNormal
	}
}

func toResourceTypeEnum(in models.ResourceType) model.ResourceType {
	switch in {
	case models.ResourceTypeIronOre:
		return model.ResourceTypeIronOre
	case models.ResourceTypeCopperOre:
		return model.ResourceTypeCopperOre
	case models.ResourceTypeLimestone:
		return model.ResourceTypeLimestone
	case models.ResourceTypeCoal:
		return model.ResourceTypeCoal
	case models.ResourceTypeSAM:
		return model.ResourceTypeSam
	case models.ResourceTypeSulfur:
		return model.ResourceTypeSulfur
	case models.ResourceTypeCateriumOre:
		return model.ResourceTypeCateriumOre
	case models.ResourceTypeBauxite:
		return model.ResourceTypeBauxite
	case models.ResourceTypeRawQuartz:
		return model.ResourceTypeRawQuartz
	case models.ResourceTypeUranium:
		return model.ResourceTypeUranium
	case models.ResourceTypeCrudeOil:
		return model.ResourceTypeCrudeOil
	case models.ResourceTypeGeyser:
		return model.ResourceTypeGeyser
	case models.ResourceTypeNitrogenGas:
		return model.ResourceTypeNitrogenGas
	default:
		return model.ResourceTypeIronOre
	}
}

func toNodeTypeEnum(in models.NodeType) model.NodeType {
	switch in {
	case models.NodeTypeNode:
		return model.NodeTypeNode
	case models.NodeTypeGeyser:
		return model.NodeTypeGeyser
	case models.NodeTypeFrackingCore:
		return model.NodeTypeFrackingCore
	case models.NodeTypeFrackingSatellite:
		return model.NodeTypeFrackingSatellite
	default:
		return model.NodeTypeNode
	}
}

func toFaunaTypeEnum(in models.FaunaType) model.FaunaType {
	switch in {
	case models.FaunaTypeLizardDoggo:
		return model.FaunaTypeLizardDoggo
	case models.FaunaTypeFluffyTailedHog:
		return model.FaunaTypeFluffyTailedHog
	case models.FaunaTypeSpitter:
		return model.FaunaTypeSpitter
	case models.FaunaTypeStinger:
		return model.FaunaTypeStinger
	case models.FaunaTypeFlyingCrab:
		return model.FaunaTypeFlyingCrab
	case models.FaunaTypeNonFlyingBird:
		return model.FaunaTypeNonFlyingBird
	case models.FaunaTypeSpaceGiraffe:
		return model.FaunaTypeSpaceGiraffe
	case models.FaunaTypeSporeFlower:
		return model.FaunaTypeSporeFlower
	case models.FaunaTypeLeafBug:
		return model.FaunaTypeLeafBug
	case models.FaunaTypeGrassSprite:
		return model.FaunaTypeGrassSprite
	case models.FaunaTypeCaveBat:
		return model.FaunaTypeCaveBat
	case models.FaunaTypeGiantFlyingManta:
		return model.FaunaTypeGiantFlyingManta
	case models.FaunaTypeLakeShark:
		return model.FaunaTypeLakeShark
	case models.FaunaTypeWalker:
		return model.FaunaTypeWalker
	default:
		return model.FaunaTypeLizardDoggo
	}
}

func toFloraTypeEnum(in models.FloraType) model.FloraType {
	switch in {
	case models.FloraTypeTree:
		return model.FloraTypeTree
	case models.FloraTypeLeaves:
		return model.FloraTypeLeaves
	case models.FloraTypeFlowerPetals:
		return model.FloraTypeFlowerPetals
	case models.FloraTypeBaconAgaric:
		return model.FloraTypeBaconAgaric
	case models.FloraTypePaleberry:
		return model.FloraTypePaleberry
	case models.FloraTypeBerylNut:
		return model.FloraTypeBerylNut
	case models.FloraTypeMycelia:
		return model.FloraTypeMycelia
	case models.FloraTypeVineLadder:
		return model.FloraTypeVines
	case models.FloraTypeBlueCapMushroom:
		return model.FloraTypeBlueCapMushroom
	case models.FloraTypePinkJellyfish:
		return model.FloraTypePinkJellyfish
	default:
		return model.FloraTypeTree
	}
}

func toSignalTypeEnum(in models.SignalType) model.SignalType {
	switch in {
	case models.SignalTypeSomersloop:
		return model.SignalTypeSomersloop
	case models.SignalTypeMercerSphere:
		return model.SignalTypeMercerSphere
	case models.SignalTypeBluePowerSlug:
		return model.SignalTypeBluePowerSlug
	case models.SignalTypeYellowPowerSlug:
		return model.SignalTypeYellowPowerSlug
	case models.SignalTypePurplePowerSlug:
		return model.SignalTypePurplePowerSlug
	case models.SignalTypeHardDrive:
		return model.SignalTypeHardDrive
	default:
		return model.SignalTypeSomersloop
	}
}

func toSpaceElevatorPhaseObjective(in models.SpaceElevatorPhaseObjective) *model.SpaceElevatorPhaseObjective {
	return &model.SpaceElevatorPhaseObjective{
		Name:      in.Name,
		Amount:    in.Amount,
		TotalCost: in.TotalCost,
	}
}

func toSpaceElevatorPhaseObjectives(in []models.SpaceElevatorPhaseObjective) []*model.SpaceElevatorPhaseObjective {
	out := make([]*model.SpaceElevatorPhaseObjective, 0, len(in))
	for i := range in {
		out = append(out, toSpaceElevatorPhaseObjective(in[i]))
	}
	return out
}

func toSpaceElevator(in models.SpaceElevator) *model.SpaceElevator {
	return &model.SpaceElevator{
		ID:            in.ID,
		Name:          in.Name,
		BoundingBox:   toBoundingBox(in.BoundingBox),
		CurrentPhase:  toSpaceElevatorPhaseObjectives(in.CurrentPhase),
		FullyUpgraded: in.FullyUpgraded,
		UpgradeReady:  in.UpgradeReady,
		X:             in.X,
		Y:             in.Y,
		Z:             in.Z,
		Rotation:      in.Rotation,
	}
}

func toSpaceElevators(in []models.SpaceElevator) []*model.SpaceElevator {
	out := make([]*model.SpaceElevator, 0, len(in))
	for i := range in {
		out = append(out, toSpaceElevator(in[i]))
	}
	return out
}

func toHubMilestoneCost(in models.HubMilestoneCost) *model.HubMilestoneCost {
	return &model.HubMilestoneCost{
		Name:          in.Name,
		Amount:        in.Amount,
		RemainingCost: in.RemainingCost,
		TotalCost:     in.TotalCost,
	}
}

func toHubMilestoneCosts(in []models.HubMilestoneCost) []*model.HubMilestoneCost {
	out := make([]*model.HubMilestoneCost, 0, len(in))
	for i := range in {
		out = append(out, toHubMilestoneCost(in[i]))
	}
	return out
}

func toHubMilestone(in *models.HubMilestone) *model.HubMilestone {
	if in == nil {
		return nil
	}
	return &model.HubMilestone{
		Name:     in.Name,
		TechTier: in.TechTier,
		Type:     in.Type,
		Cost:     toHubMilestoneCosts(in.Cost),
	}
}

func toHub(in models.Hub) *model.Hub {
	var shipReturnTime *int
	if in.ShipReturnTime != nil {
		v := int(*in.ShipReturnTime)
		shipReturnTime = &v
	}
	return &model.Hub{
		ID:                 in.ID,
		Name:               in.Name,
		HasActiveMilestone: in.HasActiveMilestone,
		ActiveMilestone:    toHubMilestone(in.ActiveMilestone),
		ShipDocked:         in.ShipDocked,
		ShipReturnTime:     shipReturnTime,
		BoundingBox:        toBoundingBox(in.BoundingBox),
		X:                  in.X,
		Y:                  in.Y,
		Z:                  in.Z,
		Rotation:           in.Rotation,
	}
}

func toHubs(in []models.Hub) []*model.Hub {
	out := make([]*model.Hub, 0, len(in))
	for i := range in {
		out = append(out, toHub(in[i]))
	}
	return out
}

func toResourceNode(in models.ResourceNode) *model.ResourceNode {
	return &model.ResourceNode{
		ID:           in.ID,
		Name:         in.Name,
		ClassName:    in.ClassName,
		Purity:       toResourceNodePurityEnum(in.Purity),
		ResourceForm: in.ResourceForm,
		ResourceType: toResourceTypeEnum(in.ResourceType),
		NodeType:     toNodeTypeEnum(in.NodeType),
		Exploited:    in.Exploited,
		X:            in.X,
		Y:            in.Y,
		Z:            in.Z,
		Rotation:     in.Rotation,
	}
}

func toResourceNodes(in []models.ResourceNode) []*model.ResourceNode {
	out := make([]*model.ResourceNode, 0, len(in))
	for i := range in {
		out = append(out, toResourceNode(in[i]))
	}
	return out
}

func toScannedFauna(in models.ScannedFauna) *model.ScannedFauna {
	return &model.ScannedFauna{
		Name:      toFaunaTypeEnum(in.Name),
		ClassName: in.ClassName,
		Amount:    in.Amount,
	}
}

func toScannedFaunas(in []models.ScannedFauna) []*model.ScannedFauna {
	out := make([]*model.ScannedFauna, 0, len(in))
	for i := range in {
		out = append(out, toScannedFauna(in[i]))
	}
	return out
}

func toScannedFlora(in models.ScannedFlora) *model.ScannedFlora {
	return &model.ScannedFlora{
		Name:      toFloraTypeEnum(in.Name),
		ClassName: in.ClassName,
		Amount:    in.Amount,
	}
}

func toScannedFloras(in []models.ScannedFlora) []*model.ScannedFlora {
	out := make([]*model.ScannedFlora, 0, len(in))
	for i := range in {
		out = append(out, toScannedFlora(in[i]))
	}
	return out
}

func toScannedSignal(in models.ScannedSignal) *model.ScannedSignal {
	return &model.ScannedSignal{
		Name:      toSignalTypeEnum(in.Name),
		ClassName: in.ClassName,
		Amount:    in.Amount,
	}
}

func toScannedSignals(in []models.ScannedSignal) []*model.ScannedSignal {
	out := make([]*model.ScannedSignal, 0, len(in))
	for i := range in {
		out = append(out, toScannedSignal(in[i]))
	}
	return out
}

func toRadarTower(in models.RadarTower) *model.RadarTower {
	return &model.RadarTower{
		ID:           in.ID,
		RevealRadius: in.RevealRadius,
		Nodes:        toResourceNodes(in.Nodes),
		Fauna:        toScannedFaunas(in.Fauna),
		Flora:        toScannedFloras(in.Flora),
		Signal:       toScannedSignals(in.Signal),
		BoundingBox:  toBoundingBox(in.BoundingBox),
		X:            in.X,
		Y:            in.Y,
		Z:            in.Z,
		Rotation:     in.Rotation,
	}
}

func toRadarTowers(in []models.RadarTower) []*model.RadarTower {
	out := make([]*model.RadarTower, 0, len(in))
	for i := range in {
		out = append(out, toRadarTower(in[i]))
	}
	return out
}

func toSchematicCost(in models.SchematicCost) *model.SchematicCost {
	return &model.SchematicCost{
		Name:      in.Name,
		Amount:    in.Amount,
		TotalCost: in.TotalCost,
	}
}

func toSchematicCosts(in []models.SchematicCost) []*model.SchematicCost {
	out := make([]*model.SchematicCost, 0, len(in))
	for i := range in {
		out = append(out, toSchematicCost(in[i]))
	}
	return out
}

func toSchematic(in models.Schematic) *model.Schematic {
	return &model.Schematic{
		ID:          in.ID,
		Name:        in.Name,
		Tier:        in.Tier,
		Type:        in.Type,
		Purchased:   in.Purchased,
		Locked:      in.Locked,
		LockedPhase: in.LockedPhase,
		Cost:        toSchematicCosts(in.Cost),
	}
}

func toSchematics(in []models.Schematic) []*model.Schematic {
	out := make([]*model.Schematic, 0, len(in))
	for i := range in {
		out = append(out, toSchematic(in[i]))
	}
	return out
}

func toPlayer(in models.Player) *model.Player {
	return &model.Player{
		ID:       in.ID,
		Name:     in.Name,
		Health:   in.Health,
		Items:    toItemStatsList(in.Items),
		X:        in.X,
		Y:        in.Y,
		Z:        in.Z,
		Rotation: in.Rotation,
	}
}

func toPlayers(in []models.Player) []*model.Player {
	out := make([]*model.Player, 0, len(in))
	for i := range in {
		out = append(out, toPlayer(in[i]))
	}
	return out
}
