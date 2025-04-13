import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid2 as Grid,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { Circuit } from 'src/apiTypes';
import { Iconify } from 'src/components/iconify';
import { varAlpha } from 'src/theme/styles';
import { fPercent, fShortenNumber, WattHoursUnits, WattUnits } from 'src/utils/format-number';

export function CircuitCard({ circuit, name }: { circuit: Circuit; name: string }) {
  const theme = useTheme();

  // Battery time to full
  const secondsToFullyCharge = circuit.battery.untilFull;
  const fullyChargedIn = new Date(0, 0, 0, 0, 0, secondsToFullyCharge);
  const formatted = `${String(fullyChargedIn.getHours()).padStart(2, '0')}:${String(fullyChargedIn.getMinutes()).padStart(2, '0')}:${String(fullyChargedIn.getSeconds()).padStart(2, '0')}`;

  const hasBattery = circuit.battery.capacity > 0 || circuit.battery.untilFull > 0

  const getMaxConsumeColor = () => {
    const percentage = (circuit.consumption.max / circuit.production.total) * 100;
    if (percentage > 80) return theme.palette.warning.main;
    return theme.palette.success.main;
  };

  const getConsumeColor = () => {
    const percentage = (circuit.consumption.total / circuit.production.total) * 100;
    if (percentage > 100) return theme.palette.error.main;
    if (percentage > 80) return theme.palette.warning.main;
    return theme.palette.success.main;
  };

  const getProduction = () => {
    if (circuit.production.total === 0) return theme.palette.error.main;
    return theme.palette.success.main;
  };

  const getProductionCapacityColor = () => {
    if (circuit.capacity.total === 0) return theme.palette.error.main;
    return theme.palette.success.main;
  };

  const getBatteryPercentColor = () => {
    if (circuit.battery.percentage > 80) return theme.palette.success.main;
    if (circuit.battery.percentage > 50) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getBatteryDifferentialColor = () => {
    // If already full, the battery is not charging
    if (circuit.battery.percentage === 100) return theme.palette.success.main;

    // If positive, the battery is charging
    if (circuit.battery.differential > 0) return theme.palette.success.main;
    // If negative, the battery is discharging
    if (circuit.battery.differential < 0) return theme.palette.error.main;
    return theme.palette.warning.main;
  };

  const getBatteryCapacityColor = () => {
    if (circuit.battery.capacity === 0) return theme.palette.error.main;

    const hoursCovered = circuit.battery.capacity / circuit.consumption.total;
    if (hoursCovered > 10) return theme.palette.success.main;
    if (hoursCovered > 5) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  return (
    <Card
      variant="outlined"
      sx={{
        marginBottom: '30px',
        padding: '20px',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginRight: 2 }}>
            <Typography variant="h5">{name}</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {circuit.fuseTriggered && (
              <Chip
                variant="filled"
                sx={{
                  paddingLeft: '6px',
                  fontWeight: 'bold',
                  backgroundColor: varAlpha(theme.palette.error.darkerChannel, 1),
                  color: varAlpha(theme.palette.error.lighterChannel, 0.7),
                }}
                color="error"
                label="Fuse Triggered"
                icon={<Iconify icon="bi:exclamation-triangle" width="auto" height="auto" />}
              />
            )}

            {!hasBattery && (
              // Icon = exclamation mark
              <Chip
                sx={{ paddingLeft: '6px' }}
                variant="filled"
                label="No Battery connected"
                icon={
                  <Iconify icon="fluent:plug-disconnected-16-regular" width="auto" height="auto" />
                }
              />
            )}
          </Stack>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 3 }}>
            <Card
              variant="outlined"
              sx={{
                padding: theme.spacing(2),
                borderColor: getProductionCapacityColor(),
              }}
            >
              <Typography variant="h6">
                {fShortenNumber(circuit.capacity.total, WattUnits, { decimals: 3 })}
              </Typography>
              <Typography variant="body2">Power Capacity</Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 3 }}>
            <Card
              variant="outlined"
              sx={{
                padding: theme.spacing(2),
                borderColor: getProduction(),
              }}
            >
              <Typography variant="h6">
                {fShortenNumber(circuit.production.total, WattUnits, { decimals: 3 })}
              </Typography>
              <Typography variant="body2">Power Production</Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 3 }}>
            <Card
              variant="outlined"
              sx={{ padding: theme.spacing(2), borderColor: getConsumeColor() }}
            >
              <Typography variant="h6">
                {fShortenNumber(circuit.consumption.total, WattUnits, { decimals: 3 })}
              </Typography>
              <Typography variant="body2">Current Consumption</Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 3 }}>
            <Card
              variant="outlined"
              sx={{ padding: theme.spacing(2), borderColor: getMaxConsumeColor() }}
            >
              <Typography variant="h6">
                {fShortenNumber(circuit.consumption.max, WattUnits, { decimals: 3 })}
              </Typography>
              <Typography variant="body2">Max Consumption</Typography>
            </Card>
          </Grid>
        </Grid>

        {hasBattery && (
          <>
            <Grid container sx={{ marginTop: '30px' }}>
              <Grid size={{ xs: 3 }}>
                <Typography variant="h6">Battery</Typography>
              </Grid>
              <Grid></Grid>
            </Grid>
            <Grid container spacing={2} sx={{ marginTop: '20px' }}>
              <Grid size={{ xs: 3 }}>
                <Card
                  variant="outlined"
                  sx={{
                    padding: theme.spacing(2),
                    borderColor: hasBattery ? getBatteryCapacityColor() : '',
                  }}
                >
                  <Typography variant="h6">
                    {fShortenNumber(circuit.battery.capacity, WattHoursUnits, { decimals: 3 })}
                  </Typography>
                  <Typography variant="body2">Battery Capacity</Typography>
                </Card>
              </Grid>
              <Grid size={{ xs: 3 }}>
                <Card
                  variant="outlined"
                  sx={{
                    padding: theme.spacing(2),
                    borderColor: hasBattery ? getBatteryPercentColor() : '',
                  }}
                >
                  <Typography variant="h6">
                    {hasBattery
                      ? `${fPercent(circuit.battery.percentage, { decimals: 0 })} %`
                      : '-'}
                  </Typography>
                  <Typography variant="body2">Battery Percent</Typography>
                </Card>
              </Grid>
              <Grid size={{ xs: 3 }}>
                <Card
                  variant="outlined"
                  sx={{
                    padding: theme.spacing(2),
                    borderColor: hasBattery ? getBatteryDifferentialColor() : '',
                  }}
                >
                  <Typography variant="h6">
                    {hasBattery
                      ? fShortenNumber(circuit.battery.differential, WattUnits, { decimals: 3 })
                      : '-'}
                  </Typography>
                  <Typography variant="body2">Battery Differential</Typography>
                </Card>
              </Grid>
              <Grid size={{ xs: 3 }}>
                <Card variant="outlined" sx={{ padding: theme.spacing(2) }}>
                  <Typography variant="h6">{formatted}</Typography>
                  <Typography variant="body2">Battery Until Time</Typography>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
      </CardContent>
    </Card>
  );
}
