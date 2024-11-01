import React, { createContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circuit,
  FactoryStats,
  GeneratorStats,
  ItemStats,
  Player,
  ProdStats,
  SinkStats,
  Train,
} from 'common/types';
import { SseEvent } from 'common/apiTypes';
import { ApiContext, ApiContextType, ApiData } from './useApi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiProviderProps {
  children: React.ReactNode;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  // const [circuits, setCircuits] = useState<Circuit[]>([]);
  // const [factoryStats, setFactoryStats] = useState<FactoryStats>({} as FactoryStats);
  // const [prodStats, setProdStats] = useState<ProdStats>({} as ProdStats);
  // const [sinkStats, setSinkStats] = useState<SinkStats>({} as SinkStats);
  // const [itemStats, setItemStats] = useState<ItemStats[]>([]);
  // const [players, setPlayers] = useState<Player[]>([]);
  // const [generatorStats, setGeneratorStats] = useState<GeneratorStats>({} as GeneratorStats);
  // const [trains, setTrains] = useState<Train[]>([]);
  // const [trainStations, setTrainStations] = useState<Train[]>([]);

  // const [isLoading, setIsLoading] = useState(true);
  // const [isOnline, setIsOnline] = useState(false);

  const [data, setData] = useState<ApiData>({
    isLoading: true,
    isOnline: false,
    circuits: [],
    factoryStats: {} as FactoryStats,
    prodStats: {} as ProdStats,
    sinkStats: {} as SinkStats,
    itemStats: [],
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
      switch (parsed.type) {
        case 'initial':
          const allData = parsed.data as ApiContextType;

          newData.isLoading = false;
          newData.circuits = allData.circuits;
          newData.factoryStats = allData.factoryStats;
          newData.prodStats = allData.prodStats;
          newData.sinkStats = allData.sinkStats;
          newData.itemStats = allData.itemStats;
          newData.players = allData.players;
          newData.generatorStats = allData.generatorStats;
          newData.trains = allData.trains;
          newData.trainStations = allData.trainStations;
          break;
        case 'circuit':
          newData.circuits = parsed.data;
          break;
        case 'factoryStats':
          newData.factoryStats = parsed.data;
          break;
        case 'prodStats':
          newData.prodStats = parsed.data;
          break;
        case 'sinkStats':
          newData.sinkStats = parsed.data;
          break;
        case 'itemStats':
          newData.itemStats = parsed.data;
          break;
        case 'player':
          newData.players = parsed.data;
          break;
        case 'generatorStats':
          newData.generatorStats = parsed.data;
          break;
        case 'train':
          newData.trains = parsed.data;
          break;
        case 'trainStation':
          newData.trainStations = parsed.data;
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
