import { graphql } from 'src/gql';
import type {
  Drone,
  DroneStation,
  Train,
  TrainStation,
  TrainStationPlatform,
  TrainVehicle,
  TrainTimetableEntry,
  Truck,
  TruckStation,
  Tractor,
  Explorer,
  VehiclePath,
  Location as ApiLocation,
  BoundingBox,
  ItemStats,
  Fuel,
  DroneStatus,
  TrainStatus,
  TrainType,
  TrainStationPlatformType,
  TrainStationPlatformMode,
  TrainStationPlatformStatus,
  TruckStatus,
  TractorStatus,
  ExplorerStatus,
  VehiclePathType,
} from 'src/apiTypes';

const droneStatusMap_vehicles: Record<string, DroneStatus> = {
  IDLE: 'idle',
  FLYING: 'flying',
  DOCKING: 'docking',
};

const trainStatusMap_vehicles: Record<string, TrainStatus> = {
  SELF_DRIVING: 'selfDriving',
  MANUAL_DRIVING: 'manualDriving',
  PARKED: 'parked',
  DOCKING: 'docking',
  DERAILED: 'derailed',
  UNKNOWN: 'unknown',
};

const trainTypeMap_vehicles: Record<string, TrainType> = {
  FREIGHT: 'freight',
  LOCOMOTIVE: 'locomotive',
};

const trainStationPlatformTypeMap_vehicles: Record<string, TrainStationPlatformType> = {
  FREIGHT: 'freight',
  FLUID_FREIGHT: 'fluidFreight',
};

const trainStationPlatformModeMap_vehicles: Record<string, TrainStationPlatformMode> = {
  IMPORT: 'import',
  EXPORT: 'export',
};

const trainStationPlatformStatusMap_vehicles: Record<string, TrainStationPlatformStatus> = {
  IDLE: 'idle',
  DOCKING: 'docking',
};

const truckStatusMap_vehicles: Record<string, TruckStatus> = {
  SELF_DRIVING: 'selfDriving',
  MANUAL_DRIVING: 'manualDriving',
  PARKED: 'parked',
  UNKNOWN: 'unknown',
};

const tractorStatusMap_vehicles: Record<string, TractorStatus> = {
  SELF_DRIVING: 'selfDriving',
  MANUAL_DRIVING: 'manualDriving',
  PARKED: 'parked',
  UNKNOWN: 'unknown',
};

const explorerStatusMap_vehicles: Record<string, ExplorerStatus> = {
  SELF_DRIVING: 'selfDriving',
  MANUAL_DRIVING: 'manualDriving',
  PARKED: 'parked',
  UNKNOWN: 'unknown',
};

const vehiclePathTypeMap_vehicles: Record<string, VehiclePathType> = {
  EXPLORER: 'Explorer',
  FACTORY_CART: 'Factory Cart',
  TRUCK: 'Truck',
  TRACTOR: 'Tractor',
};

type GqlLocationFields = {
  x: number;
  y: number;
  z: number;
  rotation: number;
};

const mapLocation_vehicles = (g: GqlLocationFields): ApiLocation => ({
  x: g.x,
  y: g.y,
  z: g.z,
  rotation: g.rotation,
});

const mapBoundingBox_vehicles = (g: {
  min: GqlLocationFields;
  max: GqlLocationFields;
}): BoundingBox => ({
  min: mapLocation_vehicles(g.min),
  max: mapLocation_vehicles(g.max),
});

const mapItemStats_vehicles = (g: { name: string; count: number }): ItemStats => ({
  name: g.name,
  count: g.count,
});

const mapFuel_vehicles = (
  g: { name: string; amount: number } | null | undefined
): Fuel | undefined =>
  g == null ? undefined : { Name: g.name, amount: g.amount };

