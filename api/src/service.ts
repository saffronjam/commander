import {
  Circuit,
  FactoryStats,
  ProdStats,
  SinkStats,
  Player,
  GeneratorStats,
  Train,
  TrainStation,
} from "common/src/types";
import { SatisfactoryEvent } from "./types";
import { FullState, SatisfactoryApiCheck } from "common/apiTypes";

export type SatisfactoryEventCallback = (event: SatisfactoryEvent<any>) => void;

export interface Service {
  setupEventListener(callback: SatisfactoryEventCallback): void;

  getFullState(): Promise<FullState>;
  
  getCircuits(): Promise<Circuit[]>;
  getFactoryStats(): Promise<FactoryStats>;
  getProdStats(): Promise<ProdStats>;
  getSinkStats(): Promise<SinkStats>;
  getPlayers(): Promise<Player[]>;
  getGeneratorStats(): Promise<GeneratorStats>;
  getTrains(): Promise<Train[]>;
  getSatisfactoryApiStatus(): Promise<SatisfactoryApiCheck>;
}
