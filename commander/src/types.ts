export type Settings = {
  apiUrl: string;
  productionView: {
    includeMinable: boolean;
    includeItems: boolean;
  }
  intervals: {
    rerender: number;
    satisfactoryApiCheck: number;
    circuits: number;
    players: number;
    factoryStats: number;
    prodStats: number;
    sinkStats: number;
    itemStats: number;
    generatorStats: number;
    trains: number;
    trainStations: number;
  };
};
