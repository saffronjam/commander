export enum PowerType {
  biomass = "biomass",
  coal = "coal",
  fuel = "fuel",
  geothermal = "geothermal",
  nuclear = "nuclear",
}

export type Circuit = {
  id: string;

  consumption: {
    total: number;
    max: number;
  };

  production: {
    total: number;
  };

  capacity: {
    total: number;
  };

  battery: {
    percentage: number;
    capacity: number;
    differential: number;
    // Parsed from 00:00:00
    untilFull: number;
    // Parsed from 00:00:00
    untilEmpty: number;
  };

  fuseTriggered: boolean;
};

export enum MachineType {
  // Factory
  assembler = "assembler",
  constructor = "constructor",
  foundry = "foundry",
  manufacturer = "manufacturer",
  refinery = "refinery",
  smelter = "smelter",
  blender = "blender",
  packager = "packager",
  particleAccelerator = "particleAccelerator",

  // Extractors
  miner = "miner",
  oilExtractor = "oilExtractor",
  waterExtractor = "waterExtractor",

  // Generators
  biomassBurner = "biomassBurner",
  coalGenerator = "coalGenerator",
  fuelGenerator = "fuelGenerator",
  geothermalGenerator = "geothermalGenerator",
  nuclearPowerPlant = "nuclearPowerPlant",
}

export enum MachineCategory {
  factory = "factory",
  extractor = "extractor",
  generator = "generator",
}

export enum MachineStatus {
  operating = "operating",
  idle = "idle",
  paused = "paused",
  unconfigured = "unconfigured",
  unknown = "unknown",
}

export type Machine = {
  type: MachineType;
  status: MachineStatus;
  category: MachineCategory;

  input: MachineProductionStats[];
  output: MachineProductionStats[];
} & Location;

export type FactoryStats = {
  totalMachines: number;
  efficiency: {
    machinesOperating: number;
    machinesIdle: number;
    machinesPaused: number;
  };
  machines: Machine[];
};

export type GeneratorStats = {
  sources: {
    [key in PowerType]: {
      count: number;
      totalProduction: number;
    };
  };
  machines: Machine[];
};

export type ProdStats = {
  minableProducedPerMinute: number;
  minableConsumedPerMinute: number;
  itemsProducedPerMinute: number;
  itemsConsumedPerMinute: number;

  items: [
    ItemStats & {
      producedPerMinute: number;
      maxProducePerMinute: number;
      produceEfficiency: number;

      consumedPerMinute: number;
      maxConsumePerMinute: number;
      consumeEfficiency: number;

      minable: boolean;
    },
  ];
};

export type SinkStats = {
  totalPoints: number;
  coupons: number;
  nextCouponProgress: number;
  pointsPerMinute: number;
};

export type ItemStats = {
  name: string;
  count: number;
};

export type MachineProductionStats = {
  name: string;
  stored: number;
  current: number;
  max: number;
  efficiency: number;
};

export type Location = {
  x: number;
  y: number;
  z: number;
  rotation: number;
};

export type Player = {
  id: string;
  name: string;
  health: number;
  items: ItemStats[];
};

export type TrainStation = {
  name: string;
} & Location;

export enum TrainType {
  freight = "freight",
  locomotive = "locomotive",
}

export enum TrainStatus {
  selfDriving = "selfDriving",
  manualDriving = "manualDriving",
  parked = "parked",
  docking = "docking",
  derailed = "derailed",
}

export type TrainVehicle = {
  type: TrainType;
  capacity: number;
  inventory: ItemStats[];
};

export type TrainTimetableEntry = {
  station: string;
};

export type Train = {
  name: string;
  speed: number;
  status: TrainStatus;
  powerConsumption: number;
  vechicles: TrainVehicle[];
  timetable: TrainTimetableEntry[];
  timetableIndex: number;
} & Location;

export type TrainSetup = {
  trains: Train[];
  trainStations: TrainStation[];
};

export type DroneStation = {
  name: string;
  fuelName?: string;
} & Location;

export enum DroneStatus {
  idle = "idle",
  flying = "flying",
  docking = "docking",
}

export type Drone = {
  name: string;
  speed: number;
  status: DroneStatus;
  home: DroneStation;
  paired?: DroneStation;
  destination?: DroneStation;
} & Location;

export type DroneSetup = {
  drones: Drone[];
  droneStations: DroneStation[];
};