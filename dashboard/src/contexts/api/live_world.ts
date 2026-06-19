import { graphql } from 'src/gql';
import type {
  BoundingBox,
  FaunaType,
  FloraType,
  GeneratorStats,
  Hub,
  Location,
  NodeType,
  PowerSource,
  PowerType,
  RadarTower,
  ResourceNode,
  ResourceNodePurity,
  ResourceType,
  ScannedFauna,
  ScannedFlora,
  ScannedSignal,
  Schematic,
  SignalType,
  SpaceElevator,
} from 'src/apiTypes';

export const SpaceElevatorChangedSub = graphql(`
  subscription SpaceElevatorChanged($sessionId: ID!) {
    spaceElevatorChanged(sessionId: $sessionId) {
      id
      name
      boundingBox {
        min {
          x
          y
          z
          rotation
        }
        max {
          x
          y
          z
          rotation
        }
      }
      currentPhase {
        name
        amount
        totalCost
      }
      fullyUpgraded
      upgradeReady
      x
      y
      z
      rotation
    }
  }
`);

export const HubChangedSub = graphql(`
  subscription HubChanged($sessionId: ID!) {
    hubChanged(sessionId: $sessionId) {
      id
      name
      hasActiveMilestone
      activeMilestone {
        name
        techTier
        type
        cost {
          name
          amount
          remainingCost
          totalCost
        }
      }
      shipDocked
      shipReturnTime
      boundingBox {
        min {
          x
          y
          z
          rotation
        }
        max {
          x
          y
          z
          rotation
        }
      }
      x
      y
      z
      rotation
    }
  }
`);

export const RadarTowersChangedSub = graphql(`
  subscription RadarTowersChanged($sessionId: ID!) {
    radarTowersChanged(sessionId: $sessionId) {
      id
      revealRadius
      nodes {
        id
        name
        className
        purity
        resourceForm
        resourceType
        nodeType
        exploited
        x
        y
        z
        rotation
      }
      fauna {
        name
        className
        amount
      }
      flora {
        name
        className
        amount
      }
      signal {
        name
        className
        amount
      }
      boundingBox {
        min {
          x
          y
          z
          rotation
        }
        max {
          x
          y
          z
          rotation
        }
      }
      x
      y
      z
      rotation
    }
  }
`);

export const ResourceNodesChangedSub = graphql(`
  subscription ResourceNodesChanged($sessionId: ID!) {
    resourceNodesChanged(sessionId: $sessionId) {
      id
      name
      className
      purity
      resourceForm
      resourceType
      nodeType
      exploited
      x
      y
      z
      rotation
    }
  }
`);

export const SchematicsChangedSub = graphql(`
  subscription SchematicsChanged($sessionId: ID!) {
    schematicsChanged(sessionId: $sessionId) {
      id
      name
      tier
      type
      purchased
      locked
      lockedPhase
      cost {
        name
        amount
        totalCost
      }
    }
  }
`);

export const GeneratorStatsChangedSub = graphql(`
  subscription GeneratorStatsChanged($sessionId: ID!) {
    generatorStatsChanged(sessionId: $sessionId) {
      sources {
        type
        source {
          count
          totalProduction
        }
      }
    }
  }
`);

const resourceNodePurityMap_world: Record<string, ResourceNodePurity> = {
  IMPURE: 'Impure',
  NORMAL: 'Normal',
  PURE: 'Pure',
};

const resourceTypeMap_world: Record<string, ResourceType> = {
  IRON_ORE: 'Iron Ore',
  COPPER_ORE: 'Copper Ore',
  LIMESTONE: 'Limestone',
  COAL: 'Coal',
  SAM: 'SAM',
  SULFUR: 'Sulfur',
  CATERIUM_ORE: 'Caterium Ore',
  BAUXITE: 'Bauxite',
  RAW_QUARTZ: 'Raw Quartz',
  URANIUM: 'Uranium',
  CRUDE_OIL: 'Crude Oil',
  GEYSER: 'Geyser',
  NITROGEN_GAS: 'Nitrogen Gas',
};

const nodeTypeMap_world: Record<string, NodeType> = {
  NODE: 'Node',
  GEYSER: 'Geyser',
  FRACKING_CORE: 'Fracking Core',
  FRACKING_SATELLITE: 'Fracking Satellite',
};

