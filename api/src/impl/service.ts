import {
  satistactoryApiIsUp,
  SATISFACTORY_API_URL,
  setSatisfactoryApiUp,
} from "../env";
import {
  Circuit,
  Drone,
  DroneStation,
  DroneStatus,
  FactoryStats,
  GeneratorStats,
  ItemStats,
  Machine,
  MachineCategory,
  MachineProductionStats,
  MachineStatus,
  Player,
  PowerType,
  ProdStats,
  SinkStats,
  Train,
  TrainSetup,
  TrainStation,
  TrainStatus,
  TrainTimetableEntry,
} from "common/types";
import { ApiError, FullState, SatisfactoryApiCheck } from "common/src/apiTypes";
import { SatisfactoryEventType } from "common/src/apiTypes";
import { SatisfactoryEventCallback } from "../service";

const satisfactoryStatusToTrainStatus = (
  trainData: any,
  relevantTrainStations: any
) => {
  if (trainData.Derailed) {
    return TrainStatus.derailed;
  }

  for (const station of relevantTrainStations) {
    if (
      Math.abs(trainData.location.z - station.location.z) < 0.1 &&
      Math.abs(trainData.location.x - station.location.x) < 10 &&
      Math.abs(trainData.location.y - station.location.y) < 10
    ) {
      return TrainStatus.docking;
    }
  }

  switch (trainData.Status) {
    case "Self-Driving":
      return TrainStatus.selfDriving;
    case "Manual Driving":
      return TrainStatus.manualDriving;
    case "Parked":
      return TrainStatus.parked;
    default:
      return "Unknown (" + trainData.Status + ")";
  }
};

const satisfactoryStatusToDroneStatus = (
  droneData: any,
  relevantDroneStations: DroneStation[]
) => {
  for (const station of relevantDroneStations) {
    if (
      Math.abs(droneData.location.z - station.z) < 1000 &&
      Math.abs(droneData.location.x - station.x) < 10 &&
      Math.abs(droneData.location.y - station.y) < 10
    ) {
      return DroneStatus.docking;
    }
  }

  return DroneStatus.flying;
};

