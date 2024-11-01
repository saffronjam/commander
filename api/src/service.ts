import {
  Circuit,
  FactoryStats,
  ProdStats,
  SinkStats,
  ItemStats,
  Player,
  GeneratorStats,
  Train,
  TrainStation,
} from "common/src/types";
import { SatisfactoryEvent } from "./types";

export type SatisfactoryEventCallback = (event: SatisfactoryEvent<any>) => void;

export interface Service {
  setupSatisfactoryApiCheck(): void;
  isSatisfactoryApiAvailable(): boolean;
  
  setupWebsocket(callback: SatisfactoryEventCallback): void;

  getCircuits(): Promise<Circuit[]>;
  getFactoryStats(): Promise<FactoryStats>;
  getProdStats(): Promise<ProdStats>;
  getSinkStats(): Promise<SinkStats>;
  getItemStats(): Promise<ItemStats[]>;
  getPlayers(): Promise<Player[]>;
  getGeneratorStats(): Promise<GeneratorStats>;
  getTrains(): Promise<Train[]>;
  getTrainStations(): Promise<TrainStation[]>;
}
