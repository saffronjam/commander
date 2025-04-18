import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ApiContext, ApiData } from './useApi';
import * as API from 'src/apiTypes';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/v1';

interface ApiProviderProps {
  children: React.ReactNode;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  const [data, setData] = useState<ApiData>({
    isLoading: true,
    isOnline: false,
    circuits: [],
    factoryStats: {} as API.FactoryStats,
    prodStats: {} as API.ProdStats,
    sinkStats: {} as API.SinkStats,
    players: [],
    generatorStats: {} as API.GeneratorStats,
    trains: [],
    trainStations: [],
    drones: [],
    droneStations: [],
  });
  const [dataHistory, setDataHistory] = useState<(ApiData & { timestamp: Date })[]>([]);

  const websocketRef = useRef<boolean>(false);
  const historyCheckOn = useRef<boolean>(false);

  // Use SSE to update data
  const startSse = () => {
    const newData = { ...data };
    const eventSource = new EventSource(`${API_URL}/eventsSse`);

    const fetchState = async () => {
      return fetch(`${API_URL}/state`)
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to get full state');
          }
          return response.json() as Promise<API.State>;
        })
        .then((fullState) => {
          newData.isOnline = fullState.satisfactoryApiStatus.running;
          newData.circuits = fullState.circuits;
          newData.factoryStats = fullState.factoryStats;
          newData.prodStats = fullState.prodStats;
          newData.sinkStats = fullState.sinkStats;
          newData.players = fullState.players;
          newData.generatorStats = fullState.generatorStats;
          newData.trains = fullState.trains;
          newData.trainStations = fullState.trainStations;
          newData.drones = fullState.drones;
          newData.droneStations = fullState.droneStations;
          newData.isLoading = false;
        })
        .catch((error) => {
          console.error('Failed to get full state: ', error);
          newData.isOnline = false;
        });
    };

    newData.isLoading = true;
    void fetchState();
    setData(newData);

    eventSource.addEventListener(API.SatisfactoryEventKey, (event) => {
      const parsed = JSON.parse(event.data) as API.SseSatisfactoryEvent;
      switch (parsed.type as API.SatisfactoryEventType) {
        case API.SatisfactoryEventApiStatus:
          // If was offline, and now is online, set loading to false and request full state
          if (!newData.isOnline && parsed.data.running) {
            void fetchState();
            newData.isLoading = false;
          } else {
            newData.isOnline = parsed.data.running;
          }
          break;
        case API.SatisfactoryEventCircuits:
          newData.circuits = parsed.data;
          break;
        case API.SatisfactoryEventFactoryStats:
          newData.factoryStats = parsed.data;
          break;
        case API.SatisfactoryEventProdStats:
          newData.prodStats = parsed.data;
          break;
        case API.SatisfactoryEventSinkStats:
          newData.sinkStats = parsed.data;
          break;
        case API.SatisfactoryEventPlayers:
          newData.players = parsed.data;
          break;
        case API.SatisfactoryEventGeneratorStats:
          newData.generatorStats = parsed.data;
          break;
        case API.SatisfactoryEventTrainSetup:
          newData.trains = parsed.data.trains;
          newData.trainStations = parsed.data.trainStations;
          break;
        case API.SatisfactoryEventDroneSetup:
          newData.drones = parsed.data.drones;
          newData.droneStations = parsed.data.droneStations;
          break;
      }
    });

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
        return newHistory.filter((entry) => entry.timestamp > oneMinuteAgo);
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
