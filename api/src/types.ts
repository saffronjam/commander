export type Client = {
  id: number;
};

export enum SatisfactoryEventType {
  Circuit = "circuit",
  FactoryStats = "factoryStats",
  ProdStats = "prodStats",
  SinkStats = "sinkStats",
  ItemStats = "itemStats",
  Player = "player",
  GeneratorStats = "generatorStats",
  Train = "train",
  TrainStation = "trainStation",
}

export type SatisfactoryEvent<T> = {
  type: string;
  data: T;
};
