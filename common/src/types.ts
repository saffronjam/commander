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
    {
      name: string;
      
      producedPerMinute: number;
      maxProducePerMinute: number;
      produceEfficiency: number;

      consumedPerMinute: number;
      maxConsumePerMinute: number;
      consumeEfficiency: number;

      minable: boolean;
    }
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

export type Player = {
  id: string;
  name: string;
  health: number;
  pingMs: number;
};
