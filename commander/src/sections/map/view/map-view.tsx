import { MapContainer, ImageOverlay, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CRS, LatLngBounds } from 'leaflet';
import { DashboardContent } from 'src/layouts/dashboard';
import { useContextSelector } from 'use-context-selector';
import { ApiContext } from 'src/contexts/api/useApi';
import { Backdrop, CircularProgress, useTheme } from '@mui/material';
import { varAlpha } from 'src/theme/styles';

// Bounds found at https://satisfactory.fandom.com/wiki/World
const bounds = new LatLngBounds([-324, -375], [425, 375]);

export function MapView() {
  const theme = useTheme();
  const api = useContextSelector(ApiContext, (v) => {
    return {
      factoryStats: v.factoryStats,
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
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '10px',
            backgroundColor: '#0e0e0e',
            border: '1px solid #1e1e1e',
            boxShadow: '0 0 15px rgba(0, 0, 0, 0.8)',
          }}
          crs={CRS.Simple}
          bounds={bounds}
          attributionControl={false}
          maxZoom={7}
        >
          <ImageOverlay url="assets/images/satisfactory/map-light.png" bounds={bounds} />
          {/* Add points and custom interaction components here */}
          {api.factoryStats.machines.map((machine) => {
            const key = `${machine.location.x}-${machine.location.y}`;
            return (
              <Marker key={key} position={[machine.location.x, machine.location.y]}>
                {/* Add custom machine component here */}
              </Marker>
            );
          })}
        </MapContainer>
      )}
    </DashboardContent>
  );
}
