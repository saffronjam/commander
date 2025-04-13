import {createContext} from 'use-context-selector';
import {
    Circuit,
    Drone,
    DroneStation,
    FactoryStats,
    GeneratorStats,
    Player,
    ProdStats,
    SinkStats,
    Train,
    TrainStation,
} from 'src/apiTypes';

export type ApiData = {
    isLoading: boolean;
    isOnline: boolean;

    circuits: Circuit[];
    factoryStats: FactoryStats;
    prodStats: ProdStats;
    sinkStats: SinkStats;
    players: Player[];
    generatorStats: GeneratorStats;
    trains: Train[];
    trainStations: TrainStation[];
    drones: Drone[];
    droneStations: DroneStation[];
};

export type ApiContextType = ApiData & {
    history: (ApiData & { timestamp: Date })[];
};

export const DefaultApiContext: ApiContextType = {
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
    drones: [],
    droneStations: [],

    history: [
        {
            timestamp: new Date(),
            circuits: [],
            factoryStats: {} as FactoryStats,
            prodStats: {} as ProdStats,
            sinkStats: {} as SinkStats,
            itemStats: [],
            players: [],
            generatorStats: {} as GeneratorStats,
            trains: [],
            trainStations: [],
            drones: [],
            droneStations: [],
        },
    ] as any,
};

export const ApiContext = createContext<ApiContextType>(DefaultApiContext);
