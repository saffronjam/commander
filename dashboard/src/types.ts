import {
  Belt,
  Cable,
  Drone,
  DroneStation,
  Explorer,
  Hub,
  Hypertube,
  Machine,
  Pipe,
  Player,
  RadarTower,
  SpaceElevator,
  Storage,
  Tractor,
  Train,
  TrainRail,
  TrainStation,
  Truck,
} from 'src/apiTypes';

/**
 * Represents any entity that can be selected on the map.
 * Used for universal selection across all visible layers.
 */
export type SelectableEntity =
  // Buildings
  | { type: 'machine'; data: Machine }
  | { type: 'storage'; data: Storage }
  // Special structures
  | { type: 'trainStation'; data: TrainStation }
  | { type: 'droneStation'; data: DroneStation }
  | { type: 'radarTower'; data: RadarTower }
  | { type: 'hub'; data: Hub }
  | { type: 'spaceElevator'; data: SpaceElevator }
  // Vehicles
  | { type: 'train'; data: Train }
  | { type: 'drone'; data: Drone }
  | { type: 'truck'; data: Truck }
  | { type: 'tractor'; data: Tractor }
  | { type: 'explorer'; data: Explorer }
  | { type: 'player'; data: Player }
  // Infrastructure
  | { type: 'belt'; data: Belt }
  | { type: 'pipe'; data: Pipe }
  | { type: 'cable'; data: Cable }
  | { type: 'rail'; data: TrainRail }
  | { type: 'hypertube'; data: Hypertube };

/**
 * Represents a multi-entity selection with aggregated statistics.
 * Used to populate the Selection tab in the map sidebar.
 */
export interface Selection {
  /** Unique identifier for this selection (for tab management) */
  id: string;

  /** The bounds of the selection rectangle (map coordinates) */
  bounds?: {
    start: { lat: number; lng: number };
    end: { lat: number; lng: number };
  };

  /** All selected entities by category */
  entities: {
    machines: Machine[];
    storages: Storage[];
    trainStations: TrainStation[];
    droneStations: DroneStation[];
    radarTowers: RadarTower[];
    hubs: Hub[];
    spaceElevators: SpaceElevator[];
    trains: Train[];
    drones: Drone[];
    trucks: Truck[];
    tractors: Tractor[];
    explorers: Explorer[];
    players: Player[];
    belts: Belt[];
    pipes: Pipe[];
    cables: Cable[];
    rails: TrainRail[];
    hypertubes: Hypertube[];
  };

  /** Total count of all selected entities */
  totalCount: number;

  /** Aggregated power statistics (computed) */
  power: {
    consumption: number;
    production: number;
  };

  /** Aggregated item statistics (computed) */
  items: {
    production: Record<string, number>;
    consumption: Record<string, number>;
  };

  /** Entity counts by type for Buildings sub-tab */
  buildingCounts: Record<string, number>;

  /** Aggregated inventory from all entities with storage (itemName -> total count) */
  inventory: Record<string, number>;

  /** Flags for which sub-tabs should be visible */
  hasItems: boolean;
  hasPower: boolean;
  hasVehicles: boolean;
  hasInventory: boolean;
}

/**
 * Predefined values for history data range in seconds.
 * -1 represents "all time" (no limit).
 */
export type HistoryDataRangePreset = 60 | 120 | 180 | 240 | 300 | 600 | 3600 | 28800 | -1;

/**
 * History data range configuration.
 * Either a predefined preset value or a custom number of seconds.
 * -1 indicates "all time" (fetch all available history).
 */
export type HistoryDataRange = HistoryDataRangePreset | number;

/**
 * Predefined values for history window size (data sampling interval) in seconds.
 * 0 represents "auto" mode where window size is calculated dynamically.
 */
export type HistoryWindowSizePreset = 0 | 1 | 5 | 10 | 30 | 60 | 300;

/**
 * History window size configuration for data downsampling.
 * 0 = Auto (dynamically calculated to target ~100 data points)
 * 1 = Raw (no downsampling)
 * Other values = fixed bucket size in seconds
 */
export type HistoryWindowSize = HistoryWindowSizePreset | number;

/**
 * User settings persisted to localStorage.
 */
export type Settings = {
  productionView: {
    includeMinable: boolean;
    includeItems: boolean;
    showTrend: boolean;
  };
  /** How much historical data to fetch and maintain in memory (in seconds). -1 for all time. */
  historyDataRange: HistoryDataRange;
  /** Data sampling window size in seconds. 0 = auto, 1 = raw, other = fixed bucket size. */
  historyWindowSize: HistoryWindowSize;
};

// Types for map selection
export type SelectedTrainStation = {
  station: TrainStation;
  dockedTrains: Train[];
};

export type SelectedDroneStation = {
  station: DroneStation;
  dockedDrones: Drone[];
};

// Grouped stations
export type TrainStationGroup = {
  stations: TrainStation[];
  center: { x: number; y: number };
};

export type DroneStationGroup = {
  stations: DroneStation[];
  center: { x: number; y: number };
};

export type SelectedMapItem =
  | { type: 'trainStation'; data: SelectedTrainStation }
  | { type: 'droneStation'; data: SelectedDroneStation }
  | { type: 'radarTower'; data: RadarTower }
  | { type: 'hub'; data: Hub }
  | { type: 'spaceElevator'; data: SpaceElevator }
  | { type: 'selection'; data: Selection };