const faunaTypeMap_world: Record<string, FaunaType> = {
  LIZARD_DOGGO: 'Lizard Doggo',
  FLUFFY_TAILED_HOG: 'Fluffy-Tailed Hog',
  SPITTER: 'Spitter',
  STINGER: 'Stinger',
  FLYING_CRAB: 'Flying Crab',
  NON_FLYING_BIRD: 'Non-flying Bird',
  SPACE_GIRAFFE: 'Space Giraffe-Tick-Penguin-Whale Thing',
  SPORE_FLOWER: 'Spore Flower',
  LEAF_BUG: 'Leaf Bug',
  GRASS_SPRITE: 'Grass Sprite',
  CAVE_BAT: 'Cave Bat',
  GIANT_FLYING_MANTA: 'Giant Flying Manta',
  LAKE_SHARK: 'Lake Shark',
  WALKER: 'Walker',
};

const floraTypeMap_world: Record<string, FloraType> = {
  TREE: 'Tree',
  LEAVES: 'Leaves',
  FLOWER_PETALS: 'Flower Petals',
  BACON_AGARIC: 'Bacon Agaric',
  PALEBERRY: 'Paleberry',
  BERYL_NUT: 'Beryl Nut',
  MYCELIA: 'Mycelia',
  VINES: 'Vines',
  BLUE_CAP_MUSHROOM: 'Blue Cap Mushroom',
  PINK_JELLYFISH: 'Pink Jellyfish',
};

const signalTypeMap_world: Record<string, SignalType> = {
  SOMERSLOOP: 'Somersloop',
  MERCER_SPHERE: 'Mercer Sphere',
  BLUE_POWER_SLUG: 'Blue Power Slug',
  YELLOW_POWER_SLUG: 'Yellow Power Slug',
  PURPLE_POWER_SLUG: 'Purple Power Slug',
  HARD_DRIVE: 'Hard Drive',
};

const powerTypeMap_world: Record<string, PowerType> = {
  BIOMASS: 'biomass',
  COAL: 'coal',
  FUEL: 'fuel',
  GEOTHERMAL: 'geothermal',
  NUCLEAR: 'nuclear',
  UNKNOWN: 'unknown',
};

type LocationGql = { x: number; y: number; z: number; rotation: number };

const mapLocation_world = (g: LocationGql): Location => ({
  x: g.x,
  y: g.y,
  z: g.z,
  rotation: g.rotation,
});

const mapBoundingBox_world = (g: { min: LocationGql; max: LocationGql }): BoundingBox => ({
  min: mapLocation_world(g.min),
  max: mapLocation_world(g.max),
});

type SpaceElevatorGql = {
  id: string;
  name: string;
  boundingBox: { min: LocationGql; max: LocationGql };
  currentPhase: { name: string; amount: number; totalCost: number }[];
  fullyUpgraded: boolean;
  upgradeReady: boolean;
  x: number;
  y: number;
  z: number;
  rotation: number;
};

export const mapSpaceElevator_world = (g: SpaceElevatorGql): SpaceElevator => ({
  id: g.id,
  name: g.name,
  boundingBox: mapBoundingBox_world(g.boundingBox),
  currentPhase: g.currentPhase.map((p) => ({
    name: p.name,
    amount: p.amount,
    totalCost: p.totalCost,
  })),
  fullyUpgraded: g.fullyUpgraded,
  upgradeReady: g.upgradeReady,
  x: g.x,
  y: g.y,
  z: g.z,
  rotation: g.rotation,
});

type HubGql = {
  id: string;
  name: string;
  hasActiveMilestone: boolean;
  activeMilestone?: {
    name: string;
    techTier: number;
    type: string;
    cost: { name: string; amount: number; remainingCost: number; totalCost: number }[];
  } | null;
  shipDocked: boolean;
  shipReturnTime?: number | null;
  boundingBox: { min: LocationGql; max: LocationGql };
  x: number;
  y: number;
  z: number;
  rotation: number;
};

export const mapHub_world = (g: HubGql): Hub => ({
  id: g.id,
  name: g.name,
  hasActiveMilestone: g.hasActiveMilestone,
  activeMilestone: g.activeMilestone
    ? {
        name: g.activeMilestone.name,
        techTier: g.activeMilestone.techTier,
        type: g.activeMilestone.type,
        cost: g.activeMilestone.cost.map((c) => ({
          name: c.name,
          amount: c.amount,
          remainingCost: c.remainingCost,
          totalCost: c.totalCost,
        })),
      }
    : undefined,
  shipDocked: g.shipDocked,
  shipReturnTime: g.shipReturnTime ?? undefined,
  boundingBox: mapBoundingBox_world(g.boundingBox),
  x: g.x,
  y: g.y,
  z: g.z,
  rotation: g.rotation,
});

