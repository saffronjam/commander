import type { DataPoint } from 'src/apiTypes';
import { mapGeneratorStats_world } from 'src/contexts/api/live_world';
import { graphql } from 'src/gql';
import { client } from 'src/gql/client';

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
  since?: number;
  /** Downsample to the last point per bucket. 0 or 1 means no downsampling. */
  bucketSeconds?: number;
}

/** A batch of historical data points, reshaped from a GraphQL history query */
export interface HistoryChunk {
  dataType: string;
  latestId: number;
  points: DataPoint[];
}

const CircuitsHistoryQuery = graphql(`
  query CircuitsHistory($sessionId: ID!, $since: Int, $bucketSeconds: Int) {
    circuitsHistory(sessionId: $sessionId, since: $since, bucketSeconds: $bucketSeconds) {
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
  query FactoryStatsHistory($sessionId: ID!, $since: Int, $bucketSeconds: Int) {
    factoryStatsHistory(sessionId: $sessionId, since: $since, bucketSeconds: $bucketSeconds) {
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
  query ProdStatsHistory($sessionId: ID!, $since: Int, $bucketSeconds: Int) {
    prodStatsHistory(sessionId: $sessionId, since: $since, bucketSeconds: $bucketSeconds) {
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
  query GeneratorStatsHistory($sessionId: ID!, $since: Int, $bucketSeconds: Int) {
    generatorStatsHistory(sessionId: $sessionId, since: $since, bucketSeconds: $bucketSeconds) {
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
  query SinkStatsHistory($sessionId: ID!, $since: Int, $bucketSeconds: Int) {
    sinkStatsHistory(sessionId: $sessionId, since: $since, bucketSeconds: $bucketSeconds) {
      gameTimeId
      sinkStats { totalPoints coupons nextCouponProgress pointsPerMinute }
    }
  }
`);

/**
 * History API service backed by the per-type GraphQL <domain>History queries.
 * Results are reshaped into the HistoryChunk { points: DataPoint[] } the charts
 * consume; the opaque DataPoint.data carries the typed payload.
 */
export const historyApi = {
  fetchHistory: async (params: FetchHistoryParams): Promise<HistoryChunk> => {
    const { sessionId, dataType, since, bucketSeconds } = params;
    const vars = {
      sessionId,
      since: since ?? null,
      bucketSeconds: bucketSeconds ?? null,
    };

    let points: DataPoint[] = [];

    switch (dataType) {
      case 'circuits': {
        const r = await client.query(CircuitsHistoryQuery, vars).toPromise();
        if (r.error) throw r.error;
        points = (r.data?.circuitsHistory ?? []).map((p) => ({
          gameTimeId: p.gameTimeId,
          dataType,
          data: p.circuits,
        }));
        break;
      }
      case 'factoryStats': {
        const r = await client.query(FactoryStatsHistoryQuery, vars).toPromise();
        if (r.error) throw r.error;
        points = (r.data?.factoryStatsHistory ?? []).map((p) => ({
          gameTimeId: p.gameTimeId,
          dataType,
          data: p.factoryStats,
        }));
        break;
      }
      case 'prodStats': {
        const r = await client.query(ProdStatsHistoryQuery, vars).toPromise();
        if (r.error) throw r.error;
        points = (r.data?.prodStatsHistory ?? []).map((p) => ({
          gameTimeId: p.gameTimeId,
          dataType,
          data: p.prodStats,
        }));
        break;
      }
      case 'generatorStats': {
        const r = await client.query(GeneratorStatsHistoryQuery, vars).toPromise();
        if (r.error) throw r.error;
        points = (r.data?.generatorStatsHistory ?? []).map((p) => ({
          gameTimeId: p.gameTimeId,
          dataType,
          data: mapGeneratorStats_world(p.generatorStats as never),
        }));
        break;
      }
      case 'sinkStats': {
        const r = await client.query(SinkStatsHistoryQuery, vars).toPromise();
        if (r.error) throw r.error;
        points = (r.data?.sinkStatsHistory ?? []).map((p) => ({
          gameTimeId: p.gameTimeId,
          dataType,
          data: p.sinkStats,
        }));
        break;
      }
    }

    const latestId = points.length > 0 ? points[points.length - 1].gameTimeId : (since ?? 0);
    return { dataType, latestId, points };
  },
};
