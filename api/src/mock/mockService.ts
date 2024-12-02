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
  Machine,
  MachineType,
  MachineCategory,
  Drone,
  DroneStation,
  DroneSetup,
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
        endpoint: async () => {
          const [trains, trainStations] = await Promise.all([
            this.getTrains(),
            this.getTrainStations(),
          ]);
          return {
            trains: trains,
            trainStations: trainStations,
          } as TrainSetup;
        },
        interval: 2000,
      },
      {
        type: SatisfactoryEventType.drones,
        endpoint: async () => {
          const [drones, droneStations] = await Promise.all([
            this.getDrones(),
            this.getDroneStations(),
          ]);
          return {
            drones: drones,
            droneStations: droneStations,
          } as DroneSetup;
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
      drones: await this.getDrones(),
      droneStations: await this.getDroneStations(),
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
          type: MachineType.smelter,
          x: 8000,
          y: 50,
          z: 1000,
          rotation: 0,
          status: MachineStatus.operating,
          category: MachineCategory.factory,
          input: [
            {
              current: 3 + Math.random() * 1,
              max: 4,
              name: "Power",
              stored: 0,
              efficiency: 0.5 + Math.random() * 0.1,
            },
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Copper Ore",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
          output: [
            {
              current: 1000 + Math.random() * 10,
              max: 2000,
              name: "Copper Ingot",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
        },
        {
          type: MachineType.constructor,
          x: 10000,
          y: 50,
          z: 1000,
          rotation: 0,
          status: MachineStatus.idle,
          category: MachineCategory.factory,
          input: [
            {
              current: 3 + Math.random() * 1,
              max: 4,
              name: "Power",
              stored: 0,
              efficiency: 0.5 + Math.random() * 0.1,
            },
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Iron Ingot",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
          output: [
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Iron Plate",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
        },

        {
          type: MachineType.constructor,
          x: 10000,
          y: 50,
          z: 1000,
          rotation: 0,
          status: MachineStatus.idle,
          category: MachineCategory.factory,
          input: [
            {
              current: 3 + Math.random() * 1,
              max: 4,
              name: "Power",
              stored: 0,
              efficiency: 0.5 + Math.random() * 0.1,
            },
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Iron Ingot",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
          output: [
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Iron Plate",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
        },

        {
          type: MachineType.constructor,
          x: 10000,
          y: 50,
          z: 1000,
          rotation: 0,
          status: MachineStatus.idle,
          category: MachineCategory.factory,
          input: [
            {
              current: 3500 + Math.random() * 1,
              max: 4000,
              name: "Power",
              stored: 0,
              efficiency: 0.5 + Math.random() * 0.1,
            },
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Iron Ingot",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
          output: [
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Iron Plate",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
        },

        {
          type: MachineType.constructor,
          x: 10000,
          y: 50,
          z: 1000,
          rotation: 0,
          status: MachineStatus.idle,
          category: MachineCategory.factory,
          input: [
            {
              current: 3 + Math.random() * 1,
              max: 4,
              name: "Power",
              stored: 0,
              efficiency: 0.5 + Math.random() * 0.1,
            },
            {
              current: 2000 + Math.random() * 10,
              max: 3000,
              name: "Iron Ingot",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
          output: [
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Iron Plate",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
        },
        {
          type: MachineType.assembler,
          x: 18000,
          y: 50,
          z: 1000,
          rotation: 0,
          status: MachineStatus.operating,
          category: MachineCategory.factory,
          input: [
            {
              current: 8 + Math.random() * 4,
              max: 12,
              name: "Power",
              stored: 0,
              efficiency: 0.5 + Math.random() * 0.1,
            },
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Iron Plate",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Iron Rod",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
          output: [
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Reinforced Iron Plate",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
        },
        {
          type: MachineType.constructor,
          x: 20000,
          y: 50,
          z: 1000,
          rotation: 0,
          status: MachineStatus.paused,
          category: MachineCategory.factory,
          input: [
            {
              current: 0,
              max: 4,
              name: "Power",
              stored: 0,
              efficiency: 0.5 + Math.random() * 0.1,
            },
            {
              current: 10 + Math.random() * 10,
              max: 200,
              name: "Steel Ingot",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
          output: [
            {
              current: 10 + Math.random() * 1,
              max: 20,
              name: "Steel Pipe",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
        },
        {
          type: MachineType.manufacturer,
          category: MachineCategory.factory,
          x: 40000,
          y: 50,
          z: 1000,
          rotation: 0,
          status: MachineStatus.operating,
          input: [
            {
              current: 15 + Math.random() * 4,
              max: 20,
              name: "Power",
              stored: 0,
              efficiency: 0.5 + Math.random() * 0.1,
            },
            {
              current: 50 + Math.random() * 10,
              max: 100,
              name: "Plastic",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
            {
              current: 30 + Math.random() * 10,
              max: 50,
              name: "Circuit Board",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Cable",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
          output: [
            {
              current: 3 + Math.random() * 1,
              max: 5,
              name: "Computer",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
        },
      ] as Machine[],
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
      } as GeneratorStats["sources"],
      machines: [
        {
          type: MachineType.biomassBurner,
          category: MachineCategory.generator,
          x: 10000,
          y: 10000,
          z: 500,
          rotation: 0,
          input: [
            {
              current: 100 + Math.random() * 10,
              max: 200 + Math.random() * 10,
              name: "Solid Biofuel",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
          output: [
            {
              current: 10 + Math.random() * 4,
              max: 20 + Math.random() * 3,
              name: "Power",
              stored: 0,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
        },
        {
          type: MachineType.coalGenerator,
          category: MachineCategory.generator,
          x: 15000,
          y: 10000,
          z: 500,
          rotation: 0,
          efficiency: 0.5 + Math.random() * 0.1,
          input: [
            {
              current: 100 + Math.random() * 10,
              max: 200 + Math.random() * 10,
              name: "Coal",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
          output: [
            {
              current: 100 + Math.random() * 10,
              max: 75,
              name: "Power",
              stored: 0,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
        },
        {
          type: MachineType.fuelGenerator,
          category: MachineCategory.generator,
          x: 30000,
          y: 10000,
          z: 500,
          rotation: 0,
          efficiency: 0.5 + Math.random() * 0.1,
          input: [
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Fuel",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
          output: [
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Power",
              stored: 0,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
        },
        {
          type: MachineType.nuclearPowerPlant,
          category: MachineCategory.generator,
          x: 35000,
          y: 10000,
          z: 500,
          rotation: 0,
          input: [
            {
              current: 100 + Math.random() * 10,
              max: 200,
              name: "Uranium Fuel Rod",
              stored: 100 + Math.random() * 10,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
          output: [
            {
              current: 1200 + Math.random() * 100,
              max: 2000,
              name: "Power",
              stored: 0,
              efficiency: 0.5 + Math.random() * 0.1,
            },
          ],
        },
      ] as Machine[],
    } as GeneratorStats);
  }

  async getTrains(): Promise<Train[]> {
    return this.promisifyWithRandomDelay([
      {
        speed: 50 + Math.random() * 40,
        name: "[IRN] 1",
        status: (() => {
          if (Math.random() > 0.9) {
            return TrainStatus.derailed;
          }

          if (Math.random() > 0.8) {
            return TrainStatus.docking;
          }

          return TrainStatus.selfDriving;
        })(),
        powerConsumption: 100 + Math.random() * 50,

        x: 0,
        y: 0,
        z: 0,
        rotation: 0,

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
        timetableIndex: (new Date().getTime() - now) % 10,

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

        x: 100,
        y: 2,
        z: 120,
        rotation: 0,

        timetable: [
          {
            station: "Gotenburg",
          },
          {
            station: "Madrid",
          },
        ],
        timetableIndex: (new Date().getTime() - now) % 2,

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
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
      },
      {
        name: "Madrid",
        x: 100,
        y: 2,
        z: 120,
        rotation: 0,
      },
      {
        name: "New York",
        x: 200,
        y: 4,
        z: 240,
        rotation: 0,
      },
    ] as TrainStation[]);
  }

  async getDrones() {
    const droneStations = await this.getDroneStations();
    return this.promisifyWithRandomDelay([
      {
        name: "Drone 1",
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
        speed: 60 + Math.random() * 40,

        home: droneStations[0],
        paired: droneStations[1],
        destination: droneStations[1],
      } as Drone,
      {
        name: "Drone 2",
        x: 100,
        y: 2,
        z: 120,
        rotation: 0,
        speed: 60 + Math.random() * 40,

        home: droneStations[1],
        paired: droneStations[0],
        destination: droneStations[0],
      },
    ]);
  }

  async getDroneStations() {
    return this.promisifyWithRandomDelay([
      {
        name: "Drone Station 1",
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
        fuelName: "Packaged Fuel",
      } as DroneStation,
      {
        name: "Drone Station 2",
        x: 100,
        y: 2,
        z: 120,
        rotation: 0,
        fuelName: "Packaged Turbofuel",
      },
    ]);
  }

  private async promisifyWithRandomDelay<T>(value: T): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(value);
      }, Math.random() * 50);
    });
  }
}
