import React, { useEffect } from 'react';
import { useSubscription } from 'urql';
import * as API from 'src/apiTypes';
import { connectionStateFromEnum, connectivityReasonFromEnum } from 'src/utils/session-offline';
import { ApiContext, ApiData, DefaultApiContext } from './useApi';
import {
  CircuitsChangedSub,
  FactoryStatsChangedSub,
  PlayersChangedSub,
  ProdStatsChangedSub,
  SatisfactoryApiStatusChangedSub,
  SessionUpdatedSub,
  SinkStatsChangedSub,
} from './live';
import * as V from './live_vehicles';
import * as I from './live_infra';
import * as W from './live_world';

interface ApiProviderProps {
  children: React.ReactNode;
  sessionId: string | null;
  sessionStage: API.SessionStage | null;
  onSessionUpdate?: (session: API.SessionDTO) => void;
}

/**
 * ApiProvider streams all live game state via GraphQL subscriptions (graphql-ws),
 * exposing the ApiContext shape the app consumes. Each per-domain subscription
 * forwards the latest snapshot first, then live deltas; results are mapped from
 * the GraphQL types to the app's domain types (enum case + Fuel + generatorStats
 * reconciled in the per-domain mappers).
 */
export const ApiProvider: React.FC<ApiProviderProps> = ({
  children,
  sessionId,
  sessionStage,
  onSessionUpdate,
}) => {
  const pause = !sessionId;
  const variables = { sessionId: sessionId ?? '' };
  const opts = { variables, pause };

  const [apiStatus] = useSubscription({ query: SatisfactoryApiStatusChangedSub, ...opts });
  const [circuits] = useSubscription({ query: CircuitsChangedSub, ...opts });
  const [factory] = useSubscription({ query: FactoryStatsChangedSub, ...opts });
  const [prod] = useSubscription({ query: ProdStatsChangedSub, ...opts });
  const [sink] = useSubscription({ query: SinkStatsChangedSub, ...opts });
  const [players] = useSubscription({ query: PlayersChangedSub, ...opts });
  const [sessionUpd] = useSubscription({ query: SessionUpdatedSub, ...opts });

  const [drones] = useSubscription({ query: V.DronesChangedSub, ...opts });
  const [droneStations] = useSubscription({ query: V.DroneStationsChangedSub, ...opts });
  const [trains] = useSubscription({ query: V.TrainsChangedSub, ...opts });
  const [trainStations] = useSubscription({ query: V.TrainStationsChangedSub, ...opts });
  const [trucks] = useSubscription({ query: V.TrucksChangedSub, ...opts });
  const [truckStations] = useSubscription({ query: V.TruckStationsChangedSub, ...opts });
  const [tractors] = useSubscription({ query: V.TractorsChangedSub, ...opts });
  const [explorers] = useSubscription({ query: V.ExplorersChangedSub, ...opts });
  const [vehiclePaths] = useSubscription({ query: V.VehiclePathsChangedSub, ...opts });

  const [machines] = useSubscription({ query: I.MachinesChangedSub, ...opts });
  const [storages] = useSubscription({ query: I.StoragesChangedSub, ...opts });
  const [belts] = useSubscription({ query: I.BeltsChangedSub, ...opts });
  const [splitterMergers] = useSubscription({ query: I.SplitterMergersChangedSub, ...opts });
  const [pipes] = useSubscription({ query: I.PipesChangedSub, ...opts });
  const [pipeJunctions] = useSubscription({ query: I.PipeJunctionsChangedSub, ...opts });
  const [cables] = useSubscription({ query: I.CablesChangedSub, ...opts });
  const [trainRails] = useSubscription({ query: I.TrainRailsChangedSub, ...opts });
  const [hypertubes] = useSubscription({ query: I.HypertubesChangedSub, ...opts });
  const [hypertubeEntrances] = useSubscription({ query: I.HypertubeEntrancesChangedSub, ...opts });

  const [spaceElevator] = useSubscription({ query: W.SpaceElevatorChangedSub, ...opts });
  const [hub] = useSubscription({ query: W.HubChangedSub, ...opts });
  const [radarTowers] = useSubscription({ query: W.RadarTowersChangedSub, ...opts });
  const [resourceNodes] = useSubscription({ query: W.ResourceNodesChangedSub, ...opts });
  const [schematics] = useSubscription({ query: W.SchematicsChangedSub, ...opts });
  const [generatorStats] = useSubscription({ query: W.GeneratorStatsChangedSub, ...opts });

  useEffect(() => {
    const s = (sessionUpd.data as { sessionUpdated?: Record<string, unknown> } | undefined)
      ?.sessionUpdated;
    if (s && onSessionUpdate) {
      onSessionUpdate({
        ...s,
        stage: s.stage === 'READY' ? 'ready' : 'init',
        connectionState: connectionStateFromEnum(s.connectionState),
        offlineReason: connectivityReasonFromEnum(s.offlineReason),
      } as unknown as API.SessionDTO);
    }
  }, [sessionUpd.data, onSessionUpdate]);

  const d = (r: { data?: unknown }) => r.data as Record<string, unknown> | undefined;

  const data: ApiData = {
    ...DefaultApiContext,
    isLoading: pause ? false : !circuits.data && sessionStage !== 'ready',
    isOnline:
      (d(apiStatus)?.satisfactoryApiStatusChanged as { running?: boolean })?.running ?? false,
    satisfactoryApiStatus: d(apiStatus)
      ?.satisfactoryApiStatusChanged as unknown as API.SatisfactoryApiStatus,
    circuits: (d(circuits)?.circuitsChanged ?? []) as unknown as API.Circuit[],
    factoryStats:
      (d(factory)?.factoryStatsChanged as unknown as API.FactoryStats) ??
      DefaultApiContext.factoryStats,
    prodStats:
      (d(prod)?.prodStatsChanged as unknown as API.ProdStats) ?? DefaultApiContext.prodStats,
    sinkStats:
      (d(sink)?.sinkStatsChanged as unknown as API.SinkStats) ?? DefaultApiContext.sinkStats,
    players: (d(players)?.playersChanged ?? []) as unknown as API.Player[],

    drones: d(drones)?.dronesChanged ? V.mapDrones_vehicles(d(drones)!.dronesChanged as never) : [],
    droneStations: d(droneStations)?.droneStationsChanged
      ? V.mapDroneStations_vehicles(d(droneStations)!.droneStationsChanged as never)
      : [],
    trains: d(trains)?.trainsChanged ? V.mapTrains_vehicles(d(trains)!.trainsChanged as never) : [],
    trainStations: d(trainStations)?.trainStationsChanged
      ? V.mapTrainStations_vehicles(d(trainStations)!.trainStationsChanged as never)
      : [],
    trucks: d(trucks)?.trucksChanged ? V.mapTrucks_vehicles(d(trucks)!.trucksChanged as never) : [],
    truckStations: d(truckStations)?.truckStationsChanged
      ? V.mapTruckStations_vehicles(d(truckStations)!.truckStationsChanged as never)
      : [],
    tractors: d(tractors)?.tractorsChanged
      ? V.mapTractors_vehicles(d(tractors)!.tractorsChanged as never)
      : [],
    explorers: d(explorers)?.explorersChanged
      ? V.mapExplorers_vehicles(d(explorers)!.explorersChanged as never)
      : [],
    vehiclePaths: d(vehiclePaths)?.vehiclePathsChanged
      ? V.mapVehiclePaths_vehicles(d(vehiclePaths)!.vehiclePathsChanged as never)
      : [],

    machines: d(machines)?.machinesChanged
      ? I.mapMachines_infra(d(machines)!.machinesChanged as never)
      : [],
    storages: d(storages)?.storagesChanged
      ? I.mapStorages_infra(d(storages)!.storagesChanged as never)
      : [],
    belts: d(belts)?.beltsChanged ? I.mapBelts_infra(d(belts)!.beltsChanged as never) : [],
    splitterMergers: d(splitterMergers)?.splitterMergersChanged
      ? I.mapSplitterMergers_infra(d(splitterMergers)!.splitterMergersChanged as never)
      : [],
    pipes: d(pipes)?.pipesChanged ? I.mapPipes_infra(d(pipes)!.pipesChanged as never) : [],
    pipeJunctions: d(pipeJunctions)?.pipeJunctionsChanged
      ? I.mapPipeJunctions_infra(d(pipeJunctions)!.pipeJunctionsChanged as never)
      : [],
    cables: d(cables)?.cablesChanged ? I.mapCables_infra(d(cables)!.cablesChanged as never) : [],
    trainRails: d(trainRails)?.trainRailsChanged
      ? I.mapTrainRails_infra(d(trainRails)!.trainRailsChanged as never)
      : [],
    hypertubes: d(hypertubes)?.hypertubesChanged
      ? I.mapHypertubes_infra(d(hypertubes)!.hypertubesChanged as never)
      : [],
    hypertubeEntrances: d(hypertubeEntrances)?.hypertubeEntrancesChanged
      ? I.mapHypertubeEntrances_infra(d(hypertubeEntrances)!.hypertubeEntrancesChanged as never)
      : [],

    spaceElevator: d(spaceElevator)?.spaceElevatorChanged
      ? W.mapSpaceElevator_world(d(spaceElevator)!.spaceElevatorChanged as never)
      : undefined,
    hub: d(hub)?.hubChanged ? W.mapHub_world(d(hub)!.hubChanged as never) : undefined,
    radarTowers: d(radarTowers)?.radarTowersChanged
      ? W.mapRadarTowers_world(d(radarTowers)!.radarTowersChanged as never)
      : [],
    resourceNodes: d(resourceNodes)?.resourceNodesChanged
      ? W.mapResourceNodes_world(d(resourceNodes)!.resourceNodesChanged as never)
      : [],
    schematics: d(schematics)?.schematicsChanged
      ? W.mapSchematics_world(d(schematics)!.schematicsChanged as never)
      : [],
    generatorStats: d(generatorStats)?.generatorStatsChanged
      ? W.mapGeneratorStats_world(d(generatorStats)!.generatorStatsChanged as never)
      : DefaultApiContext.generatorStats,
  };

  return <ApiContext.Provider value={data}>{children}</ApiContext.Provider>;
};
