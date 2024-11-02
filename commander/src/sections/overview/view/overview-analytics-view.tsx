import { Grid2 as Grid } from '@mui/material';
import { Iconify } from 'src/components/iconify';

import { ApiContext } from 'src/contexts/api/useApi';
import { DashboardContent } from 'src/layouts/dashboard';
import { varAlpha } from 'src/theme/styles';
import { Backdrop, CircularProgress, useTheme } from '@mui/material';

import { AnalyticsWidgetSummary } from '../analytics-widget-summary';
import { AnalyticsPieChart } from '../analytics-pie-chart';
import { AnalyticsCouponsProgress } from '../analytics-coupon-progress';
import { useContextSelector } from 'use-context-selector';

// ----------------------------------------------------------------------

export function OverviewAnalyticsView() {
  const api = useContextSelector(ApiContext, (v) => {
    return {
      circuits: v.circuits,
      prodStats: v.prodStats,
      sinkStats: v.sinkStats,
      generatorStats: v.generatorStats,
      factoryStats: v.factoryStats,
      history: v.history,
      isLoading: v.isLoading,
      isOnline: v.isOnline,
    };
  });
  const theme = useTheme();

  const mPerMinUnits = ['/min', 'k/min', 'M/min', 'B/min', 'T/min'];
  const wUnits = ['W', 'kW', 'MW', 'GW', 'TW', 'PW'];

  const totalEnergyProduced =
    api.circuits.reduce((acc, circuit) => acc + circuit.production.total, 0) || 0;
  const totalEnergyConsumed =
    api.circuits.reduce((acc, circuit) => acc + circuit.consumption.total, 0) || 0;

  const totalMinableProduced = api.prodStats.minableProducedPerMinute || 0;
  const totalMinableConsumed = api.prodStats.minableConsumedPerMinute || 0;

  const totalItemsProduced = api.prodStats.itemsProducedPerMinute || 0;
  const totalItemsConsumed = api.prodStats.itemsConsumedPerMinute || 0;

  return (
    <>
      <Backdrop
        open={!api || api.isLoading === true || !api.isOnline}
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
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <AnalyticsWidgetSummary
                title="Energy Consumption (P/C)"
                total={[totalEnergyProduced, totalEnergyConsumed]}
                icon={
                  <Iconify icon="bi:lightning-charge-fill" sx={{ width: '100%', height: '100%' }} />
                }
                chart={{
                  categories: api.history.map((data) => data.timestamp.toLocaleTimeString()) || [],
                  series:
                    api.history.map((data) =>
                      data.circuits.reduce((acc, circuit) => acc + circuit.consumption.total, 0)
                    ) || [],
                }}
                units={wUnits}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <AnalyticsWidgetSummary
                title="Mined Resources (P/C)"
                total={[totalMinableProduced, totalMinableConsumed]}
                color="secondary"
                icon={<Iconify icon="bi:gem" sx={{ width: '100%', height: '100%' }} />}
                chart={{
                  categories: api.history.map((data) => data.timestamp.toLocaleTimeString()) || [],
                  series: api.history.map((data) => data.prodStats.minableProducedPerMinute) || [],
                }}
                units={mPerMinUnits}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <AnalyticsWidgetSummary
                title="Produced Resources (P/C)"
                total={[totalItemsProduced, totalItemsConsumed]}
                color="info"
                icon={
                  <Iconify icon="material-symbols:factory" sx={{ width: '100%', height: '100%' }} />
                }
                chart={{
                  categories: api.history.map((data) => data.timestamp.toLocaleTimeString()) || [],
                  series: api.history.map((data) => data.prodStats.itemsProducedPerMinute) || [],
                }}
                units={mPerMinUnits}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <AnalyticsWidgetSummary
                title="Sink Points"
                total={api.sinkStats.totalPoints || 0}
                color="warning"
                icon={
                  <Iconify icon="hugeicons:black-hole-01" sx={{ width: '100%', height: '100%' }} />
                }
                chart={{
                  categories: api.history.map((data) => data.timestamp.toLocaleTimeString()) || [],
                  series: api.history.map((data) => data.sinkStats.totalPoints) || [],
                }}
                units={['', 'k', 'M', 'B', 'T']}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <AnalyticsPieChart
                title="Energy Sources"
                chart={{
                  series: (() => {
                    const data = [
                      {
                        label: 'Biomass',
                        value: api.generatorStats.sources.biomass?.totalProduction || 0,
                      },
                      {
                        label: 'Coal',
                        value: api.generatorStats.sources.coal?.totalProduction || 0,
                      },
                      {
                        label: 'Fuel',
                        value: api.generatorStats.sources.fuel?.totalProduction || 0,
                      },
                      {
                        label: 'Geothermal',
                        value: api.generatorStats.sources.geothermal?.totalProduction || 0,
                      },
                      {
                        label: 'Nuclear',
                        value: api.generatorStats.sources.nuclear?.totalProduction || 0,
                      },
                    ].filter((source) => source.value > 0);

                    if (data.length === 0) {
                      return [{ label: 'No data', value: 0 }];
                    }

                    return data;
                  })(),
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <AnalyticsPieChart
                title="Machine Efficiency"
                chart={{
                  series: (() => {
                    const data = [
                      {
                        label: 'Operating',
                        value: api.factoryStats.efficiency.machinesOperating || 0,
                      },
                      {
                        label: 'Idle',
                        value: api.factoryStats.efficiency.machinesIdle || 0,
                      },
                      {
                        label: 'Paused',
                        value: api.factoryStats.efficiency.machinesPaused || 0,
                      },
                    ].filter((source) => source.value > 0);

                    if (data.length === 0) {
                      return [{ label: 'No data', value: 0 }];
                    }

                    return data;
                  })(),
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <AnalyticsCouponsProgress
                title="Coupon Progress"
                progress={api.sinkStats.nextCouponProgress || 0}
                available={api.sinkStats.coupons || 0}
              />
            </Grid>
          </Grid>
        </DashboardContent>
      )}
    </>
  );
}
