/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
/**
 * ConnectionState is the authoritative connection state for a session, so clients
 * never derive one from a pair of booleans.
 */
export type ConnectionState =
  /** A poller is running but FRM has not answered yet. */
  | 'CONNECTING'
  /** FRM could not be reached; reason says why. */
  | 'OFFLINE'
  /** FRM answered. */
  | 'ONLINE';

/**
 * ConnectivityReason explains why a session is unreachable, so the UI can say more
 * than "offline".
 */
export type ConnectivityReason =
  /** Something answered but it was not FRM: an HTTP error, TLS failure, or a body that does not parse. */
  | 'BAD_RESPONSE'
  /** The session is reachable. */
  | 'NONE'
  /** Nothing answered: timed out or refused. FRM is most likely not running. */
  | 'NO_RESPONSE';

export type DroneStatus =
  | 'DOCKING'
  | 'FLYING'
  | 'IDLE';

export type ExplorerStatus =
  | 'MANUAL_DRIVING'
  | 'PARKED'
  | 'SELF_DRIVING'
  | 'UNKNOWN';

export type FaunaType =
  | 'CAVE_BAT'
  | 'FLUFFY_TAILED_HOG'
  | 'FLYING_CRAB'
  | 'GIANT_FLYING_MANTA'
  | 'GRASS_SPRITE'
  | 'LAKE_SHARK'
  | 'LEAF_BUG'
  | 'LIZARD_DOGGO'
  | 'NON_FLYING_BIRD'
  | 'SPACE_GIRAFFE'
  | 'SPITTER'
  | 'SPORE_FLOWER'
  | 'STINGER'
  | 'WALKER';

export type FloraType =
  | 'BACON_AGARIC'
  | 'BERYL_NUT'
  | 'BLUE_CAP_MUSHROOM'
  | 'FLOWER_PETALS'
  | 'LEAVES'
  | 'MYCELIA'
  | 'PALEBERRY'
  | 'PINK_JELLYFISH'
  | 'TREE'
  | 'VINES';

export type LogLevel =
  | 'DEBUG'
  | 'ERROR'
  | 'INFO'
  | 'TRACE'
  | 'WARNING';

export type MachineCategory =
  | 'EXTRACTOR'
  | 'FACTORY'
  | 'GENERATOR';

export type MachineStatus =
  | 'IDLE'
  | 'OPERATING'
  | 'PAUSED'
  | 'UNCONFIGURED'
  | 'UNKNOWN';

export type MachineType =
  | 'ASSEMBLER'
  | 'BIOMASS_BURNER'
  | 'BLENDER'
  | 'COAL_GENERATOR'
  | 'CONSTRUCTOR'
  | 'FOUNDRY'
  | 'FUEL_GENERATOR'
  | 'GEOTHERMAL_GENERATOR'
  | 'MANUFACTURER'
  | 'MINER'
  | 'NUCLEAR_POWER_PLANT'
  | 'OIL_EXTRACTOR'
  | 'PACKAGER'
  | 'PARTICLE_ACCELERATOR'
  | 'REFINERY'
  | 'SMELTER'
  | 'WATER_EXTRACTOR';

export type NodeType =
  | 'FRACKING_CORE'
  | 'FRACKING_SATELLITE'
  | 'GEYSER'
  | 'NODE';

export type PowerType =
  | 'BIOMASS'
  | 'COAL'
  | 'FUEL'
  | 'GEOTHERMAL'
  | 'NUCLEAR'
  | 'UNKNOWN';

export type ResourceNodePurity =
  | 'IMPURE'
  | 'NORMAL'
  | 'PURE';

export type ResourceType =
  | 'BAUXITE'
  | 'CATERIUM_ORE'
  | 'COAL'
  | 'COPPER_ORE'
  | 'CRUDE_OIL'
  | 'GEYSER'
  | 'IRON_ORE'
  | 'LIMESTONE'
  | 'NITROGEN_GAS'
  | 'RAW_QUARTZ'
  | 'SAM'
  | 'SULFUR'
  | 'URANIUM';

export type SessionStage =
  | 'INIT'
  | 'READY';

export type SignalType =
  | 'BLUE_POWER_SLUG'
  | 'HARD_DRIVE'
  | 'MERCER_SPHERE'
  | 'PURPLE_POWER_SLUG'
  | 'SOMERSLOOP'
  | 'YELLOW_POWER_SLUG';

export type SplitterMergerType =
  | 'CONVEYOR_MERGER'
  | 'CONVEYOR_SPLITTER'
  | 'PROGRAMMABLE_SPLITTER'
  | 'SMART_SPLITTER';

export type StorageType =
  | 'BLUEPRINT_STORAGE_BOX'
  | 'DIMENSIONAL_DEPOT_UPLOADER'
  | 'INDUSTRIAL_STORAGE_CONTAINER'
  | 'PERSONAL_STORAGE_BOX'
  | 'STORAGE_CONTAINER';

export type TractorStatus =
  | 'MANUAL_DRIVING'
  | 'PARKED'
  | 'SELF_DRIVING'
  | 'UNKNOWN';

export type TrainRailType =
  | 'RAILWAY';

export type TrainStationPlatformMode =
  | 'EXPORT'
  | 'IMPORT';

export type TrainStationPlatformStatus =
  | 'DOCKING'
  | 'IDLE';

export type TrainStationPlatformType =
  | 'FLUID_FREIGHT'
  | 'FREIGHT';

export type TrainStatus =
  | 'DERAILED'
  | 'DOCKING'
  | 'MANUAL_DRIVING'
  | 'PARKED'
  | 'SELF_DRIVING'
  | 'UNKNOWN';

export type TrainType =
  | 'FREIGHT'
  | 'LOCOMOTIVE';

