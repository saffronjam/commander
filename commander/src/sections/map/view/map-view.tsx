import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CRS } from 'leaflet';
import { DashboardContent } from 'src/layouts/dashboard';
import { useContextSelector } from 'use-context-selector';
import { ApiContext } from 'src/contexts/api/useApi';
import { Backdrop, CircularProgress, useTheme } from '@mui/material';
import { varAlpha } from 'src/theme/styles';
import { Overlay } from '../overlay';
import { MapBounds } from '../bounds';

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

  return (
    <DashboardContent
      style={{
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
            borderRadius: '10px',
            backgroundColor: '#0e0e0e',
            border: '1px solid #1e1e1e',
            boxShadow: '0 0 15px rgba(0, 0, 0, 0.8)',
          }}
        >
          <TileLayer
            url="assets/images/satisfactory/map/1732184952/{z}/{x}/{y}.png"
            tileSize={256}
            minZoom={3}
            maxZoom={8}
            noWrap={true}
          />
          <Overlay machines={[...api.factoryStats.machines, ...api.generatorStats.machines]} />
        </MapContainer>
      )}
    </DashboardContent>
  );
}
