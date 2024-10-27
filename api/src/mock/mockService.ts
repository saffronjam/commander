import {
  Circuit,
  FactoryStats,
  ProdStats,
  SinkStats,
  ItemStats,
  Player,
  GeneratorStats,
} from "common/src/types";
import { time } from "console";

export class MockService {
  constructor() {}

  setupSatisfactoryApiCheck(): void {}

  isSatisfactoryApiAvailable(): boolean {
    return true;
  }

  async getCircuits(): Promise<Circuit[]> {
    return this.promisifyWithRandomDelay([
      {
        id: "1",
        consumption: {
          total: 100_000_000 + Math.random() * 25_000_000,
          max: 200_000_000 + Math.random() * 25_000_000,
        },
        production: {
          total: 200_000_000 + Math.random() * 25_000_000,
        },
        capacity: {
          total: 300_000_000 + Math.random() * 25_000_000,
        },
        battery: {
          percentage: 50 + Math.random() * 25,
          capacity: 100_000_000 + Math.random() * 25_000_000,
          differential: 10_000_000 + Math.random() * 50_000_000,
          untilFull: 10 + Math.random() * 25,
          untilEmpty: 10 + Math.random() * 25,
        },
        fuseTriggered: false,
      },
      {
        id: "2",
        consumption: {
          total: 100_000_000 + Math.random() * 50_000_000,
        },
        production: {
          total: 200_000_000 + Math.random() * 50_000_000,
        },
        capacity: {
          total: 300_000_000 + Math.random() * 50_000_000,
        },
        battery: {
          percentage: 50 + Math.random() * 50,
          capacity: 100_000_000 + Math.random() * 50_000_000,
          differential: 10_000_000 + Math.random() * 50_000_000,
          untilFull: 10 + Math.random() * 50,
          untilEmpty: 10 + Math.random() * 50,
        },
        fuseTriggered: true,
      },
    ] as Circuit[]);
  }

  async getFactoryStats(): Promise<FactoryStats> {
    return this.promisifyWithRandomDelay({
      totalMachines: 100 + Math.random() * 2,
      efficiency: {
        machinesOperating: 50 + Math.random() * 2,
        machinesIdle: 20 + Math.random() * 2,
        machinesPaused: 10 + Math.random() * 2,
      },
    } as FactoryStats);
  }

  async getProdStats(): Promise<ProdStats> {
    return this.promisifyWithRandomDelay({
      minableProducedPerMinute: 100 + Math.random() * 10,
      minableConsumedPerMinute: 200 + Math.random() * 10,
      itemsProducedPerMinute: 300 + Math.random() * 10,
      itemsConsumedPerMinute: 400 + Math.random() * 10,
      items: ["Iron Ore", "Copper Ore", "Iron Plate"].map((name, index) => ({
        name,
        minable: index > 1,

        producedPerMinute: 100 + Math.random() * 10,
        maxProducePerMinute: 200 + Math.random() * 10,
        produceEfficiency: 0.5 + Math.random() * 0.1,

        consumedPerMinute: 300 + Math.random() * 10,
        maxConsumePerMinute: 400 + Math.random() * 10,
        consumeEfficiency: 0.6 + Math.random() * 0.1,
      })),
    } as ProdStats);
  }

  async getSinkStats(): Promise<SinkStats> {
    return this.promisifyWithRandomDelay({
      totalPoints: 100 + Math.random() * 10,
      coupons: 200 + Math.random() * 10,
      nextCouponProgress: 0.3 + Math.random() * 0.1,
    } as SinkStats);
  }

  async getItemStats(): Promise<ItemStats[]> {
    return this.promisifyWithRandomDelay([
      {
        name: "Iron Ore",
        count: 300 + Math.random() * 10,
      } as ItemStats,
      {
        name: "Copper Ore",
        count: 200 + Math.random() * 10,
      } as ItemStats,
      {
        name: "Reinforced Iron Plate",
        count: 10 + Math.random() * 10,
      } as ItemStats,
    ] as ItemStats[]);
  }

  async getPlayers(): Promise<Player[]> {
    return this.promisifyWithRandomDelay([
      {
        id: "1",
        name: "Kyoshi",
        health: 30 + Math.random() * 10,
        items: [
          {
            name: "Caterium Ingot",
            count: 200 + Math.random() * 10,
          },
          {
            name: "Copper Ore",
            count: 50 + Math.random() * 10,
          },
        ],
      },
      {
        id: "2",
        name: "ellaurgor",
        health: 90 + Math.random() * 10,
        items: [
          {
            name: "Iron Ore",
            count: 300 + Math.random() * 10,
          },
          {
            name: "Copper Ore",
            count: 200 + Math.random() * 10,
          },
        ],
      },
    ] as Player[]);
  }

  async getGeneratorStats(): Promise<GeneratorStats> {
    return this.promisifyWithRandomDelay({
      sources: {
        biomass: {
          count: 100 + Math.random() * 10,
          totalProduction: 200 + Math.random() * 10,
        },
        coal: {
          count: 100 + Math.random() * 10,
          totalProduction: 200 + Math.random() * 10,
        },
        fuel: {
          count: 300 + Math.random() * 10,
          totalProduction: 400 + Math.random() * 10,
        },
        nuclear: {
          count: 500 + Math.random() * 10,
          totalProduction: 600 + Math.random() * 10,
        },
      } as any,
    } as GeneratorStats);
  }

  private async promisifyWithRandomDelay<T>(value: T): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(value);
      }, Math.random() * 50);
    });
  }
}
