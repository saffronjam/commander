import { Circuit, FactoryStats, GeneratorStats, ItemStats, Player, ProdStats, SinkStats } from 'common/types';
import { createContext } from 'react';

type ApiContextType = {
  isLoading: boolean;
  isOnline: boolean;

  circuits: Circuit[];
  factoryStats: FactoryStats;
  prodStats: ProdStats;
  sinkStats: SinkStats;
  itemStats: ItemStats[];
  players: Player[];
  generatorStats: GeneratorStats;

  // Keep one minute of history
  history: [{
    timestamp: Date;
    circuits: Circuit[];
    factoryStats: FactoryStats;
    prodStats: ProdStats;
    sinkStats: SinkStats;
    itemStats: ItemStats[];
    players: Player[];
    generatorStats: GeneratorStats;
  }];
};

const defaultApiContext: ApiContextType = {
  isLoading: true,
  isOnline: false,

  circuits: [],
  factoryStats: {} as FactoryStats,
  prodStats: {} as ProdStats,
  sinkStats: {} as SinkStats,
  itemStats: [],
  players: [],
  generatorStats: {} as GeneratorStats,

  history: [{
    timestamp: new Date(),
    circuits: [],
    factoryStats: {} as FactoryStats,
    prodStats: {} as ProdStats,
    sinkStats: {} as SinkStats,
    itemStats: [],
    players: [],
    generatorStats: {} as GeneratorStats,
  }],
};

export const ApiContext = createContext<ApiContextType>(defaultApiContext);
