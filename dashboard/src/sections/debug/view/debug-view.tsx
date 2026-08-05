import { Icon } from '@iconify/react';
import { Database } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConnectionStateOnline } from 'src/apiTypes';
import { CONFIG } from 'src/config-global';
import { ApiContext } from 'src/contexts/api/useApi';
import { useSession } from 'src/contexts/sessions';
import { useContextSelector } from 'use-context-selector';

const ARRAY_PAGE_SIZE = 100;

// ----------------------------------------------------------------------

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type ChangedPaths = Set<string>;

/**
 * Recursive JSON tree node component for rendering nested data structures.
 */
function JsonNode({
  name,
  value,
  path,
  changedPaths,
  defaultExpanded = false,
}: {
  name: string;
  value: JsonValue;
  path: string;
  changedPaths: ChangedPaths;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [visibleCount, setVisibleCount] = useState(ARRAY_PAGE_SIZE);
  const isChanged = changedPaths.has(path);

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const renderValue = () => {
    if (value === null) return <span className="text-muted-foreground">null</span>;
    if (typeof value === 'boolean')
      return <span className="text-blue-400">{value ? 'true' : 'false'}</span>;
    if (typeof value === 'number') return <span className="text-green-400">{value}</span>;
    if (typeof value === 'string') return <span className="text-orange-400">"{value}"</span>;
    return null;
  };

  const getPreview = () => {
    if (isArray) return `Array(${value.length})`;
    if (isObject) {
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      if (keys.length <= 3) return `{ ${keys.join(', ')} }`;
      return `{ ${keys.slice(0, 3).join(', ')}, ... }`;
    }
    return '';
  };

  const handleShowMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVisibleCount((prev) => prev + ARRAY_PAGE_SIZE);
  };

  const arrayValue = isArray ? (value as JsonValue[]) : [];
  const hasMoreItems = isArray && arrayValue.length > visibleCount;
  const remainingItems = isArray ? arrayValue.length - visibleCount : 0;

  return (
    <div className="font-mono text-[0.85rem]">
      <div
        className={`flex items-center py-1 px-1.5 rounded transition-colors duration-300 ${
          isChanged ? 'bg-yellow-500/30 my-0.5' : ''
        } ${isExpandable ? 'cursor-pointer hover:bg-accent' : ''}`}
        onClick={() => isExpandable && setExpanded(!expanded)}
      >
        {isExpandable && (
          <Icon
            icon={expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'}
            className="size-4 mr-1 text-muted-foreground shrink-0"
          />
        )}
        {!isExpandable && <div className="w-5" />}
        <span className="text-primary">{name}</span>
        <span className="text-muted-foreground mx-1">:</span>
        {isExpandable ? (
          <span className="text-muted-foreground/60">{getPreview()}</span>
        ) : (
          renderValue()
        )}
      </div>

      {isExpandable && expanded && (
        <div className="pl-4 border-l border-border ml-2">
          {isArray
            ? arrayValue
                .slice(0, visibleCount)
                .map((item, index) => (
                  <JsonNode
                    key={index}
                    name={`[${index}]`}
                    value={item}
                    path={`${path}[${index}]`}
                    changedPaths={changedPaths}
                  />
                ))
            : Object.entries(value as Record<string, JsonValue>).map(([key, val]) => (
                <JsonNode
                  key={key}
                  name={key}
                  value={val}
                  path={`${path}.${key}`}
                  changedPaths={changedPaths}
                />
              ))}
          {hasMoreItems && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShowMore}
              className="mt-1 py-0.5 px-2 h-auto text-xs text-muted-foreground"
            >
              <Icon icon="mdi:plus" className="size-3.5" />
              Show {Math.min(ARRAY_PAGE_SIZE, remainingItems)} more ({remainingItems} remaining)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Root data tree component that wraps JsonNode with change detection.
 */
function DataRoot({
  name,
  data,
  prevData,
  paused,
}: {
  name: string;
  data: JsonValue;
  prevData: JsonValue | undefined;
  paused: boolean;
}) {
  const [changedPaths, setChangedPaths] = useState<ChangedPaths>(new Set());
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const findChangedPaths = useCallback(
    (
      prev: JsonValue | undefined,
      curr: JsonValue,
      currentPath: string,
      changes: Set<string>
    ): Set<string> => {
      if (prev === undefined) return changes;

      if (typeof prev !== typeof curr) {
        changes.add(currentPath);
        return changes;
      }

      if (prev === null || curr === null) {
        if (prev !== curr) changes.add(currentPath);
        return changes;
      }

      if (typeof curr !== 'object') {
        if (prev !== curr) changes.add(currentPath);
        return changes;
      }

      if (Array.isArray(curr)) {
        const prevArr = prev as JsonValue[];
        if (prevArr.length !== curr.length) {
          changes.add(currentPath);
        }
        curr.forEach((item, idx) => {
          findChangedPaths(prevArr[idx], item, `${currentPath}[${idx}]`, changes);
        });
        return changes;
      }

      const prevObj = prev as Record<string, JsonValue>;
      const currObj = curr as Record<string, JsonValue>;
      const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(currObj)]);

      allKeys.forEach((key) => {
        if (!(key in prevObj) || !(key in currObj)) {
          changes.add(`${currentPath}.${key}`);
        } else {
          findChangedPaths(prevObj[key], currObj[key], `${currentPath}.${key}`, changes);
        }
      });

      return changes;
    },
    []
  );

  useEffect(() => {
    if (paused) return;

    const newChanges = findChangedPaths(prevData, data, name, new Set());

    if (newChanges.size > 0) {
      setChangedPaths((prev) => {
        const combined = new Set(prev);
        newChanges.forEach((p) => combined.add(p));
        return combined;
      });

      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }

      clearTimeoutRef.current = setTimeout(() => {
        setChangedPaths(new Set());
        clearTimeoutRef.current = null;
      }, 1000);
    }

    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, [data, prevData, paused, name, findChangedPaths]);

  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <div className="flex items-center mb-2 pb-2 border-b border-border">
          <Database className="size-5 mr-2 text-primary" />
          <span className="font-semibold">{name}</span>
          {changedPaths.size > 0 && (
            <Chip variant="warning" className="ml-2">
              {changedPaths.size} changes
            </Chip>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          <JsonNode
            name={name}
            value={data}
            path={name}
            changedPaths={changedPaths}
            defaultExpanded
          />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

/**
 * Main debug view component for inspecting live API data with change highlighting.
 */
export function DebugView() {
  const [paused, setPaused] = useState(false);
  const [pausedData, setPausedData] = useState<Record<string, JsonValue> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { selectedSession } = useSession();
  const isSessionOnline = selectedSession?.connectionState === ConnectionStateOnline;

  const api = useContextSelector(ApiContext, (v) => ({
    satisfactoryApiStatus: v.satisfactoryApiStatus,
    circuits: v.circuits,
    factoryStats: v.factoryStats,
    prodStats: v.prodStats,
    sinkStats: v.sinkStats,
    players: v.players,
    generatorStats: v.generatorStats,
    machines: v.machines,
    trains: v.trains,
    trainStations: v.trainStations,
    drones: v.drones,
    droneStations: v.droneStations,
    belts: v.belts,
    pipes: v.pipes,
    pipeJunctions: v.pipeJunctions,
    trainRails: v.trainRails,
    hypertubes: v.hypertubes,
    hypertubeEntrances: v.hypertubeEntrances,
    cables: v.cables,
    storages: v.storages,
    tractors: v.tractors,
    explorers: v.explorers,
    vehiclePaths: v.vehiclePaths,
    spaceElevator: v.spaceElevator,
    hub: v.hub,
    radarTowers: v.radarTowers,
    resourceNodes: v.resourceNodes,
    schematics: v.schematics,
    isLoading: v.isLoading,
  }));

  const prevDataRef = useRef<Record<string, JsonValue>>({});

  const currentData = useMemo(
    () => ({
      satisfactoryApiStatus: api.satisfactoryApiStatus as unknown as JsonValue,
      circuits: api.circuits as unknown as JsonValue,
      factoryStats: api.factoryStats as unknown as JsonValue,
      prodStats: api.prodStats as unknown as JsonValue,
      sinkStats: api.sinkStats as unknown as JsonValue,
      players: api.players as unknown as JsonValue,
      generatorStats: api.generatorStats as unknown as JsonValue,
      machines: api.machines as unknown as JsonValue,
      trains: api.trains as unknown as JsonValue,
      trainStations: api.trainStations as unknown as JsonValue,
      drones: api.drones as unknown as JsonValue,
      droneStations: api.droneStations as unknown as JsonValue,
      belts: api.belts as unknown as JsonValue,
      pipes: api.pipes as unknown as JsonValue,
      pipeJunctions: api.pipeJunctions as unknown as JsonValue,
      trainRails: api.trainRails as unknown as JsonValue,
      hypertubes: api.hypertubes as unknown as JsonValue,
      hypertubeEntrances: api.hypertubeEntrances as unknown as JsonValue,
      cables: api.cables as unknown as JsonValue,
      storages: api.storages as unknown as JsonValue,
      tractors: api.tractors as unknown as JsonValue,
      explorers: api.explorers as unknown as JsonValue,
      vehiclePaths: api.vehiclePaths as unknown as JsonValue,
      spaceElevator: api.spaceElevator as unknown as JsonValue,
      hub: api.hub as unknown as JsonValue,
      radarTowers: api.radarTowers as unknown as JsonValue,
      resourceNodes: api.resourceNodes as unknown as JsonValue,
      schematics: api.schematics as unknown as JsonValue,
    }),
    [api]
  );

  const displayData = paused && pausedData ? pausedData : currentData;

  const handlePauseToggle = useCallback(() => {
    if (!paused) {
      setPausedData(currentData);
    } else {
      setPausedData(null);
    }
    setPaused(!paused);
  }, [paused, currentData]);

  useEffect(() => {
    if (!paused) {
      const timer = setTimeout(() => {
        prevDataRef.current = { ...currentData };
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentData, paused]);

  const dataRoots = [
    { name: 'satisfactoryApiStatus', icon: 'mdi:api' },
    { name: 'circuits', icon: 'mdi:flash' },
    { name: 'factoryStats', icon: 'material-symbols:factory' },
    { name: 'prodStats', icon: 'mdi:chart-line' },
    { name: 'sinkStats', icon: 'mdi:inbox' },
    { name: 'players', icon: 'mdi:account-group' },
    { name: 'generatorStats', icon: 'mdi:lightning-bolt' },
    { name: 'machines', icon: 'mdi:factory' },
    { name: 'trains', icon: 'mdi:train' },
    { name: 'trainStations', icon: 'mdi:train-car' },
    { name: 'drones', icon: 'mdi:drone' },
    { name: 'droneStations', icon: 'mdi:drone' },
    { name: 'belts', icon: 'mdi:conveyor-belt' },
    { name: 'pipes', icon: 'mdi:pipe' },
    { name: 'pipeJunctions', icon: 'mdi:pipe-valve' },
    { name: 'trainRails', icon: 'mdi:railroad-light' },
    { name: 'hypertubes', icon: 'mdi:transit-connection-variant' },
    { name: 'hypertubeEntrances', icon: 'mdi:transit-transfer' },
    { name: 'cables', icon: 'mdi:cable-data' },
    { name: 'storages', icon: 'mdi:archive' },
    { name: 'tractors', icon: 'mdi:tractor' },
    { name: 'explorers', icon: 'mdi:car-outline' },
    { name: 'vehiclePaths', icon: 'mdi:road-variant' },
    { name: 'spaceElevator', icon: 'mdi:rocket-launch' },
    { name: 'hub', icon: 'material-symbols:house-rounded' },
    { name: 'radarTowers', icon: 'mdi:radar' },
    { name: 'resourceNodes', icon: 'tabler:pick' },
    { name: 'schematics', icon: 'mdi:bookmark-check' },
  ];

  const filteredDataRoots = useMemo(() => {
    if (!searchTerm.trim()) return dataRoots;
    const term = searchTerm.toLowerCase();
    return dataRoots.filter(({ name }) => name.toLowerCase().includes(term));
  }, [searchTerm]);

  return (
    <>
      <Helmet>
        <title> {`Debug - ${CONFIG.appName}`}</title>
      </Helmet>

      <div className="container max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold">Debug Data Viewer</h1>
            <p className="text-sm text-muted-foreground">
              Inspect live API data with change highlighting
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Icon
                icon="mdi:magnify"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              />
              <Input
                placeholder="Filter boxes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-8 w-48"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-6"
                  onClick={() => setSearchTerm('')}
                >
                  <Icon icon="mdi:close" className="size-3.5" />
                </Button>
              )}
            </div>
            <Chip variant={isSessionOnline ? 'success' : 'error'}>
              {isSessionOnline ? 'Online' : 'Offline'}
            </Chip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={paused ? 'secondary' : 'outline'}
                  size="icon"
                  onClick={handlePauseToggle}
                  className={paused ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : ''}
                >
                  <Icon icon={paused ? 'mdi:play' : 'mdi:pause'} className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{paused ? 'Resume updates' : 'Pause updates'}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {paused && (
          <Card className="mb-4 py-0 bg-yellow-600/20 border-yellow-600">
            <CardContent className="py-2 px-4">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:pause-circle" className="size-5 text-yellow-500" />
                <span className="text-sm">Updates paused - viewing frozen snapshot</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDataRoots.map(({ name }) => (
            <DataRoot
              key={name}
              name={name}
              data={displayData[name as keyof typeof displayData]}
              prevData={prevDataRef.current[name]}
              paused={paused}
            />
          ))}
        </div>
        {filteredDataRoots.length === 0 && searchTerm && (
          <div className="text-center py-8">
            <Icon icon="mdi:database-off" className="size-12 text-muted-foreground mb-2 mx-auto" />
            <p className="text-muted-foreground">No data sources match "{searchTerm}"</p>
          </div>
        )}
      </div>
    </>
  );
}
