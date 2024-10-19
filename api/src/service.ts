import {
  Circuit,
  FactoryStats,
  ProdStats,
  SinkStats,
  ItemStats,
  Player,
  GeneratorStats,
} from "common/src/types";

export interface Service {
  setupSatisfactoryApiCheck(): void;

  getCircuits(): Promise<Circuit[]>;
  getFactoryStats(): Promise<FactoryStats>;
  getProdStats(): Promise<ProdStats>;
  getSinkStats(): Promise<SinkStats>;
  getItemStats(): Promise<ItemStats[]>;
  getPlayers(): Promise<Player[]>;
  getGeneratorStats(): Promise<GeneratorStats>;
}
