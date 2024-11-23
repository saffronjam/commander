import {
  Circuit,
  FactoryStats,
  ProdStats,
  SinkStats,
  ItemStats,
  Player,
  GeneratorStats,
  TrainType,
  Train,
  TrainVehicle,
  TrainStation,
  TrainStatus,
  TrainSetup,
  MachineStatus,
} from "common/src/types";
import { SatisfactoryEventCallback } from "../service";
import {
  ApiError,
  FullState,
  SatisfactoryEventType,
} from "common/src/apiTypes";

const now = new Date().getTime();

export class MockService {
  constructor() {}

  setupEventListener(callback: SatisfactoryEventCallback) {
    const endpoints = [
      {
        type: SatisfactoryEventType.satisfactoryApiCheck,
        endpoint: this.getSatisfactoryApiStatus.bind(this),
        interval: 5000 + 200 * Math.random(),
      },
      {
        type: SatisfactoryEventType.circuits,
        endpoint: this.getCircuits.bind(this),
        interval: 2000 + 200 * Math.random(),
      },
      {
        type: SatisfactoryEventType.factoryStats,
        endpoint: this.getFactoryStats.bind(this),
        interval: 2000 + 200 * Math.random(),
      },
      {
        type: SatisfactoryEventType.prodStats,
        endpoint: this.getProdStats.bind(this),
        interval: 2000 + 200 * Math.random(),
      },
      {
        type: SatisfactoryEventType.sinkStats,
        endpoint: this.getSinkStats.bind(this),
        interval: 2000 + 200 * Math.random(),
      },
      {
        type: SatisfactoryEventType.players,
        endpoint: this.getPlayers.bind(this),
        interval: 2000 + 200 * Math.random(),
      },
      {
        type: SatisfactoryEventType.generatorStats,
        endpoint: this.getGeneratorStats.bind(this),
        interval: 2000 + 200 * Math.random(),
      },
      {
        type: SatisfactoryEventType.trains,
        endpoint: () => {
          return Promise.all([this.getTrains(), this.getTrainStations()]).then(
            ([trains, trainStations]) => {
              return {
                trains: trains,
                trainStations: trainStations,
              } as TrainSetup;
            }
          );
        },
        interval: 2000,
      },
    ];

    // Setup callbacks for each endpoint and return data in the callback randomly between every 200-500ms, one interval per endpoint
    for (const { type, endpoint, interval } of endpoints) {
      setInterval(async () => {
        try {
          const data = await endpoint();
          callback({
            type,
            data,
          });
        } catch (error) {
          if (error instanceof ApiError) {
            if (error.message !== "Satisfactory API is down") {
              console.error(`[${type}] ${error.message}`);
            }
          }
        }
      }, interval);
    }
  }

  async getSatisfactoryApiStatus(): Promise<FullState> {
    return this.promisifyWithRandomDelay({
      isOnline: true,
    } as FullState);
  }

