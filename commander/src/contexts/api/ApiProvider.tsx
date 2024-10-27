import React, { createContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circuit,
  FactoryStats,
  GeneratorStats,
  ItemStats,
  Player,
  ProdStats,
  SinkStats,
} from 'common/types';
import { ApiError } from 'common/apiTypes';
import { ApiContext } from './useApi';
import { useSettings } from 'src/hooks/use-settings';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiProviderProps {
  children: React.ReactNode;
}

export async function fetchAndParse(path: string) {
  return fetch(`${API_URL}${path}`).then((response) => response.json());
}

async function fetchAndSet(
  setter: (data: any) => void,
  path: string,
  onErr: (error: ApiError) => void
) {
  return fetchAndParse(path)
    .then((data) => {
      if (data.code === undefined) {
        setter(data);
      } else {
        onErr(data);
      }
    })
    .catch((err) => {
      onErr({ code: 500, message: err.message });
    });
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  const { settings } = useSettings();
  const [dataHistory, setDataHistory] = useState<any[]>([]);
  const [data, setData] = useState({
    isLoading: true,
    isOnline: false,
    circuits: [] as Circuit[],
    factoryStats: {
      efficiency: { machinesOperating: 0, machinesIdle: 0, machinesPaused: 0 },
      totalMachines: 0,
    } as FactoryStats,
    prodStats: {
      minableProducedPerMinute: 0,
      minableConsumedPerMinute: 0,
      itemsProducedPerMinute: 0,
      itemsConsumedPerMinute: 0,

      items: [] as any[],
    } as ProdStats,
    sinkStats: { totalPoints: 0, coupons: 0, nextCouponProgress: 0 } as SinkStats,
    itemStats: [] as ItemStats[],
    players: [] as Player[],
    generatorStats: {
      sources: {
        biomass: { count: 0, totalProduction: 0 },
        coal: { count: 0, totalProduction: 0 },
        fuel: { count: 0, totalProduction: 0 },
        geothermal: { count: 0, totalProduction: 0 },
        nuclear: { count: 0, totalProduction: 0 },
      },
    } as GeneratorStats,
  });

  const blockFetch = useRef<boolean>(false);

  const intervalsStartedRef = useRef(false); // Track whether intervals have been started
  const timeouts = useRef<NodeJS.Timeout[]>([]);
  const canDoRequest = useRef<Map<string, boolean>>(new Map());

  const startIntervals = () => {
    const onDataUpdate = (newData: any) => {
      if (!blockFetch.current) {
        setDataHistory((prevDataHistory) => {
          const now = new Date();
          const updatedHistory = [...prevDataHistory, { ...newData, timestamp: now }];

          // Keep one minute of history, check timestamps
          const oneMinuteAgo = new Date(now.getTime() - 60000);
          const filteredHistory = updatedHistory.filter((entry) => entry.timestamp > oneMinuteAgo);

          return filteredHistory;
        });
      }
      setData(newData);
    };

    // Only start intervals if they haven't been started yet
    if (!intervalsStartedRef.current) {
      intervalsStartedRef.current = true;

      const startIntervals = () => {
        const newData = { ...data };

        newData.isLoading = false;

        const ops = [
          {
            op: (val: any) => {
              newData.isOnline = val.up;
            },
            path: '/api/satisfactoryApiCheck',
            interval: settings.intervals.satisfactoryApiCheck,
            healthCheck: true,
            onErr: (err: ApiError) => {
              if (err.code >= 500) {
                newData.isOnline = false;
              }
            },
          },
          {
            op: (val: any) => {
              newData.circuits = val;
            },
            path: '/api/circuits',
            interval: settings.intervals.circuits,
          },
          {
            op: (val: any) => {
              newData.factoryStats = val;
            },
            path: '/api/factoryStats',
            interval: settings.intervals.factoryStats,
          },
          {
            op: (val: any) => {
              newData.prodStats = val;
            },
            path: '/api/prodStats',
            interval: settings.intervals.prodStats,
          },
          {
            op: (val: any) => {
              newData.sinkStats = val;
            },
            path: '/api/sinkStats',
            interval: settings.intervals.sinkStats,
          },
          {
            op: (val: any) => {
              newData.itemStats = val;
            },
            path: '/api/itemStats',
            interval: settings.intervals.itemStats,
          },
          {
            op: (val: any) => {
              newData.players = val;
            },
            path: '/api/players',
            interval: settings.intervals.players,
          },
          {
            op: (val: any) => {
              newData.generatorStats = val;
            },
            path: '/api/generatorStats',
            interval: settings.intervals.generatorStats,
          },
        ];

        const handleFetchFail = (err: ApiError) => {
          if (err.code === 503) {
            blockFetch.current = true;
          }
        };

        // Set up intervals, and fetch data periodically
        ops.forEach(({ op, path, interval, healthCheck, onErr }) => {
          canDoRequest.current.set(path, true);
          fetchAndSet(op, path, handleFetchFail);
          const id = setInterval(() => {
            if (!healthCheck && blockFetch.current) {
              return;
            }

            if (!canDoRequest.current.get(path)) {
              return;
            }

            canDoRequest.current.set(path, false);
            fetchAndSet(op, path, onErr || handleFetchFail).then(() => {
              canDoRequest.current.set(path, true);
            });
          }, interval);

          timeouts.current.push(id);
        });

        // Update state data periodically, decoupled from the fetch intervals
        const id = setInterval(() => {
          onDataUpdate({ ...newData });
        }, settings.intervals.rerender);

        timeouts.current.push(id);
      };

      startIntervals(); // Start the fetching intervals once
    }
  };

  const restartIntervals = () => {
    timeouts.current.forEach((id) => clearInterval(id));
    intervalsStartedRef.current = false;
    startIntervals();
  };

  useEffect(() => {
    if (!API_URL) {
      console.error('API_URL is not defined');
      return;
    }

    restartIntervals();
  }, [settings]);

  const api = useMemo(
    () => ({
      isLoading: data.isLoading,
      isOnline: data.isOnline,

      circuits: data.circuits,
      factoryStats: data.factoryStats,
      prodStats: data.prodStats,
      sinkStats: data.sinkStats,
      itemStats: data.itemStats,
      players: data.players,
      generatorStats: data.generatorStats,

      history: dataHistory as [
        {
          timestamp: Date;
          circuits: Circuit[];
          factoryStats: FactoryStats;
          prodStats: ProdStats;
          sinkStats: SinkStats;
          itemStats: ItemStats[];
          players: Player[];
          generatorStats: GeneratorStats;
        },
      ],
    }),
    [data, dataHistory]
  );

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
};
