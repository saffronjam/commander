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

export type FactoryStats = {
  totalMachines: number;
  efficiency: {
    machinesOperating: number;
    machinesIdle: number;
    machinesPaused: number;
  };
};

export type GeneratorStats = {
  sources: {
    [key in PowerType]: {
      count: number;
      totalProduction: number;
    };
  };
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
};

export type ItemStats = {
  name: string;
  count: number;
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
  location: Location;
};

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
  location: Location;
  speed: number;
  status: TrainStatus;
  powerConsumption: number;
  vechicles: TrainVehicle[];
  timetable: TrainTimetableEntry[];
};