export class Service {
  setupEventListener(callback: SatisfactoryEventCallback) {
    const endpoints = [
      {
        type: SatisfactoryEventType.satisfactoryApiCheck,
        endpoint: this.getSatisfactoryApiStatus.bind(this),
        interval: 5000,
      },
      {
        type: SatisfactoryEventType.circuits,
        endpoint: this.getCircuits.bind(this),
        interval: 2000,
      },
      {
        type: SatisfactoryEventType.factoryStats,
        endpoint: this.getFactoryStats.bind(this),
        interval: 2000,
      },
      {
        type: SatisfactoryEventType.prodStats,
        endpoint: this.getProdStats.bind(this),
        interval: 2000,
      },
      {
        type: SatisfactoryEventType.sinkStats,
        endpoint: this.getSinkStats.bind(this),
        interval: 2000,
      },
      {
        type: SatisfactoryEventType.players,
        endpoint: this.getPlayers.bind(this),
        interval: 2000,
      },
      {
        type: SatisfactoryEventType.generatorStats,
        endpoint: this.getGeneratorStats.bind(this),
        interval: 2000,
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
          } as any;
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

  async getFullState(): Promise<FullState> {
    const allPromises = Promise.all([
      this.getSatisfactoryApiStatus(),
      this.getCircuits(),
      this.getFactoryStats(),
      this.getProdStats(),
      this.getSinkStats(),
      this.getPlayers(),
      this.getGeneratorStats(),
      this.getTrains(),
      this.getTrainStations(),
      this.getDrones(),
      this.getDroneStations(),
    ]);

    return await allPromises
      .then((values) => {
        let i = 0;
        return {
          isOnline: (values[i++] as SatisfactoryApiCheck).isOnline,
          circuits: values[i++] as Circuit[],
          factoryStats: values[i++] as FactoryStats,
          prodStats: values[i++] as ProdStats,
          sinkStats: values[i++] as SinkStats,
          players: values[i++] as Player[],
          generatorStats: values[i++] as GeneratorStats,
          trains: values[i++] as Train[],
          trainStations: values[i++] as TrainStation[],
          drones: values[i++] as Drone[],
          droneStations: values[i++] as DroneStation[],
        };
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          if (error.message !== "Satisfactory API is down") {
            console.error(`[Initial event] ${error.message}`);
          }
        }

        return {
          isOnline: false,
        } as FullState;
      });
  }

  async getCircuits(): Promise<Circuit[]> {
    return await this.makeSatisfactoryCall("/getPower").then((data) => {
      return (
        data
          .map((circuit: any) => {
            // Parse string from 00:00:00 (HH:MM:SS) to seconds (int)
            const secondsToFullyCharge =
              circuit.BatteryTimeFull?.split(":").reduce(
                (acc: number, time: string, i: number) => {
                  return acc + parseInt(time) * Math.pow(60, 2 - i);
                },
                0
              ) || 0;
            const secondsToFullyDischarge =
              circuit.BatteryTimeEmpty?.split(":").reduce(
                (acc: number, time: string, i: number) => {
                  return acc + parseInt(time) * Math.pow(60, 2 - i);
                },
                0
              ) || 0;

            return {
              id: circuit.CircuitID,
              consumption: {
                total: circuit.PowerConsumed * 1_000_000,
                max: circuit.PowerMaxConsumed * 1_000_000,
              },
              production: {
                total: circuit.PowerProduction * 1_000_000,
              },
              capacity: {
                total: circuit.PowerCapacity * 1_000_000,
              },
              battery: {
                percentage: circuit.BatteryPercent,
                capacity: circuit.BatteryCapacity * 1_000_000,
                differential: circuit.BatteryDifferential * 1_000_000,
                untilFull: secondsToFullyCharge,
                untilEmpty: secondsToFullyDischarge,
              },
              fuseTriggered: circuit.FuseTriggered,
            } as Circuit;
          })
          // Filter out circuits with no production
          .filter((circuit: Circuit) => circuit.production.total > 0)
          // Sort by largest production
          .sort(
            (a: Circuit, b: Circuit) => b.production.total - a.production.total
          )
      );
    });
  }

  async getFactoryStats(): Promise<FactoryStats> {
    const machineStatus = (machine: any) => {
      if (machine.IsProducing) {
        return MachineStatus.operating;
      }
      if (machine.IsPaused) {
        return MachineStatus.paused;
      }
      if (!machine.IsConfigured) {
        return MachineStatus.unconfigured;
      }
      return MachineStatus.idle;
    };

    let totalMachines = 0;
    let noOperating = 0;
    let noIdle = 0;
    let noPaused = 0;
    let noUnconfigured = 0;

    const extractors = await this.makeSatisfactoryCall("/getExtractor").then(
      (data) => {
        return data.map((machine: any) => {
          return {
            type: machine.Name,
            category: MachineCategory.extractor,
            status: machineStatus(machine),

            x: machine.location.x,
            y: machine.location.y,
            z: machine.location.z,
            rotation: machine.location.rotation,

            input: [
              {
                name: "Power",
                current: machine.PowerInfo.PowerConsumed,
                max: machine.PowerInfo.MaxPowerConsumed,
              },
            ],
            output: [
              ...machine.production.map((prod: any) => {
                return {
                  name: prod.Name,
                  stored: prod.Amount,
                  current: prod.CurrentProd,
                  max: prod.MaxProd,
                  efficiency: prod.ProdPercent / 100,
                } as MachineProductionStats;
              }),
            ],
          } as Machine;
        }) as Machine[];
      }
    );

    const factoryMachines = await this.makeSatisfactoryCall("/getFactory").then(
      (data) => {
        for (const machine of data) {
          totalMachines++;
          if (machine.IsProducing) {
            noOperating += 1;
          } else {
            noIdle += 1;
          }

          if (machine.IsPaused) {
            noPaused += 1;
          }

          if (!machine.IsConfigured) {
            noUnconfigured += 1;
          }
        }

        return data.map((machine: any) => {
          return {
            type: machine.Name,
            category: MachineCategory.factory,
            status: machineStatus(machine),

            x: machine.location.x,
            y: machine.location.y,
            z: machine.location.z,
            rotation: machine.location.rotation,

            input: [
              {
                name: "Power",
                current: machine.PowerInfo.PowerConsumed,
                max: machine.PowerInfo.MaxPowerConsumed,
              },
              ...machine.ingredients.map((ing: any) => {
                return {
                  name: ing.Name,
                  stored: ing.Amount,
                  current: ing.CurrentConsumed,
                  max: ing.MaxConsumed,
                  efficiency: ing.ConsPercent / 100,
                } as MachineProductionStats;
              }),
            ],
            output: [
              ...machine.production.map((prod: any) => {
                return {
                  name: prod.Name,
                  stored: prod.Amount,
                  current: prod.CurrentProd,
                  max: prod.MaxProd,
                  efficiency: prod.ProdPercent / 100,
                } as MachineProductionStats;
              }),
            ],
          } as Machine;
        }) as Machine[];
      }
    );

    return {
      totalMachines: totalMachines,
      efficiency: {
        machinesOperating: noOperating,
        machinesIdle: noIdle,
        machinesPaused: noPaused,
        machinesUnconfigured: noUnconfigured,
      },
      machines: [...extractors, ...factoryMachines],
    } as FactoryStats;
  }

  async getProdStats(): Promise<ProdStats> {
    const prodData = await this.makeSatisfactoryCall("/getProdStats");
    const itemData = await this.makeSatisfactoryCall("/getWorldInv");

    // Convert itemData to a map for easier lookup
    const itemMap = itemData.reduce((acc: any, item: any) => {
      acc[item.Name] = item;
      return acc;
    }, {});

    let minableBeingProduced = 0;
    let minableBeingConsumed = 0;
    let itemsBeingProduced = 0;
    let itemsBeingConsumed = 0;

    const items = [];

    for (const item of prodData) {
      const minable = this.isMinableResource(item.Name);

      if (minable) {
        minableBeingProduced += item.CurrentProd || 0;
        minableBeingConsumed += item.CurrentConsumed || 0;
      } else {
        itemsBeingProduced += item.CurrentProd || 0;
        itemsBeingConsumed += item.CurrentConsumed || 0;
      }

      items.push({
        name: item.Name,
        count: itemMap[item.Name]?.Amount || 0,

        producedPerMinute: item.CurrentProd,
        maxProducePerMinute: item.MaxProd,
        produceEfficiency: item.ProdPercent / 100,

        consumedPerMinute: item.CurrentConsumed,
        maxConsumePerMinute: item.MaxConsumed,
        consumeEfficiency: item.ConsPercent / 100,

        minable: minable,
      });
    }

    return {
      minableProducedPerMinute: Math.round(minableBeingProduced),
      minableConsumedPerMinute: Math.round(minableBeingConsumed),
      itemsProducedPerMinute: Math.round(itemsBeingProduced),
      itemsConsumedPerMinute: Math.round(itemsBeingConsumed),

      items: items.sort((a, b) => b.producedPerMinute - a.producedPerMinute),
    } as ProdStats;
  }

  async getSinkStats(): Promise<SinkStats> {
    return await this.makeSatisfactoryCall("/getResourceSink").then((data) => {
      // For some reason we get a list with one item, so we just take the first
      const sink = data[0];

      if (!sink) {
        return {
          totalPoints: 0,
          coupons: 0,
          nextCouponProgress: 0,
          pointsPerMinute: 0,
        } as SinkStats;
      }

      return {
        totalPoints: sink.TotalPoints,
        coupons: sink.NumCoupon,
        nextCouponProgress: sink.Percent,
        pointsPerMinute:
          Array.isArray(sink.GraphPoints) && sink.GraphPoints.length > 0
            ? sink.GraphPoints[sink.GraphPoints.length - 1]
            : 0,
      } as SinkStats;
    });
  }

  async getPlayers(): Promise<Player[]> {
    return await this.makeSatisfactoryCall("/getPlayer").then((data) => {
      return data
        .filter((player: any) => player.Name)
        .map((player: any) => {
          return {
            id: player.Id,
            name: player.Name,
            health: player.PlayerHP,
            items: player.Inventory.map((item: any) => {
              return {
                name: item.Name,
                count: item.Amount,
              } as ItemStats;
            }).sort((a: any, b: any) => b.count - a.count),
          } as Player;
        });
    });
  }

  async getGeneratorStats(): Promise<GeneratorStats> {
    const res = await this.makeSatisfactoryCall("/getGenerators").then(
      (data) => {
        const powerByType = (
          generator: any,
          generatorType: PowerType
        ): number => {
          switch (generatorType) {
            case PowerType.biomass:
              return generator.RegulatedDemandProd;
            case PowerType.coal:
              return generator.RegulatedDemandProd;
            case PowerType.fuel:
              return generator.RegulatedDemandProd;
            case PowerType.geothermal:
              return generator.PowerProductionPotential;
            case PowerType.nuclear:
              return generator.RegulatedDemandProd;
          }
        };

        let sources = {} as any;
        const machines: Machine[] = [];

        for (const generator of data) {
          const generatorType = this.blueprintGeneratorNameToType(
            generator.Name
          );
          if (generatorType) {
            const power = powerByType(generator, generatorType);

            if (sources[generatorType]) {
              sources[generatorType].count += 1;
              sources[generatorType].totalProduction += power;
            } else {
              sources[generatorType] = {
                count: 1,
                totalProduction: power,
              };
            }

            machines.push({
              x: generator.location.x,
              y: generator.location.y,
              z: generator.location.z,
              rotation: generator.location.rotation,
              status: MachineStatus.operating, // TODO: Implement status
              type: generator.Name,
              category: MachineCategory.generator,
              input: [],
              output: [
                {
                  name: "Power",
                  current: power,
                  max: generator.PowerProductionPotential,
                  efficiency:
                    generator.PowerProduction /
                    generator.PowerProductionPotential,
                } as MachineProductionStats,
              ],
            });
          }
        }

        return {
          sources: sources,
          machines: machines,
        } as GeneratorStats;
      }
    );

    return res;
  }

  async getTrains(): Promise<Train[]> {
    const trainStations = await this.makeSatisfactoryCall("/getTrainStation");
    const trains = await this.makeSatisfactoryCall("/getTrains");

    const timeTableStationsSet = new Set(
      trainStations.map((station: any) => station.Name)
    );
    const relevantTrainStations = trainStations.filter((station: any) =>
      timeTableStationsSet.has(station.Name)
    );

    return trains
      .filter((train: any) => train.Name !== "Train")
      .map((train: any) => {
        return {
          name: train.Name,
          speed: train.ForwardSpeed,

          x: train.location.x,
          y: train.location.y,
          z: train.location.z,
          rotation: train.location.rotation,

          timetable: train.TimeTable.map((stop: any) => {
            return {
              station: stop.StationName,
            } as TrainTimetableEntry;
          }),
          timetableIndex: train.TimeTableIndex,
          status: satisfactoryStatusToTrainStatus(train, relevantTrainStations),
          powerConsumption: train.PowerInfo.PowerConsumed,
          vechicles: train.Vehicles.map((vehicle: any) => {
            return {
              type: vehicle.Type,
              capacity: vehicle.Capacity,
              inventory: vehicle.Inventory.map((item: any) => {
                return {
                  name: item.Name,
                  count: item.Amount,
                } as ItemStats;
              }),
            };
          }),
        } as Train;
      });
  }

  async getTrainStations(): Promise<TrainStation[]> {
    return await this.makeSatisfactoryCall("/getTrainStation").then((data) => {
      return data.map((station: any) => {
        return {
          name: station.Name,
          x: station.location.x,
          y: station.location.y,
          z: station.location.z,
          rotation: station.location.rotation,
        } as TrainStation;
      });
    });
  }

  async getDrones(): Promise<Drone[]> {
    const droneStations = await this.getDroneStations();
    const drones = await this.makeSatisfactoryCall("/getDrone");

    return drones.map((drone: any) => {
      return {
        name: drone.Name,
        x: drone.location.x,
        y: drone.location.y,
        z: drone.location.z,
        rotation: drone.location.rotation,

        speed: drone.FlyingSpeed,
        status: satisfactoryStatusToDroneStatus(drone, droneStations),

        home: droneStations.find(
          (station) => station.name === drone.HomeStation
        ),
        paired: droneStations.find(
          (station) => station.name === drone.TargetStation
        ),
        destination: droneStations.find(
          (station) => station.name === drone.DestinationStation
        ),
      } as Drone;
    });
  }

  async getDroneStations(): Promise<DroneStation[]> {
    return await this.makeSatisfactoryCall("/getDroneStation").then((data) => {
      return data.map((station: any) => {
        return {
          name: station.Name,
          x: station.location.x,
          y: station.location.y,
          z: station.location.z,
          rotation: station.location.rotation,
          fuelName:
            station.ActiveFuel.FuelName !== "N/A"
              ? station.ActiveFuel.FuelName
              : undefined,
        } as DroneStation;
      });
    });
  }

  async getSatisfactoryApiStatus(): Promise<SatisfactoryApiCheck> {
    return await fetch(SATISFACTORY_API_URL, {
      signal: AbortSignal.timeout(1000),
    })
      .then(() => {
        setSatisfactoryApiUp(true);
        return {
          isOnline: true,
        } as SatisfactoryApiCheck;
      })
      .catch(() => {
        setSatisfactoryApiUp(false);
        return {
          isOnline: false,
        } as SatisfactoryApiCheck;
      })
      .finally(() => {});
  }

  async makeSatisfactoryCall(path: string) {
    if (!satistactoryApiIsUp()) {
      throw new ApiError("Satisfactory API is down", 503);
    }

    return await fetch(`${SATISFACTORY_API_URL}${path}`, {
      signal: AbortSignal.timeout(1000),
    })
      .then((res) => res.json())
      .catch((error) => {
        throw new ApiError(`[${path}] Failed to fetch: ${error}`);
      });
  }

  blueprintGeneratorNameToType(name: string) {
    if (name.includes("Bio")) {
      return PowerType.biomass;
    }

    if (name.includes("Coal")) {
      return PowerType.coal;
    }

    if (name.includes("Fuel")) {
      return PowerType.fuel;
    }

    if (name.includes("Geo")) {
      return PowerType.geothermal;
    }

    if (name.includes("Nuclear")) {
      return PowerType.nuclear;
    }

    return null;
  }

  isMinableResource(name: string) {
    const includes = [" ore"];
    const equals = [
      "water",
      "sulfur",
      "coal",
      "caterium",
      "raw quartz",
      "bauxite",
      "crude oil",
      "limestone",
    ];

    const lowerName = name.toLowerCase();

    for (const include of includes) {
      if (lowerName.includes(include)) {
        return true;
      }
    }

    for (const equal of equals) {
      if (lowerName === equal) {
        return true;
      }
    }

    return false;
  }
}
