import {
  satistactoryApiIsUp,
  SATISFACTORY_API_URL,
  setSatisfactoryApiUp,
} from "../env";
import {
  Circuit,
  FactoryStats,
  GeneratorStats,
  ItemStats,
  Player,
  PowerType,
  ProdStats,
  SinkStats,
} from "common/types";
import { ApiError } from "common/src/apiTypes";

export class Service {
  private hasCheckedIfSatisfactoryApiIsUpOnce: boolean;

  constructor() {
    this.hasCheckedIfSatisfactoryApiIsUpOnce = false;
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
                total: circuit.PowerConsumed,
              },
              production: {
                total: circuit.PowerProduction,
              },
              capacity: {
                total: circuit.PowerCapacity,
              },
              battery: {
                percentage: circuit.BatteryPercent,
                capacity: circuit.BatteryCapacity,
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
    return await this.makeSatisfactoryCall("/getFactory").then((data) => {
      let totalMachines = data.length;
      let noOperating = 0;
      let noIdle = 0;
      let noPaused = 0;
      let noUnconfigured = 0;

      for (const machine of data) {
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

      return {
        totalMachines: totalMachines,
        efficiency: {
          machinesOperating: noOperating,
          machinesIdle: noIdle,
          machinesPaused: noPaused,
          machinesUnconfigured: noUnconfigured,
        },
      } as FactoryStats;
    });
  }

  async getProdStats(): Promise<ProdStats> {
    return await this.makeSatisfactoryCall("/getProdStats").then((data) => {
      let minableBeingProduced = 0;
      let minableBeingConsumed = 0;
      let itemsBeingProduced = 0;
      let itemsBeingConsumed = 0;

      const items = [];

      for (const item of data) {
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
    });
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
        } as SinkStats;
      }

      return {
        totalPoints: sink.TotalPoints,
        coupons: sink.NumCoupon,
        nextCouponProgress: sink.Percent,
      } as SinkStats;
    });
  }

  async getItemStats(): Promise<ItemStats[]> {
    return await this.makeSatisfactoryCall("/getWorldInv").then((data) => {
      return data.map((item: any) => {
        return {
          name: item.Name,
          count: item.Amount,
        };
      }) as ItemStats[];
    });
  }

  async getPlayers(): Promise<Player[]> {
    return await this.makeSatisfactoryCall("/getPlayer").then((data) => {
      return (
        data
          .map((player: any) => {
            return {
              id: player.Id,
              name: player.Name,
              health: player.Health,
              pingMs: player.PingMs,
            } as Player;
          })
          // Filter out players with no name
          .filter((player: Player) => player.name)
      );
    });
  }

  async getGeneratorStats(): Promise<GeneratorStats> {
    // return await makeSatisfactoryCall("/getGenerators").then((data) => {
    //   let sources = {} as any;

    //   for (const generator of data) {
    //     const generatorType = blueprintGeneratorNameToType(generator.Name);
    //     if (generatorType) {
    //       if (sources[generatorType]) {
    //         sources[generatorType].count += 1;
    //         sources[generatorType].totalProduction += generator.Production;
    //       }else {
    //         sources[generatorType] = {
    //           count: 1,
    //           totalProduction: generator.Production,
    //         };
    //       }
    //     }
    //   }

    //   return {
    //     sources: sources
    //   } as GeneratorStats;
    // });

    throw new Error("Not implemented");

    return {
      sources: {
        biomass: { count: 5, totalProduction: 0 },
        coal: {
          count: 53,
          totalProduction: 1412 + (Math.random() * 2 - 1) * 100,
        },
        fuel: {
          count: 14,
          totalProduction: 3424 + (Math.random() * 2 - 1) * 100,
        },
        geothermal: {
          count: 4,
          totalProduction: 512 + (Math.random() * 2 - 1) * 100,
        },
        nuclear: {
          count: 1,
          totalProduction: 1024 + (Math.random() * 2 - 1) * 100,
        },
      },
    };
  }

  async checkIfSatisfactoryApiIsUp() {
    return await fetch(SATISFACTORY_API_URL)
      .then(() => {
        if (
          !satistactoryApiIsUp() ||
          !this.hasCheckedIfSatisfactoryApiIsUpOnce
        ) {
          const green = "\x1b[32m";
          console.log("Satisfactory API is %sup\x1b[0m", green);
        }

        setSatisfactoryApiUp(true);
      })
      .catch(() => {
        if (
          satistactoryApiIsUp() ||
          !this.hasCheckedIfSatisfactoryApiIsUpOnce
        ) {
          const red = "\x1b[31m";
          console.log("Satisfactory API is %sdown\x1b[0m", red);
        }

        setSatisfactoryApiUp(false);
      })
      .finally(() => {
        this.hasCheckedIfSatisfactoryApiIsUpOnce = true;
      });
  }

  isSatisfactoryApiAvailable() {
    return satistactoryApiIsUp();
  }

  async setupSatisfactoryApiCheck() {
    return setInterval(this.checkIfSatisfactoryApiIsUp, 10000);
  }

  async makeSatisfactoryCall(path: string) {
    if (!satistactoryApiIsUp()) {
      throw new ApiError("Satisfactory API is down", 503);
    }

    return await fetch(`${SATISFACTORY_API_URL}${path}`)
      .then((res) => res.json())
      .catch((error) => {
        throw new Error(`[${path}] Failed to fetch: ${error}`);
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