export type TruckStatus =
  | 'MANUAL_DRIVING'
  | 'PARKED'
  | 'SELF_DRIVING'
  | 'UNKNOWN';

export type UpdateSessionInput = {
  address?: string | null | undefined;
  isPaused?: boolean | null | undefined;
  name?: string | null | undefined;
};

export type VehiclePathType =
  | 'EXPLORER'
  | 'FACTORY_CART'
  | 'TRACTOR'
  | 'TRUCK';

export type SatisfactoryApiStatusChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type SatisfactoryApiStatusChangedSubscription = { satisfactoryApiStatusChanged: { running: boolean, pingMs: number } };

export type CircuitsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type CircuitsChangedSubscription = { circuitsChanged: Array<{ id: string, fuseTriggered: boolean, consumption: { total: number, max: number }, production: { total: number }, capacity: { total: number }, battery: { percentage: number, capacity: number, differential: number, untilFull: number, untilEmpty: number } }> };

export type FactoryStatsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type FactoryStatsChangedSubscription = { factoryStatsChanged: { totalMachines: number, efficiency: { machinesOperating: number, machinesIdle: number, machinesPaused: number, machinesUnconfigured: number, machinesUnknown: number } } };

export type ProdStatsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type ProdStatsChangedSubscription = { prodStatsChanged: { minableProducedPerMinute: number, minableConsumedPerMinute: number, itemsProducedPerMinute: number, itemsConsumedPerMinute: number, items: Array<{ name: string, count: number, producedPerMinute: number, maxProducePerMinute: number, produceEfficiency: number, consumedPerMinute: number, maxConsumePerMinute: number, consumeEfficiency: number, cloudCount: number, minable: boolean }> } };

export type SinkStatsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type SinkStatsChangedSubscription = { sinkStatsChanged: { totalPoints: number, coupons: number, nextCouponProgress: number, pointsPerMinute: number } };

export type PlayersChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type PlayersChangedSubscription = { playersChanged: Array<{ id: string, name: string, health: number, x: number, y: number, z: number, rotation: number, items: Array<{ name: string, count: number }> }> };

export type SessionUpdatedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type SessionUpdatedSubscription = { sessionUpdated: { id: string, name: string, address: string, sessionName: string, isPaused: boolean, createdAt: string, connectionState: ConnectionState, stage: SessionStage, offlineReason: ConnectivityReason } };

export type MachinesChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type MachinesChangedSubscription = { machinesChanged: Array<{ type: MachineType, status: MachineStatus, category: MachineCategory, productivity: number, x: number, y: number, z: number, rotation: number, circuitId: number, circuitGroupId: number | null, input: Array<{ name: string, stored: number, current: number, max: number, efficiency: number }>, output: Array<{ name: string, stored: number, current: number, max: number, efficiency: number }>, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } } }> };

export type StoragesChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type StoragesChangedSubscription = { storagesChanged: Array<{ id: string, type: StorageType, x: number, y: number, z: number, rotation: number, inventory: Array<{ name: string, count: number }>, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } } }> };

export type BeltsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type BeltsChangedSubscription = { beltsChanged: Array<{ id: string, name: string, connected0: boolean, connected1: boolean, length: number, itemsPerMinute: number, location0: { x: number, y: number, z: number, rotation: number }, location1: { x: number, y: number, z: number, rotation: number }, splineData: Array<{ x: number, y: number, z: number, rotation: number }> }> };

export type SplitterMergersChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type SplitterMergersChangedSubscription = { splitterMergersChanged: Array<{ id: string, type: SplitterMergerType, x: number, y: number, z: number, rotation: number, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } } }> };

export type PipesChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type PipesChangedSubscription = { pipesChanged: Array<{ id: string, name: string, connected0: boolean, connected1: boolean, length: number, itemsPerMinute: number, location0: { x: number, y: number, z: number, rotation: number }, location1: { x: number, y: number, z: number, rotation: number }, splineData: Array<{ x: number, y: number, z: number, rotation: number }> }> };

export type PipeJunctionsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type PipeJunctionsChangedSubscription = { pipeJunctionsChanged: Array<{ id: string, name: string, x: number, y: number, z: number, rotation: number }> };

export type CablesChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type CablesChangedSubscription = { cablesChanged: Array<{ id: string, name: string, connected0: boolean, connected1: boolean, length: number, location0: { x: number, y: number, z: number, rotation: number }, location1: { x: number, y: number, z: number, rotation: number } }> };

export type TrainRailsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type TrainRailsChangedSubscription = { trainRailsChanged: Array<{ id: string, type: TrainRailType, connected0: boolean, connected1: boolean, length: number, location0: { x: number, y: number, z: number, rotation: number }, location1: { x: number, y: number, z: number, rotation: number }, splineData: Array<{ x: number, y: number, z: number, rotation: number }> }> };

export type HypertubesChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type HypertubesChangedSubscription = { hypertubesChanged: Array<{ id: string, location0: { x: number, y: number, z: number, rotation: number }, location1: { x: number, y: number, z: number, rotation: number }, splineData: Array<{ x: number, y: number, z: number, rotation: number }>, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } } }> };

export type HypertubeEntrancesChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type HypertubeEntrancesChangedSubscription = { hypertubeEntrancesChanged: Array<{ id: string, x: number, y: number, z: number, rotation: number, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } }, powerInfo: { circuitId: number, circuitGroupId: number, powerConsumed: number, maxPowerConsumed: number } }> };

