import type { DataPoint } from 'src/apiTypes';
import { mapGeneratorStats_world } from 'src/contexts/api/live_world';
import { graphql } from 'src/gql';
import { client } from 'src/gql/client';
import type { HistoryDataRange } from 'src/types';

/** Valid data types that support history storage */
export type HistoryDataType =
  | 'circuits'
  | 'generatorStats'
  | 'prodStats'
  | 'factoryStats'
  | 'sinkStats';

/** Parameters for fetching history data */
export interface FetchHistoryParams {
  sessionId: string;
  dataType: HistoryDataType;
  saveName?: string;
  since?: number;
  limit?: number;
  historyDataRange?: HistoryDataRange;
  currentGameTime?: number;
}

/** Response for listing available save names with history */
export interface ListHistorySavesResponse {
  saveNames: string[];
  currentSave: string;
}

/** A batch of historical data points, reshaped from a GraphQL history query */
export interface HistoryChunk {
  dataType: string;
  saveName: string;
  latestId: number;
  points: DataPoint[];
}

function calculateSince(params: FetchHistoryParams): number | undefined {
  const { since, historyDataRange, currentGameTime } = params;
  if (since !== undefined) {
    return since;
  }
  if (historyDataRange === undefined || historyDataRange === -1 || currentGameTime === undefined) {
    return undefined;
  }
  const calculatedSince = currentGameTime - historyDataRange;
  return calculatedSince > 0 ? calculatedSince : undefined;
}

const CircuitsHistoryQuery = graphql(`
  query CircuitsHistory($sessionId: ID!, $saveName: String!, $since: Int, $maxPoints: Int) {
    circuitsHistory(sessionId: $sessionId, saveName: $saveName, since: $since, maxPoints: $maxPoints) {
      gameTimeId
      circuits {
        id
        fuseTriggered
        consumption { total max }
        production { total }
        capacity { total }
        battery { percentage capacity differential untilFull untilEmpty }
      }
    }
  }
`);

const FactoryStatsHistoryQuery = graphql(`
  query FactoryStatsHistory($sessionId: ID!, $saveName: String!, $since: Int, $maxPoints: Int) {
    factoryStatsHistory(sessionId: $sessionId, saveName: $saveName, since: $since, maxPoints: $maxPoints) {
      gameTimeId
      factoryStats {
        totalMachines
        efficiency {
          machinesOperating
          machinesIdle
          machinesPaused
          machinesUnconfigured
          machinesUnknown
        }
      }
    }
  }
`);

const ProdStatsHistoryQuery = graphql(`
  query ProdStatsHistory($sessionId: ID!, $saveName: String!, $since: Int, $maxPoints: Int) {
    prodStatsHistory(sessionId: $sessionId, saveName: $saveName, since: $since, maxPoints: $maxPoints) {
      gameTimeId
      prodStats {
        minableProducedPerMinute
        minableConsumedPerMinute
        itemsProducedPerMinute
        itemsConsumedPerMinute
        items {
          name
          count
          producedPerMinute
          maxProducePerMinute
          produceEfficiency
          consumedPerMinute
          maxConsumePerMinute
          consumeEfficiency
          cloudCount
          minable
        }
      }
    }
  }
`);

const GeneratorStatsHistoryQuery = graphql(`
  query GeneratorStatsHistory($sessionId: ID!, $saveName: String!, $since: Int, $maxPoints: Int) {
    generatorStatsHistory(sessionId: $sessionId, saveName: $saveName, since: $since, maxPoints: $maxPoints) {
      gameTimeId
      generatorStats {
        sources {
          type
          source { count totalProduction }
        }
      }
    }
  }
`);

const SinkStatsHistoryQuery = graphql(`
  query SinkStatsHistory($sessionId: ID!, $saveName: String!, $since: Int, $maxPoints: Int) {
    sinkStatsHistory(sessionId: $sessionId, saveName: $saveName, since: $since, maxPoints: $maxPoints) {
      gameTimeId
      sinkStats { totalPoints coupons nextCouponProgress pointsPerMinute }
    }
  }
`);

const HistorySavesQuery = graphql(`
  query HistorySaves($sessionId: ID!) {
    historySaves(sessionId: $sessionId)
  }
`);

/**
 * History API service backed by the per-type GraphQL <domain>History queries.
 * Results are reshaped into the HistoryChunk { points: DataPoint[] } the charts
 * consume; the opaque DataPoint.data carries the typed payload.
 */
export const historyApi = {
  fetchHistory: async (params: FetchHistoryParams): Promise<HistoryChunk> => {
    const { sessionId, dataType, limit } = params;
    const saveName = params.saveName ?? '';
    const since = calculateSince(params);
    const vars = {
      sessionId,
      saveName,
      since: since ?? null,
      maxPoints: limit ?? null,
    };

    let points: DataPoint[] = [];

    switch (dataType) {
      case 'circuits': {
        const r = await client.query(CircuitsHistoryQuery, vars).toPromise();
        if (r.error) throw new Error(r.error.message);
        points = (r.data?.circuitsHistory ?? []).map((p) => ({
          gameTimeId: p.gameTimeId,
          dataType,
          data: p.circuits,
        }));
        break;
      }
      case 'factoryStats': {
        const r = await client.query(FactoryStatsHistoryQuery, vars).toPromise();
        if (r.error) throw new Error(r.error.message);
        points = (r.data?.factoryStatsHistory ?? []).map((p) => ({
          gameTimeId: p.gameTimeId,
          dataType,
          data: p.factoryStats,
        }));
        break;
      }
      case 'prodStats': {
        const r = await client.query(ProdStatsHistoryQuery, vars).toPromise();
        if (r.error) throw new Error(r.error.message);
        points = (r.data?.prodStatsHistory ?? []).map((p) => ({
          gameTimeId: p.gameTimeId,
          dataType,
          data: p.prodStats,
        }));
        break;
      }
      case 'generatorStats': {
        const r = await client.query(GeneratorStatsHistoryQuery, vars).toPromise();
        if (r.error) throw new Error(r.error.message);
        points = (r.data?.generatorStatsHistory ?? []).map((p) => ({
          gameTimeId: p.gameTimeId,
          dataType,
          data: mapGeneratorStats_world(p.generatorStats as never),
        }));
        break;
      }
      case 'sinkStats': {
        const r = await client.query(SinkStatsHistoryQuery, vars).toPromise();
        if (r.error) throw new Error(r.error.message);
        points = (r.data?.sinkStatsHistory ?? []).map((p) => ({
          gameTimeId: p.gameTimeId,
          dataType,
          data: p.sinkStats,
        }));
        break;
      }
    }

    const latestId = points.length > 0 ? points[points.length - 1].gameTimeId : (since ?? 0);
    return { dataType, saveName, latestId, points };
  },

  listSaves: async (sessionId: string): Promise<ListHistorySavesResponse> => {
    const r = await client.query(HistorySavesQuery, { sessionId }).toPromise();
    if (r.error) throw new Error(r.error.message);
    const saveNames = r.data?.historySaves ?? [];
    return { saveNames, currentSave: saveNames[saveNames.length - 1] ?? '' };
  },
};