  async getFullState(): Promise<FullState> {
    return this.promisifyWithRandomDelay({
      isOnline: true,
      circuits: await this.getCircuits(),
      factoryStats: await this.getFactoryStats(),
      prodStats: await this.getProdStats(),
      sinkStats: await this.getSinkStats(),
      players: await this.getPlayers(),
      generatorStats: await this.getGeneratorStats(),
      trains: await this.getTrains(),
      trainStations: await this.getTrainStations(),
    } as FullState);
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
      machines: [
        {
          name: "Assembler",
          location: {
            x: 0,
            y: 0,
            z: 0,
            rotation: 0,
          },
          status: MachineStatus.idle,
          powerConsumption: 10 + Math.random() * 10,
          powerProduction: 200 + Math.random() * 10,
        },
        {
          name: "Assembler",
          location: {
            x: 5,
            y: 0,
            z: 5,
            rotation: 0,
          },
          status: MachineStatus.idle,
          powerConsumption: 10 + Math.random() * 10,
        },
        {
          name: "Constructor",
          location: {
            x: 100,
            y: 2,
            z: 120,
            rotation: 0,
          },
          status: MachineStatus.operating,
          powerConsumption: 50 + Math.random() * 10,
        },
        {
          name: "Manufacturer",
          location: {
            x: 200,
            y: 4,
            z: 240,
            rotation: 0,
          },
          status: MachineStatus.paused,
          powerConsumption: 200 + Math.random() * 10,
        }
      ],
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
        count:
          index < 2
            ? 15423 + (new Date().getTime() - now) / 10
            : 3643 + (new Date().getTime() - now) / 100,

        minable: index < 2,

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
      pointsPerMinute: 300 + Math.random() * 10,
    } as SinkStats);
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

  async getTrains(): Promise<Train[]> {
    return this.promisifyWithRandomDelay([
      {
        name: "[IRN] 1",
        location: {
          x: 0,
          y: 0,
          z: 0,
          rotation: 0,
        },
        speed: 50 + Math.random() * 40,
        status: (() => {
          if (Math.random() > 1) {
            return TrainStatus.derailed;
          }

          if (Math.random() > 0) {
            return TrainStatus.docking;
          }

          return TrainStatus.selfDriving;
        })(),
        powerConsumption: 100 + Math.random() * 50,
        timetable: [
          {
            station: "Gothenburg",
          },
          {
            station: "New York",
          },
          {
            station: "Gothenburg",
          },
          {
            station: "Madrid",
          },
          {
            station: "Gothenburg",
          },
          {
            station: "Madrid",
          },
          {
            station: "Gothenburg",
          },
          {
            station: "Madrid",
          },
          {
            station: "Gothenburg",
          },
          {
            station: "Madrid",
          },
        ],
        vechicles: [
          {
            type: TrainType.locomotive,
            capacity: 100,
            inventory: [],
          },
          {
            type: TrainType.freight,
            capacity: 200,
            inventory: [
              {
                name: "Iron Ore",
                count: 10,
              },
              {
                name: "Copper Ore",
                count: 20,
              },
            ],
          },
          {
            type: TrainType.freight,
            capacity: 300,
            inventory: [
              {
                name: "Iron Ore",
                count: 30,
              },
              {
                name: "Copper Ore",
                count: 40,
              },
            ],
          },
        ] as TrainVehicle[],
      } as Train,
      {
        name: "Train 2",
        location: {
          x: 100,
          y: 2,
          z: 120,
          rotation: 0,
        },
        speed: 100 + Math.random() * 10,
        status: (() => {
          if (Math.random() > 0.9) {
            return TrainStatus.derailed;
          }

          if (Math.random() > 0.8) {
            return TrainStatus.docking;
          }

          return TrainStatus.selfDriving;
        })(),
        powerConsumption: 50 + Math.random() * 20,
        timetable: [
          {
            station: "Gotenburg",
          },
          {
            station: "Madrid",
          },
        ],
        vechicles: [
          {
            type: TrainType.locomotive,
            capacity: 100,
            inventory: [],
          },
          {
            type: TrainType.freight,
            capacity: 200,
            inventory: [
              {
                name: "Heavy Modular Frame",
                count: 10,
              },
            ],
          },
          {
            type: TrainType.freight,
            capacity: 300,
            inventory: [
              {
                name: "Plastic",
                count: 40,
              },
            ],
          },
        ] as TrainVehicle[],
      } as Train,
    ] as Train[]);
  }

  async getTrainStations(): Promise<TrainStation[]> {
    return this.promisifyWithRandomDelay([
      {
        name: "Gothenburg",
        location: {
          x: 0,
          y: 0,
          z: 0,
          rotation: 0,
        },
      },
      {
        name: "Madrid",
        location: {
          x: 100,
          y: 2,
          z: 120,
          rotation: 0,
        },
      },
      {
        name: "New York",
        location: {
          x: 200,
          y: 4,
          z: 240,
          rotation: 0,
        },
      },
    ] as TrainStation[]);
  }

  private async promisifyWithRandomDelay<T>(value: T): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(value);
      }, Math.random() * 50);
    });
  }
}
