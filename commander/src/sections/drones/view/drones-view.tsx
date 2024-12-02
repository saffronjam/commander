import { DashboardContent } from 'src/layouts/dashboard';
import {
  useTheme,
  Grid2 as Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Backdrop,
  CircularProgress,
  Container,
  Divider,
} from '@mui/material';
import { useContextSelector } from 'use-context-selector';
import { ApiContext } from 'src/contexts/api/useApi';
import { varAlpha } from 'src/theme/styles';
import { fNumber } from 'src/utils/format-number';
import { Gauge } from 'src/sections/trains/gauge';

export function DronesView() {
  const api = useContextSelector(ApiContext, (v) => {
    return {
      drones: v.drones,
      droneStations: v.droneStations,
      isLoading: v.isLoading,
      isOnline: v.isOnline,
    };
  });
  const theme = useTheme();

  const avgSpeed = () => {
    if (api.drones.length === 0) return 0;
    return api.drones.reduce((acc, drone) => acc + drone.speed, 0) / api.drones.length;
  };
  const maxSpeed = () => 252;

  return (
    <>
      <Backdrop
        open={api.isLoading === true || !api.isOnline}
        sx={{
          color: theme.palette.primary.main,
          backgroundColor: varAlpha(theme.palette.background.defaultChannel, 0.5),
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>

      {!api.isLoading && api.isOnline && (
        <DashboardContent maxWidth="xl">
          <Container sx={{ paddingTop: '50px' }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h3">{api.drones.length}</Typography>
                    <Typography variant="inherit">Total Drones</Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">Drone Speed (Average)</Typography>

                    <Gauge value={(avgSpeed() / maxSpeed()) * 100} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2">Current</Typography>
                        <Typography variant="body1" sx={{ pl: 0.5, fontWeight: 'bold' }}>
                          {fNumber(avgSpeed(), { decimals: 0 })} km/h
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2">Max</Typography>
                        <Typography variant="body1" sx={{ pl: 0.5, fontWeight: 'bold' }}>
                          {fNumber(maxSpeed(), { decimals: 0 })} km/h
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Container>
        </DashboardContent>
      )}
    </>
  );
}
