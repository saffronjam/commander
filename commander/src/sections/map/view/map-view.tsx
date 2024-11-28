import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CRS } from 'leaflet';
import { DashboardContent } from 'src/layouts/dashboard';
import { useContextSelector } from 'use-context-selector';
import { ApiContext } from 'src/contexts/api/useApi';
import { Backdrop, Box, CircularProgress, useTheme } from '@mui/material';
import { varAlpha } from 'src/theme/styles';
import { Overlay } from '../overlay';
import { MapBounds } from '../bounds';
import { MachineGroup } from 'src/types';
import { useEffect, useState } from 'react';
import { SelectionSidebar } from '../selectionSidebar';
import { computeMachineGroups, zoomToGroupDistance } from '../utils';

export function MapView() {
  const theme = useTheme();
  const api = useContextSelector(ApiContext, (v) => {
    return {
      factoryStats: v.factoryStats,
      generatorStats: v.generatorStats,
      isLoading: v.isLoading,
      isOnline: v.isOnline,
    };
  });
  const [machineGroups, setMachineGroups] = useState<MachineGroup[]>([]);
  const [activeMachineGroup, setActiveMachineGroup] = useState<MachineGroup | null>(null);
  const [zoom, setZoom] = useState(3);

  useEffect(() => {
    if (!api.isLoading && api.isOnline) {
      const machines = [...api.factoryStats.machines, ...api.generatorStats.machines];
      const groups = computeMachineGroups(machines, zoomToGroupDistance(zoom));
      setMachineGroups(groups);

      if (activeMachineGroup) {
        const newActiveGroup = groups.find((g) => g.hash === activeMachineGroup.hash);
        setActiveMachineGroup(newActiveGroup || null);
      }
    }
  }, [api.factoryStats, api.generatorStats, zoom]);

  const handleSelectMachineGroup = (group: MachineGroup | null) => {
    if (!group) {
      console.log('Unselected group');
    } else {
      console.log('Selected group:', group);
    }
    setActiveMachineGroup(group);
  };

  return (
    <DashboardContent
      style={{
        width: '100%',
        height: '90vh',
        marginLeft: 0,
      }}
    >
      <Backdrop
        open={api.isLoading || !api.isOnline}
        sx={{
          color: theme.palette.primary.main,
          backgroundColor: varAlpha(theme.palette.background.defaultChannel, 0.5),
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>

      {!api.isLoading && api.isOnline && (
        <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex' }}>
          {/* MapContainer */}
          <MapContainer
            center={[-80, 80]}
            maxBounds={MapBounds}
            crs={CRS.Simple}
            preferCanvas={true}
            attributionControl={false}
            zoom={3}
            minZoom={3}
            maxZoom={8}
            zoomDelta={0.25}
            zoomSnap={0.25}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '10px 0 0 10px',
              backgroundColor: '#0e0e0e',
              border: '1px solid #1e1e1e',
              boxShadow: '0 0 15px rgba(0, 0, 0, 0.8)',
              zIndex: 0,
            }}
          >
            <TileLayer
              url="assets/images/satisfactory/map/1732184952/{z}/{x}/{y}.png"
              tileSize={256}
              minZoom={3}
              maxZoom={8}
              noWrap={true}
            />
            <Overlay
              machineGroups={machineGroups}
              onSelectMachineGroup={handleSelectMachineGroup}
              onZoomEnd={setZoom}
            />
          </MapContainer>
          
          <SelectionSidebar machineGroup={activeMachineGroup} />
        </Box>
      )}
    </DashboardContent>
  );
}