export type DronesChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type DronesChangedSubscription = { dronesChanged: Array<{ name: string, speed: number, status: DroneStatus, x: number, y: number, z: number, rotation: number, circuitId: number, circuitGroupId: number, home: { name: string, incomingRate: number, outgoingRate: number, x: number, y: number, z: number, rotation: number, circuitId: number, circuitGroupId: number | null, fuel: { name: string, amount: number } | null, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } }, inputInventory: Array<{ name: string, count: number }>, outputInventory: Array<{ name: string, count: number }> }, paired: { name: string, incomingRate: number, outgoingRate: number, x: number, y: number, z: number, rotation: number, circuitId: number, circuitGroupId: number | null, fuel: { name: string, amount: number } | null, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } }, inputInventory: Array<{ name: string, count: number }>, outputInventory: Array<{ name: string, count: number }> } | null, destination: { name: string, incomingRate: number, outgoingRate: number, x: number, y: number, z: number, rotation: number, circuitId: number, circuitGroupId: number | null, fuel: { name: string, amount: number } | null, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } }, inputInventory: Array<{ name: string, count: number }>, outputInventory: Array<{ name: string, count: number }> } | null }> };

export type DroneStationsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type DroneStationsChangedSubscription = { droneStationsChanged: Array<{ name: string, incomingRate: number, outgoingRate: number, x: number, y: number, z: number, rotation: number, circuitId: number, circuitGroupId: number | null, fuel: { name: string, amount: number } | null, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } }, inputInventory: Array<{ name: string, count: number }>, outputInventory: Array<{ name: string, count: number }> }> };

export type TrainsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type TrainsChangedSubscription = { trainsChanged: Array<{ id: string, name: string, speed: number, status: TrainStatus, powerConsumption: number, timetableIndex: number, x: number, y: number, z: number, rotation: number, circuitId: number, circuitGroupId: number | null, vehicles: Array<{ type: TrainType, capacity: number, inventory: Array<{ name: string, count: number }> }>, timetable: Array<{ station: string }> }> };

export type TrainStationsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type TrainStationsChangedSubscription = { trainStationsChanged: Array<{ name: string, x: number, y: number, z: number, rotation: number, circuitId: number, circuitGroupId: number | null, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } }, platforms: Array<{ id: string, type: TrainStationPlatformType, mode: TrainStationPlatformMode, status: TrainStationPlatformStatus, transferRate: number, inflowRate: number, outflowRate: number, x: number, y: number, z: number, rotation: number, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } }, inventory: Array<{ name: string, count: number }> }> }> };

export type TrucksChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type TrucksChangedSubscription = { trucksChanged: Array<{ id: string, name: string, speed: number, status: TruckStatus, x: number, y: number, z: number, rotation: number, circuitId: number, circuitGroupId: number | null, fuel: { name: string, amount: number } | null, inventory: Array<{ name: string, count: number }> }> };

export type TruckStationsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type TruckStationsChangedSubscription = { truckStationsChanged: Array<{ name: string, transferRate: number, maxTransferRate: number, x: number, y: number, z: number, rotation: number, circuitId: number, circuitGroupId: number | null, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } }, inventory: Array<{ name: string, count: number }> }> };

export type TractorsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type TractorsChangedSubscription = { tractorsChanged: Array<{ id: string, name: string, speed: number, status: TractorStatus, x: number, y: number, z: number, rotation: number, circuitId: number, circuitGroupId: number | null, fuel: { name: string, amount: number } | null, inventory: Array<{ name: string, count: number }> }> };

export type ExplorersChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type ExplorersChangedSubscription = { explorersChanged: Array<{ id: string, name: string, speed: number, status: ExplorerStatus, x: number, y: number, z: number, rotation: number, circuitId: number, circuitGroupId: number | null, fuel: { name: string, amount: number } | null, inventory: Array<{ name: string, count: number }> }> };

export type VehiclePathsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type VehiclePathsChangedSubscription = { vehiclePathsChanged: Array<{ name: string, vehicleType: VehiclePathType, pathLength: number, vertices: Array<{ x: number, y: number, z: number, rotation: number }> }> };

export type SpaceElevatorChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type SpaceElevatorChangedSubscription = { spaceElevatorChanged: { id: string, name: string, fullyUpgraded: boolean, upgradeReady: boolean, x: number, y: number, z: number, rotation: number, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } }, currentPhase: Array<{ name: string, amount: number, totalCost: number }> } };

export type HubChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type HubChangedSubscription = { hubChanged: { id: string, name: string, hasActiveMilestone: boolean, shipDocked: boolean, shipReturnTime: number | null, x: number, y: number, z: number, rotation: number, activeMilestone: { name: string, techTier: number, type: string, cost: Array<{ name: string, amount: number, remainingCost: number, totalCost: number }> } | null, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } } } };

export type RadarTowersChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type RadarTowersChangedSubscription = { radarTowersChanged: Array<{ id: string, revealRadius: number, x: number, y: number, z: number, rotation: number, nodes: Array<{ id: string, name: string, className: string, purity: ResourceNodePurity, resourceForm: string, resourceType: ResourceType, nodeType: NodeType, exploited: boolean, x: number, y: number, z: number, rotation: number }>, fauna: Array<{ name: FaunaType, className: string, amount: number }>, flora: Array<{ name: FloraType, className: string, amount: number }>, signal: Array<{ name: SignalType, className: string, amount: number }>, boundingBox: { min: { x: number, y: number, z: number, rotation: number }, max: { x: number, y: number, z: number, rotation: number } } }> };

export type ResourceNodesChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type ResourceNodesChangedSubscription = { resourceNodesChanged: Array<{ id: string, name: string, className: string, purity: ResourceNodePurity, resourceForm: string, resourceType: ResourceType, nodeType: NodeType, exploited: boolean, x: number, y: number, z: number, rotation: number }> };

export type SchematicsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type SchematicsChangedSubscription = { schematicsChanged: Array<{ id: string, name: string, tier: number, type: string, purchased: boolean, locked: boolean, lockedPhase: boolean, cost: Array<{ name: string, amount: number, totalCost: number }> }> };

