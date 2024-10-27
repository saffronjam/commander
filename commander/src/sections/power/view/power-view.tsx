import {
  Box,
  Card,
  CardContent,
  Container,
  Divider,
  Grid2 as Grid,
  Skeleton,
  Typography,
  useTheme,
} from '@mui/material';
import { useContext } from 'react';
import { DashboardContent } from 'src/layouts/dashboard';
import { ApiContext } from 'src/contexts/api/useApi';
import { CircuitCard } from '../circuit-card';
import { Circuit } from 'common/types';
import { fShortenNumber, WattHoursUnits, WattUnits } from 'src/utils/format-number';

export function PowerView() {
  const theme = useTheme();
  const api = useContext(ApiContext);

  const allCapacity = api.circuits.reduce((acc, circuit) => acc + circuit.capacity.total, 0);
  const allProduction = api.circuits.reduce((acc, circuit) => acc + circuit.production.total, 0);
  const allBatteryCapacity = api.circuits.reduce(
    (acc, circuit) => acc + circuit.battery.capacity,
    0
  );
  const anyFuseTriggered = api.circuits.some((circuit) => circuit.fuseTriggered);

  return (
    <DashboardContent maxWidth="xl">
      <Container sx={{ paddingTop: '50px' }}>
        <Grid container spacing={2} sx={{ marginBottom: '30px' }}>
          <Grid size={{ xs: 3 }}>
            <Card sx={{ padding: theme.spacing(2) }}>
              <Typography variant="h3">
                {api.isLoading || !api.isOnline ? (
                  <Skeleton
                    sx={{ marginBottom: '8px' }}
                    variant="rounded"
                    height={'30px'}
                    width={'80px'}
                  />
                ) : (
                  <>{fShortenNumber(allCapacity, WattUnits, { decimals: 0 })}</>
                )}
              </Typography>
              <Typography>Total Power Capacity</Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 3 }}>
            <Card sx={{ padding: theme.spacing(2) }}>
              <Typography variant="h3">
                {api.isLoading || !api.isOnline ? (
                  <Skeleton
                    sx={{ marginBottom: '8px' }}
                    variant="rounded"
                    height={'30px'}
                    width={'80px'}
                  />
                ) : (
                  <>{fShortenNumber(allProduction, WattUnits, { decimals: 0 })}</>
                )}
              </Typography>
              <Typography>Total Production</Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 3 }}>
            <Card sx={{ padding: theme.spacing(2) }}>
              <Typography variant="h3">
                {api.isLoading || !api.isOnline ? (
                  <Skeleton
                    sx={{ marginBottom: '8px' }}
                    variant="rounded"
                    height={'30px'}
                    width={'80px'}
                  />
                ) : (
                  <>{fShortenNumber(allBatteryCapacity, WattHoursUnits, { decimals: 0 })}</>
                )}
              </Typography>
              <Typography>Battery Capacity</Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 3 }}>
            {api.isLoading || !api.isOnline ? (
              <Skeleton
                sx={{
                  margin: '10px',
                  width: '100%',
                  borderRadius: '10px',
                  padding: theme.spacing(2),
                }}
                variant="rounded"
                height={'93px'}
              />
            ) : (
              <>
                {!anyFuseTriggered ? (
                  <Card
                    sx={{
                      backgroundColor: theme.palette.success.darker,
                      padding: theme.spacing(2),
                    }}
                  >
                    <Typography variant="h3">No Problems</Typography>
                    <Typography>Current Status</Typography>
                  </Card>
                ) : (
                  <Card
                    sx={{ backgroundColor: theme.palette.error.darker, padding: theme.spacing(2) }}
                  >
                    <Typography variant="h3">Fuse Triggered</Typography>
                    <Typography>Status</Typography>
                  </Card>
                )}
              </>
            )}
          </Grid>
        </Grid>
        <Divider sx={{ marginBottom: '50px' }} />
        <Typography variant="h4" sx={{ marginTop: '30px', marginBottom: '30px' }}>
          All Power Circuits
        </Typography>
        {!api.isLoading && api.isOnline ? (
          <>
            {api.circuits.map((circuit: Circuit, index: number) => {
              return (
                <CircuitCard
                  key={index}
                  circuit={circuit}
                  name={index == 0 ? 'Main' : `Power Circuit #${index}`}
                />
              );
            })}
          </>
        ) : (
          <>
            <Card sx={{ marginBottom: '30px', padding: '20px', opacity: 0.5 }}>
              <CardContent>
                <Grid container sx={{ marginBottom: '20px' }}>
                  <Grid size={{ xs: 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                      <Skeleton width={'80px'} />
                    </Box>
                  </Grid>
                  <Grid>
                    <Skeleton width={'120px'} />
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 3 }}>
                    <Card variant="outlined" sx={{ padding: theme.spacing(2) }}>
                      <Typography variant="h6">
                        <Skeleton width={'110px'} />
                      </Typography>
                      <Typography marginTop={'10px'} variant="body2">
                        Power Capacity
                      </Typography>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 3 }}>
                    <Card variant="outlined" sx={{ padding: theme.spacing(2) }}>
                      <Typography variant="h6">
                        <Skeleton width={'80px'} />
                      </Typography>
                      <Typography marginTop={'10px'} variant="body2">
                        Power Production
                      </Typography>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 3 }}>
                    <Card variant="outlined" sx={{ padding: theme.spacing(2) }}>
                      <Typography variant="h6">
                        <Skeleton width={'90px'} />
                      </Typography>
                      <Typography marginTop={'10px'} variant="body2">
                        Current consumption
                      </Typography>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 3 }}>
                    <Card variant="outlined" sx={{ padding: theme.spacing(2) }}>
                      <Typography variant="h6">
                        <Skeleton width={'80px'} />
                      </Typography>
                      <Typography marginTop={'10px'} variant="body2">
                        Max. Consumed
                      </Typography>
                    </Card>
                  </Grid>
                </Grid>

                <Grid container sx={{ marginTop: '30px' }}>
                  <Grid size={{ xs: 3 }}>
                    <Typography variant="h6">Battery</Typography>
                  </Grid>
                  <Grid>
                    <Skeleton width={'80px'} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </>
        )}
      </Container>
    </DashboardContent>
  );
}