export const DronesChangedSub = graphql(`
  subscription DronesChanged($sessionId: ID!) {
    dronesChanged(sessionId: $sessionId) {
      name
      speed
      status
      home {
        name
        fuel {
          name
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
        incomingRate
        outgoingRate
        inputInventory {
          name
          count
        }
        outputInventory {
          name
          count
        }
        x
        y
        z
        rotation
        circuitId
        circuitGroupId
      }
      paired {
        name
        fuel {
          name
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
        incomingRate
        outgoingRate
        inputInventory {
          name
          count
        }
        outputInventory {
          name
          count
        }
        x
        y
        z
        rotation
        circuitId
        circuitGroupId
      }
      destination {
        name
        fuel {
          name
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
        incomingRate
        outgoingRate
        inputInventory {
          name
          count
        }
        outputInventory {
          name
          count
        }
        x
        y
        z
        rotation
        circuitId
        circuitGroupId
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

export const DroneStationsChangedSub = graphql(`
  subscription DroneStationsChanged($sessionId: ID!) {
    droneStationsChanged(sessionId: $sessionId) {
      name
      fuel {
        name
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
      incomingRate
      outgoingRate
      inputInventory {
        name
        count
      }
      outputInventory {
        name
        count
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

export const TrainsChangedSub = graphql(`
  subscription TrainsChanged($sessionId: ID!) {
    trainsChanged(sessionId: $sessionId) {
      id
      name
      speed
      status
      powerConsumption
      vehicles {
        type
        capacity
        inventory {
          name
          count
        }
      }
      timetable {
        station
      }
      timetableIndex
      x
      y
      z
      rotation
      circuitId
      circuitGroupId
    }
  }
`);

export const TrainStationsChangedSub = graphql(`
  subscription TrainStationsChanged($sessionId: ID!) {
    trainStationsChanged(sessionId: $sessionId) {
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
      platforms {
        id
        type
        mode
        status
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
        inventory {
          name
          count
        }
        transferRate
        inflowRate
        outflowRate
        x
        y
        z
        rotation
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

export const TrucksChangedSub = graphql(`
  subscription TrucksChanged($sessionId: ID!) {
    trucksChanged(sessionId: $sessionId) {
      id
      name
      speed
      status
      fuel {
        name
        amount
      }
      inventory {
        name
        count
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

export const TruckStationsChangedSub = graphql(`
  subscription TruckStationsChanged($sessionId: ID!) {
    truckStationsChanged(sessionId: $sessionId) {
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
      transferRate
      maxTransferRate
      inventory {
        name
        count
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

export const TractorsChangedSub = graphql(`
  subscription TractorsChanged($sessionId: ID!) {
    tractorsChanged(sessionId: $sessionId) {
      id
      name
      speed
      status
      fuel {
        name
        amount
      }
      inventory {
        name
        count
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

export const ExplorersChangedSub = graphql(`
  subscription ExplorersChanged($sessionId: ID!) {
    explorersChanged(sessionId: $sessionId) {
      id
      name
      speed
      status
      fuel {
        name
        amount
      }
      inventory {
        name
        count
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

export const VehiclePathsChangedSub = graphql(`
  subscription VehiclePathsChanged($sessionId: ID!) {
    vehiclePathsChanged(sessionId: $sessionId) {
      name
      vehicleType
      pathLength
      vertices {
        x
        y
        z
        rotation
      }
    }
  }
`);

type GqlDroneStation = {
  name: string;
  fuel?: { name: string; amount: number } | null;
  boundingBox: { min: GqlLocationFields; max: GqlLocationFields };
  incomingRate: number;
  outgoingRate: number;
  inputInventory: { name: string; count: number }[];
  outputInventory: { name: string; count: number }[];
  x: number;
  y: number;
  z: number;
  rotation: number;
  circuitId: number;
  circuitGroupId?: number | null;
};

export const mapDroneStation_vehicles = (g: GqlDroneStation): DroneStation => ({
  ...mapLocation_vehicles(g),
  name: g.name,
  fuel: mapFuel_vehicles(g.fuel),
  boundingBox: mapBoundingBox_vehicles(g.boundingBox),
  incomingRate: g.incomingRate,
  outgoingRate: g.outgoingRate,
  inputInventory: g.inputInventory.map(mapItemStats_vehicles),
  outputInventory: g.outputInventory.map(mapItemStats_vehicles),
  circuitId: g.circuitId,
  circuitGroupId: g.circuitGroupId ?? undefined,
});

type GqlDrone = {
  name: string;
  speed: number;
  status: string;
  home: GqlDroneStation;
  paired?: GqlDroneStation | null;
  destination?: GqlDroneStation | null;
  x: number;
  y: number;
  z: number;
  rotation: number;
  circuitId: number;
  circuitGroupId: number;
};

export const mapDrone_vehicles = (g: GqlDrone): Drone => ({
  ...mapLocation_vehicles(g),
  name: g.name,
  speed: g.speed,
  status: droneStatusMap_vehicles[g.status] ?? g.status,
  home: mapDroneStation_vehicles(g.home),
  paired: g.paired == null ? undefined : mapDroneStation_vehicles(g.paired),
  destination:
    g.destination == null ? undefined : mapDroneStation_vehicles(g.destination),
  circuitId: g.circuitId,
  circuitGroupId: g.circuitGroupId ?? 0,
});

export const mapDrones_vehicles = (g: GqlDrone[]): Drone[] => g.map(mapDrone_vehicles);

export const mapDroneStations_vehicles = (g: GqlDroneStation[]): DroneStation[] =>
  g.map(mapDroneStation_vehicles);

type GqlTrainVehicle = {
  type: string;
  capacity: number;
  inventory: { name: string; count: number }[];
};

const mapTrainVehicle_vehicles = (g: GqlTrainVehicle): TrainVehicle => ({
  type: trainTypeMap_vehicles[g.type] ?? g.type,
  capacity: g.capacity,
  inventory: g.inventory.map(mapItemStats_vehicles),
});

const mapTrainTimetableEntry_vehicles = (g: { station: string }): TrainTimetableEntry => ({
  station: g.station,
});

type GqlTrain = {
  id: string;
  name: string;
  speed: number;
  status: string;
  powerConsumption: number;
  vehicles: GqlTrainVehicle[];
  timetable: { station: string }[];
  timetableIndex: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  circuitId: number;
  circuitGroupId?: number | null;
};

export const mapTrain_vehicles = (g: GqlTrain): Train => ({
  ...mapLocation_vehicles(g),
  id: g.id,
  name: g.name,
  speed: g.speed,
  status: trainStatusMap_vehicles[g.status] ?? g.status,
  powerConsumption: g.powerConsumption,
  vehicles: g.vehicles.map(mapTrainVehicle_vehicles),
  timetable: g.timetable.map(mapTrainTimetableEntry_vehicles),
  timetableIndex: g.timetableIndex,
  circuitId: g.circuitId,
  circuitGroupId: g.circuitGroupId ?? undefined,
});

export const mapTrains_vehicles = (g: GqlTrain[]): Train[] => g.map(mapTrain_vehicles);

type GqlTrainStationPlatform = {
  id: string;
  type: string;
  mode: string;
  status: string;
  boundingBox: { min: GqlLocationFields; max: GqlLocationFields };
  inventory: { name: string; count: number }[];
  transferRate: number;
  inflowRate: number;
  outflowRate: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
};

const mapTrainStationPlatform_vehicles = (
  g: GqlTrainStationPlatform
): TrainStationPlatform => ({
  ...mapLocation_vehicles(g),
  id: g.id,
  type: trainStationPlatformTypeMap_vehicles[g.type] ?? g.type,
  mode: trainStationPlatformModeMap_vehicles[g.mode] ?? g.mode,
  status: trainStationPlatformStatusMap_vehicles[g.status] ?? g.status,
  boundingBox: mapBoundingBox_vehicles(g.boundingBox),
  inventory: g.inventory.map(mapItemStats_vehicles),
  transferRate: g.transferRate,
  inflowRate: g.inflowRate,
  outflowRate: g.outflowRate,
});

type GqlTrainStation = {
  name: string;
  boundingBox: { min: GqlLocationFields; max: GqlLocationFields };
  platforms: GqlTrainStationPlatform[];
  x: number;
  y: number;
  z: number;
  rotation: number;
  circuitId: number;
  circuitGroupId?: number | null;
};

export const mapTrainStation_vehicles = (g: GqlTrainStation): TrainStation => ({
  ...mapLocation_vehicles(g),
  name: g.name,
  boundingBox: mapBoundingBox_vehicles(g.boundingBox),
  platforms: g.platforms.map(mapTrainStationPlatform_vehicles),
  circuitId: g.circuitId,
  circuitGroupId: g.circuitGroupId ?? undefined,
});

export const mapTrainStations_vehicles = (g: GqlTrainStation[]): TrainStation[] =>
  g.map(mapTrainStation_vehicles);

type GqlTruck = {
  id: string;
  name: string;
  speed: number;
  status: string;
  fuel?: { name: string; amount: number } | null;
  inventory: { name: string; count: number }[];
  x: number;
  y: number;
  z: number;
  rotation: number;
  circuitId: number;
  circuitGroupId?: number | null;
};

export const mapTruck_vehicles = (g: GqlTruck): Truck => ({
  ...mapLocation_vehicles(g),
  id: g.id,
  name: g.name,
  speed: g.speed,
  status: truckStatusMap_vehicles[g.status] ?? g.status,
  fuel: mapFuel_vehicles(g.fuel),
  inventory: g.inventory.map(mapItemStats_vehicles),
  circuitId: g.circuitId,
  circuitGroupId: g.circuitGroupId ?? undefined,
});

export const mapTrucks_vehicles = (g: GqlTruck[]): Truck[] => g.map(mapTruck_vehicles);

type GqlTruckStation = {
  name: string;
  boundingBox: { min: GqlLocationFields; max: GqlLocationFields };
  transferRate: number;
  maxTransferRate: number;
  inventory: { name: string; count: number }[];
  x: number;
  y: number;
  z: number;
  rotation: number;
  circuitId: number;
  circuitGroupId?: number | null;
};

export const mapTruckStation_vehicles = (g: GqlTruckStation): TruckStation => ({
  ...mapLocation_vehicles(g),
  name: g.name,
  boundingBox: mapBoundingBox_vehicles(g.boundingBox),
  transferRate: g.transferRate,
  maxTransferRate: g.maxTransferRate,
  inventory: g.inventory.map(mapItemStats_vehicles),
  circuitId: g.circuitId,
});

export const mapTruckStations_vehicles = (g: GqlTruckStation[]): TruckStation[] =>
  g.map(mapTruckStation_vehicles);

type GqlTractor = {
  id: string;
  name: string;
  speed: number;
  status: string;
  fuel?: { name: string; amount: number } | null;
  inventory: { name: string; count: number }[];
  x: number;
  y: number;
  z: number;
  rotation: number;
  circuitId: number;
  circuitGroupId?: number | null;
};

export const mapTractor_vehicles = (g: GqlTractor): Tractor => ({
  ...mapLocation_vehicles(g),
  id: g.id,
  name: g.name,
  speed: g.speed,
  status: tractorStatusMap_vehicles[g.status] ?? g.status,
  fuel: mapFuel_vehicles(g.fuel),
  inventory: g.inventory.map(mapItemStats_vehicles),
  circuitId: g.circuitId,
  circuitGroupId: g.circuitGroupId ?? undefined,
});

export const mapTractors_vehicles = (g: GqlTractor[]): Tractor[] =>
  g.map(mapTractor_vehicles);

type GqlExplorer = {
  id: string;
  name: string;
  speed: number;
  status: string;
  fuel?: { name: string; amount: number } | null;
  inventory: { name: string; count: number }[];
  x: number;
  y: number;
  z: number;
  rotation: number;
  circuitId: number;
  circuitGroupId?: number | null;
};

export const mapExplorer_vehicles = (g: GqlExplorer): Explorer => ({
  ...mapLocation_vehicles(g),
  id: g.id,
  name: g.name,
  speed: g.speed,
  status: explorerStatusMap_vehicles[g.status] ?? g.status,
  fuel: mapFuel_vehicles(g.fuel),
  inventory: g.inventory.map(mapItemStats_vehicles),
  circuitId: g.circuitId,
  circuitGroupId: g.circuitGroupId ?? undefined,
});

export const mapExplorers_vehicles = (g: GqlExplorer[]): Explorer[] =>
  g.map(mapExplorer_vehicles);

type GqlVehiclePath = {
  name: string;
  vehicleType: string;
  pathLength: number;
  vertices: GqlLocationFields[];
};

export const mapVehiclePath_vehicles = (g: GqlVehiclePath): VehiclePath => ({
  name: g.name,
  vehicleType: vehiclePathTypeMap_vehicles[g.vehicleType] ?? g.vehicleType,
  pathLength: g.pathLength,
  vertices: g.vertices.map(mapLocation_vehicles),
});

export const mapVehiclePaths_vehicles = (g: GqlVehiclePath[]): VehiclePath[] =>
  g.map(mapVehiclePath_vehicles);
