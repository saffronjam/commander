import { graphql } from 'src/gql';
import type {
  Belt,
  BoundingBox,
  Cable,
  Hypertube,
  HypertubeEntrance,
  ItemStats,
  Location,
  Machine,
  MachineCategory,
  MachineProdStats,
  MachineStatus,
  MachineType,
  Pipe,
  PipeJunction,
  PowerInfo,
  SplitterMerger,
  SplitterMergerType,
  Storage,
  StorageType,
  TrainRail,
  TrainRailType,
} from 'src/apiTypes';

export const MachinesChangedSub = graphql(`
  subscription MachinesChanged($sessionId: ID!) {
    machinesChanged(sessionId: $sessionId) {
      type
      status
      category
      productivity
      input {
        name
        stored
        current
        max
        efficiency
      }
      output {
        name
        stored
        current
        max
        efficiency
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
      circuitId
      circuitGroupId
    }
  }
`);

export const StoragesChangedSub = graphql(`
  subscription StoragesChanged($sessionId: ID!) {
    storagesChanged(sessionId: $sessionId) {
      id
      type
      inventory {
        name
        count
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

export const BeltsChangedSub = graphql(`
  subscription BeltsChanged($sessionId: ID!) {
    beltsChanged(sessionId: $sessionId) {
      id
      name
      location0 {
        x
        y
        z
        rotation
      }
      location1 {
        x
        y
        z
        rotation
      }
      connected0
      connected1
      splineData {
        x
        y
        z
        rotation
      }
      length
      itemsPerMinute
    }
  }
`);

export const SplitterMergersChangedSub = graphql(`
  subscription SplitterMergersChanged($sessionId: ID!) {
    splitterMergersChanged(sessionId: $sessionId) {
      id
      type
      x
      y
      z
      rotation
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
    }
  }
`);

export const PipesChangedSub = graphql(`
  subscription PipesChanged($sessionId: ID!) {
    pipesChanged(sessionId: $sessionId) {
      id
      name
      location0 {
        x
        y
        z
        rotation
      }
      location1 {
        x
        y
        z
        rotation
      }
      connected0
      connected1
      splineData {
        x
        y
        z
        rotation
      }
      length
      itemsPerMinute
    }
  }
`);

export const PipeJunctionsChangedSub = graphql(`
  subscription PipeJunctionsChanged($sessionId: ID!) {
    pipeJunctionsChanged(sessionId: $sessionId) {
      id
      name
      x
      y
      z
      rotation
    }
  }
`);

export const CablesChangedSub = graphql(`
  subscription CablesChanged($sessionId: ID!) {
    cablesChanged(sessionId: $sessionId) {
      id
      name
      location0 {
        x
        y
        z
        rotation
      }
      location1 {
        x
        y
        z
        rotation
      }
      connected0
      connected1
      length
    }
  }
`);

export const TrainRailsChangedSub = graphql(`
  subscription TrainRailsChanged($sessionId: ID!) {
    trainRailsChanged(sessionId: $sessionId) {
      id
      type
      location0 {
        x
        y
        z
        rotation
      }
      location1 {
        x
        y
        z
        rotation
      }
      connected0
      connected1
      splineData {
        x
        y
        z
        rotation
      }
      length
    }
  }
`);

export const HypertubesChangedSub = graphql(`
  subscription HypertubesChanged($sessionId: ID!) {
    hypertubesChanged(sessionId: $sessionId) {
      id
      location0 {
        x
        y
        z
        rotation
      }
      location1 {
        x
        y
        z
        rotation
      }
      splineData {
        x
        y
        z
        rotation
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
    }
  }
`);

export const HypertubeEntrancesChangedSub = graphql(`
  subscription HypertubeEntrancesChanged($sessionId: ID!) {
    hypertubeEntrancesChanged(sessionId: $sessionId) {
      id
      x
      y
      z
      rotation
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
      powerInfo {
        circuitId
        circuitGroupId
        powerConsumed
        maxPowerConsumed
      }
    }
  }
`);

interface GqlLocation_infra {
  x: number;
  y: number;
  z: number;
  rotation: number;
}

interface GqlBoundingBox_infra {
  min: GqlLocation_infra;
  max: GqlLocation_infra;
}

interface GqlItemStats_infra {
  name: string;
  count: number;
}

interface GqlMachineProdStats_infra {
  name: string;
  stored: number;
  current: number;
  max: number;
  efficiency: number;
}

interface GqlPowerInfo_infra {
  circuitId: number;
  circuitGroupId: number;
  powerConsumed: number;
  maxPowerConsumed: number;
}

interface GqlMachine_infra {
  type: string;
  status: string;
  category: string;
  productivity: number;
  input: GqlMachineProdStats_infra[];
  output: GqlMachineProdStats_infra[];
  boundingBox: GqlBoundingBox_infra;
  x: number;
  y: number;
  z: number;
  rotation: number;
  circuitId: number;
  circuitGroupId?: number | null;
}

interface GqlStorage_infra {
  id: string;
  type: string;
  inventory: GqlItemStats_infra[];
  boundingBox: GqlBoundingBox_infra;
  x: number;
  y: number;
  z: number;
  rotation: number;
}

interface GqlBelt_infra {
  id: string;
  name: string;
  location0: GqlLocation_infra;
  location1: GqlLocation_infra;
  connected0: boolean;
  connected1: boolean;
  splineData: GqlLocation_infra[];
  length: number;
  itemsPerMinute: number;
}

interface GqlSplitterMerger_infra {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  boundingBox: GqlBoundingBox_infra;
}

interface GqlPipe_infra {
  id: string;
  name: string;
  location0: GqlLocation_infra;
  location1: GqlLocation_infra;
  connected0: boolean;
  connected1: boolean;
  splineData: GqlLocation_infra[];
  length: number;
  itemsPerMinute: number;
}

interface GqlPipeJunction_infra {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
}

interface GqlCable_infra {
  id: string;
  name: string;
  location0: GqlLocation_infra;
  location1: GqlLocation_infra;
  connected0: boolean;
  connected1: boolean;
  length: number;
}

interface GqlTrainRail_infra {
  id: string;
  type: string;
  location0: GqlLocation_infra;
  location1: GqlLocation_infra;
  connected0: boolean;
  connected1: boolean;
  splineData: GqlLocation_infra[];
  length: number;
}

interface GqlHypertube_infra {
  id: string;
  location0: GqlLocation_infra;
  location1: GqlLocation_infra;
  splineData: GqlLocation_infra[];
  boundingBox: GqlBoundingBox_infra;
}

interface GqlHypertubeEntrance_infra {
  id: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  boundingBox: GqlBoundingBox_infra;
  powerInfo: GqlPowerInfo_infra;
}

const machineTypeMap_infra: Record<string, MachineType> = {
  ASSEMBLER: 'assembler',
  CONSTRUCTOR: 'constructor',
  FOUNDRY: 'foundry',
  MANUFACTURER: 'manufacturer',
  REFINERY: 'refinery',
  SMELTER: 'smelter',
  BLENDER: 'blender',
  PACKAGER: 'packager',
  PARTICLE_ACCELERATOR: 'particleAccelerator',
  MINER: 'miner',
  OIL_EXTRACTOR: 'oilExtractor',
  WATER_EXTRACTOR: 'waterExtractor',
  BIOMASS_BURNER: 'biomassBurner',
  COAL_GENERATOR: 'coalGenerator',
  FUEL_GENERATOR: 'fuelGenerator',
  GEOTHERMAL_GENERATOR: 'geothermalGenerator',
  NUCLEAR_POWER_PLANT: 'nuclearPowerPlant',
};

const machineCategoryMap_infra: Record<string, MachineCategory> = {
  FACTORY: 'factory',
  EXTRACTOR: 'extractor',
  GENERATOR: 'generator',
};

const machineStatusMap_infra: Record<string, MachineStatus> = {
  OPERATING: 'operating',
  IDLE: 'idle',
  PAUSED: 'paused',
  UNCONFIGURED: 'unconfigured',
  UNKNOWN: 'unknown',
};

const storageTypeMap_infra: Record<string, StorageType> = {
  BLUEPRINT_STORAGE_BOX: 'Blueprint Storage Box',
  DIMENSIONAL_DEPOT_UPLOADER: 'Dimensional Depot Uploader',
  INDUSTRIAL_STORAGE_CONTAINER: 'Industrial Storage Container',
  PERSONAL_STORAGE_BOX: 'Personal Storage Box',
  STORAGE_CONTAINER: 'Storage Container',
};

const splitterMergerTypeMap_infra: Record<string, SplitterMergerType> = {
  CONVEYOR_MERGER: 'Conveyor Merger',
  CONVEYOR_SPLITTER: 'Conveyor Splitter',
  PROGRAMMABLE_SPLITTER: 'Programmable Splitter',
  SMART_SPLITTER: 'Smart Splitter',
};

const trainRailTypeMap_infra: Record<string, TrainRailType> = {
  RAILWAY: 'Railway',
};

function mapLocation_infra(g: GqlLocation_infra): Location {
  return { x: g.x, y: g.y, z: g.z, rotation: g.rotation };
}

function mapBoundingBox_infra(g: GqlBoundingBox_infra): BoundingBox {
  return { min: mapLocation_infra(g.min), max: mapLocation_infra(g.max) };
}

function mapItemStats_infra(g: GqlItemStats_infra): ItemStats {
  return { name: g.name, count: g.count };
}

function mapMachineProdStats_infra(g: GqlMachineProdStats_infra): MachineProdStats {
  return {
    name: g.name,
    stored: g.stored,
    current: g.current,
    max: g.max,
    efficiency: g.efficiency,
  };
}

function mapPowerInfo_infra(g: GqlPowerInfo_infra): PowerInfo {
  return {
    circuitId: g.circuitId,
    circuitGroupId: g.circuitGroupId,
    powerConsumed: g.powerConsumed,
    maxPowerConsumed: g.maxPowerConsumed,
  };
}

export function mapMachine_infra(g: GqlMachine_infra): Machine {
  return {
    type: machineTypeMap_infra[g.type] ?? (g.type as MachineType),
    status: machineStatusMap_infra[g.status] ?? (g.status as MachineStatus),
    category: machineCategoryMap_infra[g.category] ?? (g.category as MachineCategory),
    productivity: g.productivity,
    input: g.input.map(mapMachineProdStats_infra),
    output: g.output.map(mapMachineProdStats_infra),
    boundingBox: mapBoundingBox_infra(g.boundingBox),
    x: g.x,
    y: g.y,
    z: g.z,
    rotation: g.rotation,
    circuitId: g.circuitId,
    circuitGroupId: g.circuitGroupId ?? 0,
  };
}

export function mapMachines_infra(list: GqlMachine_infra[]): Machine[] {
  return list.map(mapMachine_infra);
}

export function mapStorage_infra(g: GqlStorage_infra): Storage {
  return {
    id: g.id,
    type: storageTypeMap_infra[g.type] ?? (g.type as StorageType),
    inventory: g.inventory.map(mapItemStats_infra),
    boundingBox: mapBoundingBox_infra(g.boundingBox),
    x: g.x,
    y: g.y,
    z: g.z,
    rotation: g.rotation,
  };
}

export function mapStorages_infra(list: GqlStorage_infra[]): Storage[] {
  return list.map(mapStorage_infra);
}

export function mapBelt_infra(g: GqlBelt_infra): Belt {
  return {
    id: g.id,
    name: g.name,
    location0: mapLocation_infra(g.location0),
    location1: mapLocation_infra(g.location1),
    connected0: g.connected0,
    connected1: g.connected1,
    splineData: g.splineData.map(mapLocation_infra),
    length: g.length,
    itemsPerMinute: g.itemsPerMinute,
  };
}

export function mapBelts_infra(list: GqlBelt_infra[]): Belt[] {
  return list.map(mapBelt_infra);
}

export function mapSplitterMerger_infra(g: GqlSplitterMerger_infra): SplitterMerger {
  return {
    id: g.id,
    type: splitterMergerTypeMap_infra[g.type] ?? (g.type as SplitterMergerType),
    x: g.x,
    y: g.y,
    z: g.z,
    rotation: g.rotation,
    boundingBox: mapBoundingBox_infra(g.boundingBox),
  };
}

export function mapSplitterMergers_infra(list: GqlSplitterMerger_infra[]): SplitterMerger[] {
  return list.map(mapSplitterMerger_infra);
}

export function mapPipe_infra(g: GqlPipe_infra): Pipe {
  return {
    id: g.id,
    name: g.name,
    location0: mapLocation_infra(g.location0),
    location1: mapLocation_infra(g.location1),
    connected0: g.connected0,
    connected1: g.connected1,
    splineData: g.splineData.map(mapLocation_infra),
    length: g.length,
    itemsPerMinute: g.itemsPerMinute,
  };
}

export function mapPipes_infra(list: GqlPipe_infra[]): Pipe[] {
  return list.map(mapPipe_infra);
}

export function mapPipeJunction_infra(g: GqlPipeJunction_infra): PipeJunction {
  return {
    id: g.id,
    name: g.name,
    x: g.x,
    y: g.y,
    z: g.z,
    rotation: g.rotation,
  };
}

export function mapPipeJunctions_infra(list: GqlPipeJunction_infra[]): PipeJunction[] {
  return list.map(mapPipeJunction_infra);
}

export function mapCable_infra(g: GqlCable_infra): Cable {
  return {
    id: g.id,
    name: g.name,
    location0: mapLocation_infra(g.location0),
    location1: mapLocation_infra(g.location1),
    connected0: g.connected0,
    connected1: g.connected1,
    length: g.length,
  };
}

export function mapCables_infra(list: GqlCable_infra[]): Cable[] {
  return list.map(mapCable_infra);
}

export function mapTrainRail_infra(g: GqlTrainRail_infra): TrainRail {
  return {
    id: g.id,
    type: trainRailTypeMap_infra[g.type] ?? (g.type as TrainRailType),
    location0: mapLocation_infra(g.location0),
    location1: mapLocation_infra(g.location1),
    connected0: g.connected0,
    connected1: g.connected1,
    splineData: g.splineData.map(mapLocation_infra),
    length: g.length,
  };
}

export function mapTrainRails_infra(list: GqlTrainRail_infra[]): TrainRail[] {
  return list.map(mapTrainRail_infra);
}

export function mapHypertube_infra(g: GqlHypertube_infra): Hypertube {
  return {
    id: g.id,
    location0: mapLocation_infra(g.location0),
    location1: mapLocation_infra(g.location1),
    splineData: g.splineData.map(mapLocation_infra),
    boundingBox: mapBoundingBox_infra(g.boundingBox),
  };
}

export function mapHypertubes_infra(list: GqlHypertube_infra[]): Hypertube[] {
  return list.map(mapHypertube_infra);
}

export function mapHypertubeEntrance_infra(g: GqlHypertubeEntrance_infra): HypertubeEntrance {
  return {
    id: g.id,
    x: g.x,
    y: g.y,
    z: g.z,
    rotation: g.rotation,
    boundingBox: mapBoundingBox_infra(g.boundingBox),
    powerInfo: mapPowerInfo_infra(g.powerInfo),
  };
}

export function mapHypertubeEntrances_infra(
  list: GqlHypertubeEntrance_infra[]
): HypertubeEntrance[] {
  return list.map(mapHypertubeEntrance_infra);
}
