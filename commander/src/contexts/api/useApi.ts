import {
  Circuit,
  FactoryStats,
  GeneratorStats,
  ItemStats,
  Player,
  ProdStats,
  SinkStats,
  Train,
  TrainStation,
} from 'common/types';
import { createContext } from 'use-context-selector';

export type ApiData = {
  isLoading: boolean;
  isOnline: boolean;

  circuits: Circuit[];
  factoryStats: FactoryStats;
  prodStats: ProdStats;
  sinkStats: SinkStats;
  itemStats: ItemStats[];
  players: Player[];
  generatorStats: GeneratorStats;
  trains: Train[];
  trainStations: TrainStation[];
};

export type ApiContextType = ApiData & {
  history: (ApiData & { timestamp: Date })[];
};

export const DefaultApiContext: ApiContextType = {
  isLoading: true,
  isOnline: false,

  circuits: [],
  factoryStats: {} as FactoryStats,
  prodStats: {} as ProdStats,
  sinkStats: {} as SinkStats,
  itemStats: [],
  players: [],
  generatorStats: {} as GeneratorStats,
  trains: [],
  trainStations: [],

  history: [
    {
      timestamp: new Date(),
      circuits: [],
      factoryStats: {} as FactoryStats,
      prodStats: {} as ProdStats,
      sinkStats: {} as SinkStats,
      itemStats: [],
      players: [],
      generatorStats: {} as GeneratorStats,
      trains: [],
      trainStations: [],
    },
  ] as any,
};

export const ApiContext = createContext<ApiContextType>(DefaultApiContext);