export type GeneratorStatsChangedSubscriptionVariables = Exact<{
  sessionId: string | number;
}>;


export type GeneratorStatsChangedSubscription = { generatorStatsChanged: { sources: Array<{ type: PowerType, source: { count: number, totalProduction: number } }> } };

export type LoginMutationVariables = Exact<{
  password: string;
}>;


export type LoginMutation = { login: { success: boolean, message: string } };

export type AuthStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type AuthStatusQuery = { authStatus: { initialized: boolean, authRequired: boolean, authenticated: boolean } };

export type CompleteSetupMutationVariables = Exact<{
  setupToken: string;
  password?: string | null | undefined;
}>;


export type CompleteSetupMutation = { completeSetup: { success: boolean, message: string } };

export type ChangePasswordMutationVariables = Exact<{
  currentPassword: string;
  newPassword: string;
}>;


export type ChangePasswordMutation = { changePassword: { success: boolean, message: string } };

export type EnableAuthMutationVariables = Exact<{
  password: string;
}>;


export type EnableAuthMutation = { enableAuth: { success: boolean, message: string } };

export type DisableAuthMutationVariables = Exact<{
  currentPassword: string;
}>;


export type DisableAuthMutation = { disableAuth: { success: boolean, message: string } };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { logout: { success: boolean } };

export type CircuitsHistoryQueryVariables = Exact<{
  sessionId: string | number;
  saveName: string;
  since?: number | null | undefined;
  maxPoints?: number | null | undefined;
}>;


export type CircuitsHistoryQuery = { circuitsHistory: Array<{ gameTimeId: number, circuits: Array<{ id: string, fuseTriggered: boolean, consumption: { total: number, max: number }, production: { total: number }, capacity: { total: number }, battery: { percentage: number, capacity: number, differential: number, untilFull: number, untilEmpty: number } }> }> };

export type FactoryStatsHistoryQueryVariables = Exact<{
  sessionId: string | number;
  saveName: string;
  since?: number | null | undefined;
  maxPoints?: number | null | undefined;
}>;


export type FactoryStatsHistoryQuery = { factoryStatsHistory: Array<{ gameTimeId: number, factoryStats: { totalMachines: number, efficiency: { machinesOperating: number, machinesIdle: number, machinesPaused: number, machinesUnconfigured: number, machinesUnknown: number } } }> };

export type ProdStatsHistoryQueryVariables = Exact<{
  sessionId: string | number;
  saveName: string;
  since?: number | null | undefined;
  maxPoints?: number | null | undefined;
}>;


export type ProdStatsHistoryQuery = { prodStatsHistory: Array<{ gameTimeId: number, prodStats: { minableProducedPerMinute: number, minableConsumedPerMinute: number, itemsProducedPerMinute: number, itemsConsumedPerMinute: number, items: Array<{ name: string, count: number, producedPerMinute: number, maxProducePerMinute: number, produceEfficiency: number, consumedPerMinute: number, maxConsumePerMinute: number, consumeEfficiency: number, cloudCount: number, minable: boolean }> } }> };

export type GeneratorStatsHistoryQueryVariables = Exact<{
  sessionId: string | number;
  saveName: string;
  since?: number | null | undefined;
  maxPoints?: number | null | undefined;
}>;


export type GeneratorStatsHistoryQuery = { generatorStatsHistory: Array<{ gameTimeId: number, generatorStats: { sources: Array<{ type: PowerType, source: { count: number, totalProduction: number } }> } }> };

export type SinkStatsHistoryQueryVariables = Exact<{
  sessionId: string | number;
  saveName: string;
  since?: number | null | undefined;
  maxPoints?: number | null | undefined;
}>;


export type SinkStatsHistoryQuery = { sinkStatsHistory: Array<{ gameTimeId: number, sinkStats: { totalPoints: number, coupons: number, nextCouponProgress: number, pointsPerMinute: number } }> };

export type HistorySavesQueryVariables = Exact<{
  sessionId: string | number;
}>;


export type HistorySavesQuery = { historySaves: Array<string> };

export type SessionsQueryVariables = Exact<{ [key: string]: never; }>;


export type SessionsQuery = { sessions: Array<{ id: string, name: string, address: string, sessionName: string, isPaused: boolean, createdAt: string, connectionState: ConnectionState, stage: SessionStage, offlineReason: ConnectivityReason }> };

export type SessionQueryVariables = Exact<{
  id: string | number;
}>;


export type SessionQuery = { session: { id: string, name: string, address: string, sessionName: string, isPaused: boolean, createdAt: string, connectionState: ConnectionState, stage: SessionStage, offlineReason: ConnectivityReason } | null };

export type CreateSessionMutationVariables = Exact<{
  name: string;
  address: string;
}>;


export type CreateSessionMutation = { createSession: { id: string, name: string, address: string, sessionName: string, isPaused: boolean, createdAt: string, connectionState: ConnectionState, stage: SessionStage, offlineReason: ConnectivityReason } };

export type UpdateSessionMutationVariables = Exact<{
  id: string | number;
  input: UpdateSessionInput;
}>;


export type UpdateSessionMutation = { updateSession: { id: string, name: string, address: string, sessionName: string, isPaused: boolean, createdAt: string, connectionState: ConnectionState, stage: SessionStage, offlineReason: ConnectivityReason } };

export type DeleteSessionMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteSessionMutation = { deleteSession: boolean };

export type ValidateSessionMutationVariables = Exact<{
  id: string | number;
}>;


export type ValidateSessionMutation = { validateSession: { sessionName: string, isPaused: boolean, dayLength: number, nightLength: number, passedDays: number, numberOfDaysSinceLastDeath: number, hours: number, minutes: number, seconds: number, isDay: boolean, totalPlayDuration: number, totalPlayDurationText: string } };

export type PreviewSessionQueryVariables = Exact<{
  address: string;
}>;


