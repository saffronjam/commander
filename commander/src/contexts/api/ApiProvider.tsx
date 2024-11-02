import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FactoryStats, GeneratorStats, ProdStats, SinkStats } from 'common/types';
import { SatisfactoryEventType, SseEvent } from 'common/src/apiTypes';
import { ApiContext, ApiContextType, ApiData } from './useApi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiProviderProps {
  children: React.ReactNode;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  const [data, setData] = useState<ApiData>({
    isLoading: true,
    isOnline: false,
    circuits: [],
    factoryStats: {} as FactoryStats,
    prodStats: {} as ProdStats,
    sinkStats: {} as SinkStats,
    players: [],
    generatorStats: {} as GeneratorStats,
    trains: [],
    trainStations: [],
  });
  const [dataHistory, setDataHistory] = useState<(ApiData & { timestamp: Date })[]>([]);

  const websocketRef = useRef<boolean>(false);
  const historyCheckOn = useRef<boolean>(false);

  // Use SSE to update data, /api/events
  const startSse = () => {
    const newData = { ...data };
    const eventSource = new EventSource(`${API_URL}/api/events`);

    newData.isLoading = true;

    eventSource.onmessage = (event) => {
      newData.isOnline = true;

      const parsed = JSON.parse(event.data) as SseEvent<any>;
      switch (parsed.type as SatisfactoryEventType) {
        case SatisfactoryEventType.initial:
          const allData = parsed.data as ApiContextType;
          newData.isLoading = false;
          newData.circuits = allData.circuits;
          newData.factoryStats = allData.factoryStats;
          newData.prodStats = allData.prodStats;
          newData.sinkStats = allData.sinkStats;
          newData.players = allData.players;
          newData.generatorStats = allData.generatorStats;
          newData.trains = allData.trains;
          newData.trainStations = allData.trainStations;
          break;
        case SatisfactoryEventType.circuits:
          newData.circuits = parsed.data;
          break;
        case SatisfactoryEventType.factoryStats:
          newData.factoryStats = parsed.data;
          break;
        case SatisfactoryEventType.prodStats:
          newData.prodStats = parsed.data;
          break;
        case SatisfactoryEventType.sinkStats:
          newData.sinkStats = parsed.data;
          break;
        case SatisfactoryEventType.players:
          newData.players = parsed.data;
          break;
        case SatisfactoryEventType.generatorStats:
          newData.generatorStats = parsed.data;
          break;
        case SatisfactoryEventType.trains:
          newData.trains = parsed.data;
          break;
      }

      setData(newData);
    };

    eventSource.onerror = () => {
      newData.isOnline = false;
      newData.isLoading = false;
      websocketRef.current = false;
    };

    if (historyCheckOn.current) {
      return;
    }
    historyCheckOn.current = true;

    // Setup interval that snapshots the current data
    // then saves to history
    setInterval(() => {
      const latestData = { ...newData, timestamp: new Date() };

      setDataHistory((prevDataHistory) => {
        const newHistory = [...prevDataHistory, latestData];

        // Keep one minute of history, check timestamps
        const oneMinuteAgo = new Date(latestData.timestamp.getTime() - 60000);
        const filteredHistory = newHistory.filter((entry) => entry.timestamp > oneMinuteAgo);

        return filteredHistory;
      });
    }, 500);
  };

  useEffect(() => {
    if (!API_URL) {
      console.error('API_URL is not defined');
      return;
    }

    if (websocketRef.current) {
      return;
    }

    startSse();
  }, []);

  const contextValue = useMemo(() => ({ ...data, history: dataHistory }), [data, dataHistory]);

  return <ApiContext.Provider value={contextValue}>{children}</ApiContext.Provider>;
};