type ResourceNodeGql = {
  id: string;
  name: string;
  className: string;
  purity: string;
  resourceForm: string;
  resourceType: string;
  nodeType: string;
  exploited: boolean;
  x: number;
  y: number;
  z: number;
  rotation: number;
};

export const mapResourceNode_world = (g: ResourceNodeGql): ResourceNode => ({
  id: g.id,
  name: g.name,
  className: g.className,
  purity: resourceNodePurityMap_world[g.purity] ?? g.purity,
  resourceForm: g.resourceForm,
  resourceType: resourceTypeMap_world[g.resourceType] ?? g.resourceType,
  nodeType: nodeTypeMap_world[g.nodeType] ?? g.nodeType,
  exploited: g.exploited,
  x: g.x,
  y: g.y,
  z: g.z,
  rotation: g.rotation,
});

export const mapResourceNodes_world = (g: ResourceNodeGql[]): ResourceNode[] =>
  g.map(mapResourceNode_world);

type ScannedFaunaGql = { name: string; className: string; amount: number };
type ScannedFloraGql = { name: string; className: string; amount: number };
type ScannedSignalGql = { name: string; className: string; amount: number };

const mapScannedFauna_world = (g: ScannedFaunaGql): ScannedFauna => ({
  name: faunaTypeMap_world[g.name] ?? g.name,
  className: g.className,
  amount: g.amount,
});

const mapScannedFlora_world = (g: ScannedFloraGql): ScannedFlora => ({
  name: floraTypeMap_world[g.name] ?? g.name,
  className: g.className,
  amount: g.amount,
});

const mapScannedSignal_world = (g: ScannedSignalGql): ScannedSignal => ({
  name: signalTypeMap_world[g.name] ?? g.name,
  className: g.className,
  amount: g.amount,
});

type RadarTowerGql = {
  id: string;
  revealRadius: number;
  nodes: ResourceNodeGql[];
  fauna: ScannedFaunaGql[];
  flora: ScannedFloraGql[];
  signal: ScannedSignalGql[];
  boundingBox: { min: LocationGql; max: LocationGql };
  x: number;
  y: number;
  z: number;
  rotation: number;
};

export const mapRadarTower_world = (g: RadarTowerGql): RadarTower => ({
  id: g.id,
  revealRadius: g.revealRadius,
  nodes: g.nodes.map(mapResourceNode_world),
  fauna: g.fauna.map(mapScannedFauna_world),
  flora: g.flora.map(mapScannedFlora_world),
  signal: g.signal.map(mapScannedSignal_world),
  boundingBox: mapBoundingBox_world(g.boundingBox),
  x: g.x,
  y: g.y,
  z: g.z,
  rotation: g.rotation,
});

export const mapRadarTowers_world = (g: RadarTowerGql[]): RadarTower[] =>
  g.map(mapRadarTower_world);

type SchematicGql = {
  id: string;
  name: string;
  tier: number;
  type: string;
  purchased: boolean;
  locked: boolean;
  lockedPhase: boolean;
  cost: { name: string; amount: number; totalCost: number }[];
};

export const mapSchematic_world = (g: SchematicGql): Schematic => ({
  id: g.id,
  name: g.name,
  tier: g.tier,
  type: g.type,
  purchased: g.purchased,
  locked: g.locked,
  lockedPhase: g.lockedPhase,
  cost: g.cost.map((c) => ({
    name: c.name,
    amount: c.amount,
    totalCost: c.totalCost,
  })),
});

export const mapSchematics_world = (g: SchematicGql[]): Schematic[] => g.map(mapSchematic_world);

type GeneratorStatsGql = {
  sources: { type: string; source: { count: number; totalProduction: number } }[];
};

export const mapGeneratorStats_world = (g: GeneratorStatsGql): GeneratorStats => {
  const sources: { [key: PowerType]: PowerSource } = {};
  for (const entry of g.sources) {
    const key = powerTypeMap_world[entry.type] ?? entry.type;
    sources[key] = {
      count: entry.source.count,
      totalProduction: entry.source.totalProduction,
    };
  }
  return { sources };
};
