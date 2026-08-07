import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { DataPoint } from 'src/apiTypes';
import { ApiContext } from 'src/contexts/api/useApi';
import { historyApi, HistoryDataType } from '@/services/historyApi';
import { HistoryDataRange, HistoryWindowSize } from 'src/types';

// bucketSecondsFor mirrors the auto rule the window-size selector implies: an
// explicit width wins, otherwise aim for roughly 100 points across the range.
function bucketSecondsFor(
  historyDataRange: HistoryDataRange,
  historyWindowSize: HistoryWindowSize
): number {
  if (historyWindowSize > 0) {
    return historyWindowSize;
  }
  return Math.max(1, Math.floor((historyDataRange === -1 ? 3600 : historyDataRange) / 100));
}

/**
 * Result of the useHistoryData hook containing historical data points and state.
 */
export interface UseHistoryDataResult<T> {
  /** Array of data points ordered by gameTimeId ascending */
  dataPoints: DataPoint[];
  /** Typed data extracted from dataPoints for convenience */
  data: T[];
  /** Whether initial data is being loaded */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** The highest gameTimeId received so far */
  latestId: number;
  /** Refetch all historical data from the server */
  refetch: () => void;
}

/**
 * Hook for fetching and maintaining historical data with real-time SSE updates.
 * Fetches initial data via REST endpoint, then fetches incremental updates
 * when SSE events trigger context updates.
 *
 * @param sessionId - The session ID to fetch history for
 * @param dataType - The type of data to fetch (circuits, generatorStats, prodStats, factoryStats, sinkStats)
 * @param historyDataRange - How much historical data to fetch in seconds (-1 for all time)
 * @param historyWindowSize - Window size for downsampling (0 = auto, 1 = raw, other = fixed bucket size)
 */
export function useHistoryData<T>(
  sessionId: string | null,
  dataType: HistoryDataType,
  historyDataRange: HistoryDataRange,
  historyWindowSize: HistoryWindowSize = 0
): UseHistoryDataResult<T> {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestId, setLatestId] = useState<number>(0);

  const latestIdRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  const bucketSeconds = bucketSecondsFor(historyDataRange, historyWindowSize);

  const fetchInitialHistory = useCallback(async () => {
    if (!sessionId) {
      setDataPoints([]);
      setIsLoading(false);
      setLatestId(0);
      latestIdRef.current = 0;
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const chunk = await historyApi.fetchHistory({
        sessionId,
        dataType,
        bucketSeconds,
      });

      // Apply client-side pruning based on historyDataRange
      // Skip pruning if historyDataRange is -1 (all time)
      let points = chunk.points || [];
      if (historyDataRange !== -1 && chunk.latestId > 0) {
        const cutoffTime = chunk.latestId - historyDataRange;
        points = points.filter((point) => point.gameTimeId >= cutoffTime);
      }

      setDataPoints(points);
      setLatestId(chunk.latestId);
      latestIdRef.current = chunk.latestId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch history';
      setError(message);
      setDataPoints([]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, dataType, historyDataRange, bucketSeconds]);

  const fetchIncrementalHistory = useCallback(async () => {
    if (!sessionId || isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    const prevLatestId = latestIdRef.current;

    try {
      const chunk = await historyApi.fetchHistory({
        sessionId,
        dataType,
        bucketSeconds,
        since: prevLatestId > 0 ? prevLatestId : undefined,
      });

      if (chunk.points && chunk.points.length > 0) {
        setDataPoints((prev) => {
          // Filter SSE-triggered updates by gameTimeId > lastKnownId to avoid duplicates
          const newPoints = chunk.points.filter(
            (newPoint) =>
              newPoint.gameTimeId > prevLatestId &&
              !prev.some((p) => p.gameTimeId === newPoint.gameTimeId)
          );

          if (newPoints.length === 0) {
            return prev;
          }

          const merged = [...prev, ...newPoints].sort((a, b) => a.gameTimeId - b.gameTimeId);

          // Client-side pruning: remove data points older than (latestId - historyDataRange)
          // Skip pruning if historyDataRange is -1 (all time)
          if (historyDataRange === -1) {
            return merged;
          }

          const newLatestId = chunk.latestId;
          const cutoffTime = newLatestId - historyDataRange;
          return merged.filter((point) => point.gameTimeId >= cutoffTime);
        });

        setLatestId(chunk.latestId);
        latestIdRef.current = chunk.latestId;
      }
    } catch {
      // Silently ignore incremental fetch errors - will retry on next context update
    } finally {
      isFetchingRef.current = false;
    }
  }, [sessionId, dataType, historyDataRange, bucketSeconds]);

  useEffect(() => {
    latestIdRef.current = 0;
    void fetchInitialHistory();
  }, [fetchInitialHistory, sessionId]);

  const contextData = useContextSelector(ApiContext, (v) => {
    switch (dataType) {
      case 'circuits':
        return v.circuits;
      case 'generatorStats':
        return v.generatorStats;
      case 'prodStats':
        return v.prodStats;
      case 'factoryStats':
        return v.factoryStats;
      case 'sinkStats':
        return v.sinkStats;
      default:
        return null;
    }
  });

  const isOnline = useContextSelector(ApiContext, (v) => v.isOnline);

  useEffect(() => {
    if (!isOnline || isLoading) {
      return;
    }

    void fetchIncrementalHistory();
  }, [contextData, isOnline, isLoading, fetchIncrementalHistory]);

  const data = useMemo(() => dataPoints.map((p) => p.data as T), [dataPoints]);

  return {
    dataPoints,
    data,
    isLoading,
    error,
    latestId,
    refetch: fetchInitialHistory,
  };
}