export type PreviewSessionQuery = { previewSession: { sessionName: string, isPaused: boolean, dayLength: number, nightLength: number, passedDays: number, numberOfDaysSinceLastDeath: number, hours: number, minutes: number, seconds: number, isDay: boolean, totalPlayDuration: number, totalPlayDurationText: string } };

export type ClientIpQueryVariables = Exact<{ [key: string]: never; }>;


export type ClientIpQuery = { clientIp: string };

export type SettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type SettingsQuery = { settings: { logLevel: LogLevel } };

export type UpdateSettingsMutationVariables = Exact<{
  logLevel: LogLevel;
}>;


export type UpdateSettingsMutation = { updateSettings: { logLevel: LogLevel } };


export const SatisfactoryApiStatusChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"SatisfactoryApiStatusChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"satisfactoryApiStatusChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"running"}},{"kind":"Field","name":{"kind":"Name","value":"pingMs"}}]}}]}}]} as unknown as DocumentNode<SatisfactoryApiStatusChangedSubscription, SatisfactoryApiStatusChangedSubscriptionVariables>;
export const CircuitsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"CircuitsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"circuitsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fuseTriggered"}},{"kind":"Field","name":{"kind":"Name","value":"consumption"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"production"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"capacity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"battery"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"capacity"}},{"kind":"Field","name":{"kind":"Name","value":"differential"}},{"kind":"Field","name":{"kind":"Name","value":"untilFull"}},{"kind":"Field","name":{"kind":"Name","value":"untilEmpty"}}]}}]}}]}}]} as unknown as DocumentNode<CircuitsChangedSubscription, CircuitsChangedSubscriptionVariables>;
export const FactoryStatsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"FactoryStatsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"factoryStatsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalMachines"}},{"kind":"Field","name":{"kind":"Name","value":"efficiency"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"machinesOperating"}},{"kind":"Field","name":{"kind":"Name","value":"machinesIdle"}},{"kind":"Field","name":{"kind":"Name","value":"machinesPaused"}},{"kind":"Field","name":{"kind":"Name","value":"machinesUnconfigured"}},{"kind":"Field","name":{"kind":"Name","value":"machinesUnknown"}}]}}]}}]}}]} as unknown as DocumentNode<FactoryStatsChangedSubscription, FactoryStatsChangedSubscriptionVariables>;
export const ProdStatsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"ProdStatsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"prodStatsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"minableProducedPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"minableConsumedPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"itemsProducedPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"itemsConsumedPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"producedPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"maxProducePerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"produceEfficiency"}},{"kind":"Field","name":{"kind":"Name","value":"consumedPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"maxConsumePerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"consumeEfficiency"}},{"kind":"Field","name":{"kind":"Name","value":"cloudCount"}},{"kind":"Field","name":{"kind":"Name","value":"minable"}}]}}]}}]}}]} as unknown as DocumentNode<ProdStatsChangedSubscription, ProdStatsChangedSubscriptionVariables>;
export const SinkStatsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"SinkStatsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sinkStatsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalPoints"}},{"kind":"Field","name":{"kind":"Name","value":"coupons"}},{"kind":"Field","name":{"kind":"Name","value":"nextCouponProgress"}},{"kind":"Field","name":{"kind":"Name","value":"pointsPerMinute"}}]}}]}}]} as unknown as DocumentNode<SinkStatsChangedSubscription, SinkStatsChangedSubscriptionVariables>;
export const PlayersChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"PlayersChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"playersChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"health"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}}]} as unknown as DocumentNode<PlayersChangedSubscription, PlayersChangedSubscriptionVariables>;
export const SessionUpdatedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"SessionUpdated"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessionUpdated"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"sessionName"}},{"kind":"Field","name":{"kind":"Name","value":"isPaused"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"connectionState"}},{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"offlineReason"}}]}}]}}]} as unknown as DocumentNode<SessionUpdatedSubscription, SessionUpdatedSubscriptionVariables>;
export const MachinesChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"MachinesChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"machinesChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"productivity"}},{"kind":"Field","name":{"kind":"Name","value":"input"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"stored"}},{"kind":"Field","name":{"kind":"Name","value":"current"}},{"kind":"Field","name":{"kind":"Name","value":"max"}},{"kind":"Field","name":{"kind":"Name","value":"efficiency"}}]}},{"kind":"Field","name":{"kind":"Name","value":"output"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"stored"}},{"kind":"Field","name":{"kind":"Name","value":"current"}},{"kind":"Field","name":{"kind":"Name","value":"max"}},{"kind":"Field","name":{"kind":"Name","value":"efficiency"}}]}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}}]}}]}}]} as unknown as DocumentNode<MachinesChangedSubscription, MachinesChangedSubscriptionVariables>;
export const StoragesChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"StoragesChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"storagesChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"inventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}}]} as unknown as DocumentNode<StoragesChangedSubscription, StoragesChangedSubscriptionVariables>;
export const BeltsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"BeltsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"beltsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"location0"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"location1"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"connected0"}},{"kind":"Field","name":{"kind":"Name","value":"connected1"}},{"kind":"Field","name":{"kind":"Name","value":"splineData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"length"}},{"kind":"Field","name":{"kind":"Name","value":"itemsPerMinute"}}]}}]}}]} as unknown as DocumentNode<BeltsChangedSubscription, BeltsChangedSubscriptionVariables>;
export const SplitterMergersChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"SplitterMergersChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"splitterMergersChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SplitterMergersChangedSubscription, SplitterMergersChangedSubscriptionVariables>;
export const PipesChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"PipesChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pipesChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"location0"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"location1"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"connected0"}},{"kind":"Field","name":{"kind":"Name","value":"connected1"}},{"kind":"Field","name":{"kind":"Name","value":"splineData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"length"}},{"kind":"Field","name":{"kind":"Name","value":"itemsPerMinute"}}]}}]}}]} as unknown as DocumentNode<PipesChangedSubscription, PipesChangedSubscriptionVariables>;
export const PipeJunctionsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"PipeJunctionsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pipeJunctionsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}}]} as unknown as DocumentNode<PipeJunctionsChangedSubscription, PipeJunctionsChangedSubscriptionVariables>;
export const CablesChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"CablesChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cablesChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"location0"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"location1"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"connected0"}},{"kind":"Field","name":{"kind":"Name","value":"connected1"}},{"kind":"Field","name":{"kind":"Name","value":"length"}}]}}]}}]} as unknown as DocumentNode<CablesChangedSubscription, CablesChangedSubscriptionVariables>;
export const TrainRailsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"TrainRailsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trainRailsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"location0"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"location1"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"connected0"}},{"kind":"Field","name":{"kind":"Name","value":"connected1"}},{"kind":"Field","name":{"kind":"Name","value":"splineData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"length"}}]}}]}}]} as unknown as DocumentNode<TrainRailsChangedSubscription, TrainRailsChangedSubscriptionVariables>;
export const HypertubesChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"HypertubesChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hypertubesChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"location0"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"location1"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"splineData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}}]}}]}}]} as unknown as DocumentNode<HypertubesChangedSubscription, HypertubesChangedSubscriptionVariables>;
export const HypertubeEntrancesChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"HypertubeEntrancesChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hypertubeEntrancesChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"powerInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}},{"kind":"Field","name":{"kind":"Name","value":"powerConsumed"}},{"kind":"Field","name":{"kind":"Name","value":"maxPowerConsumed"}}]}}]}}]}}]} as unknown as DocumentNode<HypertubeEntrancesChangedSubscription, HypertubeEntrancesChangedSubscriptionVariables>;
export const DronesChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"DronesChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dronesChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"home"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"fuel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"incomingRate"}},{"kind":"Field","name":{"kind":"Name","value":"outgoingRate"}},{"kind":"Field","name":{"kind":"Name","value":"inputInventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"outputInventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"paired"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"fuel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"incomingRate"}},{"kind":"Field","name":{"kind":"Name","value":"outgoingRate"}},{"kind":"Field","name":{"kind":"Name","value":"inputInventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"outputInventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"destination"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"fuel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"incomingRate"}},{"kind":"Field","name":{"kind":"Name","value":"outgoingRate"}},{"kind":"Field","name":{"kind":"Name","value":"inputInventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"outputInventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}}]}}]}}]} as unknown as DocumentNode<DronesChangedSubscription, DronesChangedSubscriptionVariables>;
export const DroneStationsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"DroneStationsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"droneStationsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"fuel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"incomingRate"}},{"kind":"Field","name":{"kind":"Name","value":"outgoingRate"}},{"kind":"Field","name":{"kind":"Name","value":"inputInventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"outputInventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}}]}}]}}]} as unknown as DocumentNode<DroneStationsChangedSubscription, DroneStationsChangedSubscriptionVariables>;
export const TrainsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"TrainsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trainsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"powerConsumption"}},{"kind":"Field","name":{"kind":"Name","value":"vehicles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"capacity"}},{"kind":"Field","name":{"kind":"Name","value":"inventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"timetable"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"station"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timetableIndex"}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}}]}}]}}]} as unknown as DocumentNode<TrainsChangedSubscription, TrainsChangedSubscriptionVariables>;
export const TrainStationsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"TrainStationsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trainStationsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"platforms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"inventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"transferRate"}},{"kind":"Field","name":{"kind":"Name","value":"inflowRate"}},{"kind":"Field","name":{"kind":"Name","value":"outflowRate"}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}}]}}]}}]} as unknown as DocumentNode<TrainStationsChangedSubscription, TrainStationsChangedSubscriptionVariables>;
export const TrucksChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"TrucksChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trucksChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"fuel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"inventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}}]}}]}}]} as unknown as DocumentNode<TrucksChangedSubscription, TrucksChangedSubscriptionVariables>;
export const TruckStationsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"TruckStationsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"truckStationsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"transferRate"}},{"kind":"Field","name":{"kind":"Name","value":"maxTransferRate"}},{"kind":"Field","name":{"kind":"Name","value":"inventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}}]}}]}}]} as unknown as DocumentNode<TruckStationsChangedSubscription, TruckStationsChangedSubscriptionVariables>;
export const TractorsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"TractorsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tractorsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"fuel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"inventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}}]}}]}}]} as unknown as DocumentNode<TractorsChangedSubscription, TractorsChangedSubscriptionVariables>;
export const ExplorersChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"ExplorersChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"explorersChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"fuel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"inventory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"circuitId"}},{"kind":"Field","name":{"kind":"Name","value":"circuitGroupId"}}]}}]}}]} as unknown as DocumentNode<ExplorersChangedSubscription, ExplorersChangedSubscriptionVariables>;
export const VehiclePathsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"VehiclePathsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"vehiclePathsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"vehicleType"}},{"kind":"Field","name":{"kind":"Name","value":"pathLength"}},{"kind":"Field","name":{"kind":"Name","value":"vertices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}}]}}]} as unknown as DocumentNode<VehiclePathsChangedSubscription, VehiclePathsChangedSubscriptionVariables>;
export const SpaceElevatorChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"SpaceElevatorChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"spaceElevatorChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"currentPhase"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fullyUpgraded"}},{"kind":"Field","name":{"kind":"Name","value":"upgradeReady"}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}}]} as unknown as DocumentNode<SpaceElevatorChangedSubscription, SpaceElevatorChangedSubscriptionVariables>;
export const HubChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"HubChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hubChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"hasActiveMilestone"}},{"kind":"Field","name":{"kind":"Name","value":"activeMilestone"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"techTier"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"cost"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"remainingCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipDocked"}},{"kind":"Field","name":{"kind":"Name","value":"shipReturnTime"}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}}]} as unknown as DocumentNode<HubChangedSubscription, HubChangedSubscriptionVariables>;
export const RadarTowersChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"RadarTowersChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"radarTowersChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"revealRadius"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"purity"}},{"kind":"Field","name":{"kind":"Name","value":"resourceForm"}},{"kind":"Field","name":{"kind":"Name","value":"resourceType"}},{"kind":"Field","name":{"kind":"Name","value":"nodeType"}},{"kind":"Field","name":{"kind":"Name","value":"exploited"}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fauna"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"flora"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"signal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"boundingBox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}}]} as unknown as DocumentNode<RadarTowersChangedSubscription, RadarTowersChangedSubscriptionVariables>;
export const ResourceNodesChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"ResourceNodesChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resourceNodesChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"purity"}},{"kind":"Field","name":{"kind":"Name","value":"resourceForm"}},{"kind":"Field","name":{"kind":"Name","value":"resourceType"}},{"kind":"Field","name":{"kind":"Name","value":"nodeType"}},{"kind":"Field","name":{"kind":"Name","value":"exploited"}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"z"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}}]}}]}}]} as unknown as DocumentNode<ResourceNodesChangedSubscription, ResourceNodesChangedSubscriptionVariables>;
export const SchematicsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"SchematicsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"schematicsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"tier"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"purchased"}},{"kind":"Field","name":{"kind":"Name","value":"locked"}},{"kind":"Field","name":{"kind":"Name","value":"lockedPhase"}},{"kind":"Field","name":{"kind":"Name","value":"cost"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}}]}}]}}]}}]} as unknown as DocumentNode<SchematicsChangedSubscription, SchematicsChangedSubscriptionVariables>;
export const GeneratorStatsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"GeneratorStatsChanged"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generatorStatsChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"totalProduction"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GeneratorStatsChangedSubscription, GeneratorStatsChangedSubscriptionVariables>;
export const LoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Login"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<LoginMutation, LoginMutationVariables>;
export const AuthStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AuthStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"authStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"initialized"}},{"kind":"Field","name":{"kind":"Name","value":"authRequired"}},{"kind":"Field","name":{"kind":"Name","value":"authenticated"}}]}}]}}]} as unknown as DocumentNode<AuthStatusQuery, AuthStatusQueryVariables>;
export const CompleteSetupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteSetup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"setupToken"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeSetup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"setupToken"},"value":{"kind":"Variable","name":{"kind":"Name","value":"setupToken"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<CompleteSetupMutation, CompleteSetupMutationVariables>;
export const ChangePasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangePassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"currentPassword"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"newPassword"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changePassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"currentPassword"},"value":{"kind":"Variable","name":{"kind":"Name","value":"currentPassword"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"newPassword"},"value":{"kind":"Variable","name":{"kind":"Name","value":"newPassword"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<ChangePasswordMutation, ChangePasswordMutationVariables>;
export const EnableAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EnableAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"enableAuth"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<EnableAuthMutation, EnableAuthMutationVariables>;
export const DisableAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DisableAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"currentPassword"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"disableAuth"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"currentPassword"},"value":{"kind":"Variable","name":{"kind":"Name","value":"currentPassword"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<DisableAuthMutation, DisableAuthMutationVariables>;
export const LogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Logout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}}]}}]} as unknown as DocumentNode<LogoutMutation, LogoutMutationVariables>;
export const CircuitsHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CircuitsHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"saveName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"circuitsHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"saveName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"saveName"}}},{"kind":"Argument","name":{"kind":"Name","value":"since"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}},{"kind":"Argument","name":{"kind":"Name","value":"maxPoints"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gameTimeId"}},{"kind":"Field","name":{"kind":"Name","value":"circuits"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fuseTriggered"}},{"kind":"Field","name":{"kind":"Name","value":"consumption"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"production"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"capacity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"battery"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"capacity"}},{"kind":"Field","name":{"kind":"Name","value":"differential"}},{"kind":"Field","name":{"kind":"Name","value":"untilFull"}},{"kind":"Field","name":{"kind":"Name","value":"untilEmpty"}}]}}]}}]}}]}}]} as unknown as DocumentNode<CircuitsHistoryQuery, CircuitsHistoryQueryVariables>;
export const FactoryStatsHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FactoryStatsHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"saveName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"factoryStatsHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"saveName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"saveName"}}},{"kind":"Argument","name":{"kind":"Name","value":"since"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}},{"kind":"Argument","name":{"kind":"Name","value":"maxPoints"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gameTimeId"}},{"kind":"Field","name":{"kind":"Name","value":"factoryStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalMachines"}},{"kind":"Field","name":{"kind":"Name","value":"efficiency"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"machinesOperating"}},{"kind":"Field","name":{"kind":"Name","value":"machinesIdle"}},{"kind":"Field","name":{"kind":"Name","value":"machinesPaused"}},{"kind":"Field","name":{"kind":"Name","value":"machinesUnconfigured"}},{"kind":"Field","name":{"kind":"Name","value":"machinesUnknown"}}]}}]}}]}}]}}]} as unknown as DocumentNode<FactoryStatsHistoryQuery, FactoryStatsHistoryQueryVariables>;
export const ProdStatsHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ProdStatsHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"saveName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"prodStatsHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"saveName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"saveName"}}},{"kind":"Argument","name":{"kind":"Name","value":"since"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}},{"kind":"Argument","name":{"kind":"Name","value":"maxPoints"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gameTimeId"}},{"kind":"Field","name":{"kind":"Name","value":"prodStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"minableProducedPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"minableConsumedPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"itemsProducedPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"itemsConsumedPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"producedPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"maxProducePerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"produceEfficiency"}},{"kind":"Field","name":{"kind":"Name","value":"consumedPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"maxConsumePerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"consumeEfficiency"}},{"kind":"Field","name":{"kind":"Name","value":"cloudCount"}},{"kind":"Field","name":{"kind":"Name","value":"minable"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ProdStatsHistoryQuery, ProdStatsHistoryQueryVariables>;
export const GeneratorStatsHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GeneratorStatsHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"saveName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generatorStatsHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"saveName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"saveName"}}},{"kind":"Argument","name":{"kind":"Name","value":"since"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}},{"kind":"Argument","name":{"kind":"Name","value":"maxPoints"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gameTimeId"}},{"kind":"Field","name":{"kind":"Name","value":"generatorStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"totalProduction"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<GeneratorStatsHistoryQuery, GeneratorStatsHistoryQueryVariables>;
export const SinkStatsHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SinkStatsHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"saveName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sinkStatsHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"saveName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"saveName"}}},{"kind":"Argument","name":{"kind":"Name","value":"since"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}},{"kind":"Argument","name":{"kind":"Name","value":"maxPoints"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gameTimeId"}},{"kind":"Field","name":{"kind":"Name","value":"sinkStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalPoints"}},{"kind":"Field","name":{"kind":"Name","value":"coupons"}},{"kind":"Field","name":{"kind":"Name","value":"nextCouponProgress"}},{"kind":"Field","name":{"kind":"Name","value":"pointsPerMinute"}}]}}]}}]}}]} as unknown as DocumentNode<SinkStatsHistoryQuery, SinkStatsHistoryQueryVariables>;
export const HistorySavesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"HistorySaves"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"historySaves"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}]}]}}]} as unknown as DocumentNode<HistorySavesQuery, HistorySavesQueryVariables>;
export const SessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"sessionName"}},{"kind":"Field","name":{"kind":"Name","value":"isPaused"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"connectionState"}},{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"offlineReason"}}]}}]}}]} as unknown as DocumentNode<SessionsQuery, SessionsQueryVariables>;
export const SessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Session"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"sessionName"}},{"kind":"Field","name":{"kind":"Name","value":"isPaused"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"connectionState"}},{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"offlineReason"}}]}}]}}]} as unknown as DocumentNode<SessionQuery, SessionQueryVariables>;
export const CreateSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"address"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"address"},"value":{"kind":"Variable","name":{"kind":"Name","value":"address"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"sessionName"}},{"kind":"Field","name":{"kind":"Name","value":"isPaused"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"connectionState"}},{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"offlineReason"}}]}}]}}]} as unknown as DocumentNode<CreateSessionMutation, CreateSessionMutationVariables>;
export const UpdateSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateSessionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"sessionName"}},{"kind":"Field","name":{"kind":"Name","value":"isPaused"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"connectionState"}},{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"offlineReason"}}]}}]}}]} as unknown as DocumentNode<UpdateSessionMutation, UpdateSessionMutationVariables>;
export const DeleteSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteSessionMutation, DeleteSessionMutationVariables>;
export const ValidateSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ValidateSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"validateSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessionName"}},{"kind":"Field","name":{"kind":"Name","value":"isPaused"}},{"kind":"Field","name":{"kind":"Name","value":"dayLength"}},{"kind":"Field","name":{"kind":"Name","value":"nightLength"}},{"kind":"Field","name":{"kind":"Name","value":"passedDays"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfDaysSinceLastDeath"}},{"kind":"Field","name":{"kind":"Name","value":"hours"}},{"kind":"Field","name":{"kind":"Name","value":"minutes"}},{"kind":"Field","name":{"kind":"Name","value":"seconds"}},{"kind":"Field","name":{"kind":"Name","value":"isDay"}},{"kind":"Field","name":{"kind":"Name","value":"totalPlayDuration"}},{"kind":"Field","name":{"kind":"Name","value":"totalPlayDurationText"}}]}}]}}]} as unknown as DocumentNode<ValidateSessionMutation, ValidateSessionMutationVariables>;
export const PreviewSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PreviewSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"address"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"previewSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"address"},"value":{"kind":"Variable","name":{"kind":"Name","value":"address"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessionName"}},{"kind":"Field","name":{"kind":"Name","value":"isPaused"}},{"kind":"Field","name":{"kind":"Name","value":"dayLength"}},{"kind":"Field","name":{"kind":"Name","value":"nightLength"}},{"kind":"Field","name":{"kind":"Name","value":"passedDays"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfDaysSinceLastDeath"}},{"kind":"Field","name":{"kind":"Name","value":"hours"}},{"kind":"Field","name":{"kind":"Name","value":"minutes"}},{"kind":"Field","name":{"kind":"Name","value":"seconds"}},{"kind":"Field","name":{"kind":"Name","value":"isDay"}},{"kind":"Field","name":{"kind":"Name","value":"totalPlayDuration"}},{"kind":"Field","name":{"kind":"Name","value":"totalPlayDurationText"}}]}}]}}]} as unknown as DocumentNode<PreviewSessionQuery, PreviewSessionQueryVariables>;
export const ClientIpDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ClientIp"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clientIp"}}]}}]} as unknown as DocumentNode<ClientIpQuery, ClientIpQueryVariables>;
export const SettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logLevel"}}]}}]}}]} as unknown as DocumentNode<SettingsQuery, SettingsQueryVariables>;
export const UpdateSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"logLevel"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LogLevel"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"logLevel"},"value":{"kind":"Variable","name":{"kind":"Name","value":"logLevel"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logLevel"}}]}}]}}]} as unknown as DocumentNode<UpdateSettingsMutation, UpdateSettingsMutationVariables>;