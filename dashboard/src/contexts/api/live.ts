import { graphql } from 'src/gql';

// Core live-domain subscription documents. Field selections use the GraphQL
// SCHEMA field names (api/schema.graphql). Enum-heavy domains (vehicles, infra,
// world) are added incrementally with their case-reconciling mappers.

export const SatisfactoryApiStatusChangedSub = graphql(`
  subscription SatisfactoryApiStatusChanged($sessionId: ID!) {
    satisfactoryApiStatusChanged(sessionId: $sessionId) {
      running
      pingMs
    }
  }
`);

export const CircuitsChangedSub = graphql(`
  subscription CircuitsChanged($sessionId: ID!) {
    circuitsChanged(sessionId: $sessionId) {
      id
      fuseTriggered
      consumption {
        total
        max
      }
      production {
        total
      }
      capacity {
        total
      }
      battery {
        percentage
        capacity
        differential
        untilFull
        untilEmpty
      }
    }
  }
`);

export const FactoryStatsChangedSub = graphql(`
  subscription FactoryStatsChanged($sessionId: ID!) {
    factoryStatsChanged(sessionId: $sessionId) {
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
`);

export const ProdStatsChangedSub = graphql(`
  subscription ProdStatsChanged($sessionId: ID!) {
    prodStatsChanged(sessionId: $sessionId) {
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
`);

export const SinkStatsChangedSub = graphql(`
  subscription SinkStatsChanged($sessionId: ID!) {
    sinkStatsChanged(sessionId: $sessionId) {
      totalPoints
      coupons
      nextCouponProgress
      pointsPerMinute
    }
  }
`);

export const PlayersChangedSub = graphql(`
  subscription PlayersChanged($sessionId: ID!) {
    playersChanged(sessionId: $sessionId) {
      id
      name
      health
      items {
        name
        count
      }
      x
      y
      z
      rotation
    }
  }
`);

export const SessionUpdatedSub = graphql(`
  subscription SessionUpdated($sessionId: ID!) {
    sessionUpdated(sessionId: $sessionId) {
      id
      name
      address
      saveName
      isPaused
      createdAt
      connectionState
      stage
      offlineReason
      mismatchedSaveName
    }
  }
`);
