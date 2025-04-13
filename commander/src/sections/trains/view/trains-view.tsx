import { DashboardContent } from 'src/layouts/dashboard';
import {
  Backdrop,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Grid2 as Grid,
  Typography,
  useTheme,
} from '@mui/material';
import { Gauge } from '../gauge';
import { TrainList } from '../train-list';
import { useContextSelector } from 'use-context-selector';
import { ApiContext } from 'src/contexts/api/useApi';
import { varAlpha } from 'src/theme/styles';
import { fNumber, fShortenNumber, MetricUnits, WattUnits } from 'src/utils/format-number';

export function TrainsView() {
  const api = useContextSelector(ApiContext, (v) => {
    return {
      trains: v.trains,
      trainStations: v.trainStations,
      isLoading: v.isLoading,
      isOnline: v.isOnline,
    };
  });
  const theme = useTheme();

  const totalPowerConsumption = () =>
    api.trains.reduce((acc, train) => acc + train.powerConsumption, 0);
  const maxPowerConsumption = () => 110 * api.trains.length;
  const avgSpeed = () => {
    if (api.trains.length === 0) return 0;
    return api.trains.reduce((acc, train) => acc + train.speed, 0) / api.trains.length;
  };
  const maxSpeed = () => 120;

  const totalCarried = () =>
    api.trains.reduce((acc, train) => {
      return (
        acc +
        train.vehicles.reduce((acc, vehicle) => {
          return (
            acc +
            vehicle.inventory.reduce((acc, item) => {
              return acc + item.count;
            }, 0)
          );
        }, 0)
      );
    }, 0);

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
                    <Typography variant="h3">{api.trains.length}</Typography>
                    <Typography variant="inherit">Total Trains</Typography>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="h3">
                      {fShortenNumber(totalCarried(), MetricUnits)}
                    </Typography>
                    <Typography variant="inherit">Total Carried</Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">Power Consumption</Typography>

                    <Gauge value={(totalPowerConsumption() / maxPowerConsumption()) * 100} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2">Current</Typography>
                        <Typography variant="body1" sx={{ pl: 0.5, fontWeight: 'bold' }}>
                          {fShortenNumber(totalPowerConsumption(), WattUnits, {
                            decimals: 1,
                            ensureConstantDecimals: true,
                          })}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2">Max</Typography>
                        <Typography variant="body1" sx={{ pl: 0.5, fontWeight: 'bold' }}>
                          {fShortenNumber(maxPowerConsumption(), WattUnits, { decimals: 2 })}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">Train Speed (Average)</Typography>

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
            <Divider sx={{ mb: '50px', mt: '35px' }} />
            <Typography variant="h4" sx={{ marginTop: '30px', marginBottom: '30px' }}>
              All Trains
            </Typography>
            <TrainList trains={api.trains} trainStations={api.trainStations} />
          </Container>
        </DashboardContent>
      )}
    </>
  );
}
