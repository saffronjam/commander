import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FactoryStats, GeneratorStats, ProdStats, SinkStats } from 'common/types';
import { FullState, SatisfactoryEventType, SseEvent } from 'common/src/apiTypes';
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

    const fetchState = async () => {
      return fetch(`${API_URL}/api/state`)
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to get full state');
          }
          return response.json() as Promise<FullState>;
        })
        .then((fullState) => {
          newData.isOnline = fullState.isOnline;
          newData.circuits = fullState.circuits;
          newData.factoryStats = fullState.factoryStats;
          newData.prodStats = fullState.prodStats;
          newData.sinkStats = fullState.sinkStats;
          newData.players = fullState.players;
          newData.generatorStats = fullState.generatorStats;
          newData.trains = fullState.trains;
          newData.trainStations = fullState.trainStations;
          newData.isLoading = false;
        })
        .catch((error) => {
          console.error('Failed to get full state: ', error);
          newData.isOnline = false;
        });
    };

    newData.isLoading = true;
    fetchState();
    setData(newData);

    eventSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as SseEvent<any>;
      switch (parsed.type as SatisfactoryEventType) {
        case SatisfactoryEventType.satisfactoryApiCheck:
          // If was offline, and now is online, set loading to false and request full state
          if (!newData.isOnline && parsed.data.isOnline) {
            fetchState();
            newData.isLoading = false;
          } else {
            newData.isOnline = parsed.data.isOnline;
          }
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
          newData.trains = parsed.data.trains;
          newData.trainStations = parsed.data.trainStations;
          break;
      }
    };

    eventSource.onerror = () => {
      newData.isOnline = false;
      newData.isLoading = false;
      websocketRef.current = false;
      setData(newData);
    };

    if (historyCheckOn.current) {
      return;
    }
    historyCheckOn.current = true;

    // Setup interval that snapshots the current data
    // then saves to history
    setInterval(() => {
      setData(newData);
      // Only add to history if not loading and online
      if (newData.isLoading || !newData.isOnline) {
        return;
      }

      const latestData = { ...newData, timestamp: new Date() };

      setDataHistory((prevDataHistory) => {
        const newHistory = [...prevDataHistory, latestData];

        // Keep one minute of history, check timestamps
        const oneMinuteAgo = new Date(latestData.timestamp.getTime() - 60000);
        const filteredHistory = newHistory.filter((entry) => entry.timestamp > oneMinuteAgo);

        return filteredHistory;
      });
    }, 1000);
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
