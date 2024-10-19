import { Circuit, FactoryStats, GeneratorStats, ItemStats, Player, ProdStats, SinkStats } from 'common/types';
import { createContext } from 'react';

type ApiContextType = {
  isLoading: boolean;

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

export const ApiContext = createContext<ApiContextType | undefined>(undefined);
