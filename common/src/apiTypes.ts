import {
  Circuit,
  FactoryStats,
  GeneratorStats,
  Player,
  ProdStats,
  SinkStats,
  Train,
  TrainStation,
} from "./types";

export type SseEvent<T> = {
  type: string;
  clientId: number;
  data: T;
};

export class ApiError {
  code: number;
  message: string;

  constructor(message: string, code = 500) {
    this.message = message;
    this.code = code;
  }
}

export type SatisfactoryApiCheck = {
  isOnline: boolean;
};

export type FullState = {
  isOnline: boolean;
  circuits: Circuit[];
  factoryStats: FactoryStats;
  prodStats: ProdStats;
  sinkStats: SinkStats;
  players: Player[];
  generatorStats: GeneratorStats;
  trains: Train[];
  trainStations: TrainStation[];
};

export enum SatisfactoryEventType {
  satisfactoryApiCheck = "satisfactoryApiCheck",
  circuits = "circuits",
  factoryStats = "factoryStats",
  prodStats = "prodStats",
  sinkStats = "sinkStats",
  players = "players",
  generatorStats = "generatorStats",
  trains = "trains",
}
