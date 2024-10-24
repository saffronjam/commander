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
    .catch((error) => console.error('Failed to fetch:', error));
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  const [dataHistory, setDataHistory] = useState<any[]>([]);
  const [data, setData] = useState({
    isLoading: true,
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

  useEffect(() => {
    if (!API_URL) {
      console.error('API_URL is not defined');
      return;
    }

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
              newData.circuits = val;
            },
            path: '/api/circuits',
            interval: 500,
          },
          {
            op: (val: any) => {
              newData.factoryStats = val;
            },
            path: '/api/factoryStats',
            interval: 2000,
          },
          {
            op: (val: any) => {
              newData.prodStats = val;
            },
            path: '/api/prodStats',
            interval: 1000,
          },
          {
            op: (val: any) => {
              newData.sinkStats = val;
            },
            path: '/api/sinkStats',
            interval: 2000,
          },
          {
            op: (val: any) => {
              newData.itemStats = val;
            },
            path: '/api/itemStats',
            interval: 2000,
          },
          {
            op: (val: any) => {
              newData.players = val;
            },
            path: '/api/players',
            interval: 2000,
          },
          {
            op: (val: any) => {
              newData.generatorStats = val;
            },
            path: '/api/generatorStats',
            interval: 2000,
          },
        ];

        const handleFetchFail = (err: ApiError) => {
          if (err.code === 503) {
            blockFetch.current = true;
            setTimeout(() => {
              blockFetch.current = false;
            }, 10000);
          }
        };

        // Set up intervals, and fetch data periodically
        ops.forEach(({ op, path, interval }) => {
          fetchAndSet(op, path, handleFetchFail);
          setInterval(() => {
            if (blockFetch.current) {
              return;
            }
            fetchAndSet(op, path, handleFetchFail);
          }, interval);
        });

        // Update state data periodically, decoupled from the fetch intervals
        setInterval(() => {
          onDataUpdate({ ...newData });
        }, 1000);
      };

      startIntervals(); // Start the fetching intervals once
    }
  }); // Dependency to ensure `data` is accessible within fetch logic

  const api = useMemo(
    () => ({
      isLoading: data.isLoading,

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
