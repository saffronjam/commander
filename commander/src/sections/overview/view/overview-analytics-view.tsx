import { useContext } from 'react';

import Grid from '@mui/material/Unstable_Grid2';
import { Iconify } from 'src/components/iconify';

import { ApiContext } from 'src/contexts/api/useApi';
import { DashboardContent } from 'src/layouts/dashboard';

import { fShortenNumber } from 'src/utils/format-number';
import { AnalyticsWidgetSummary } from '../analytics-widget-summary';
import { AnalyticsEnergySources } from '../analytics-energy-sources';
import { AnalyticsCouponsProgress } from '../analytics-coupon-progress';

// ----------------------------------------------------------------------

export function OverviewAnalyticsView() {
  const apiContext = useContext(ApiContext);

  // "doingInitialFetch" is true when the data is being fetched for the first time
  // So we want to show a loading spinner in this case

  const renderLoading = () => <div>Loading...</div>;
  const mUnits = [ '', 'k', 'M', 'B', 'T' ];
  const wUnits = ['W', 'kW', 'MW', 'GW', 'TW', 'PW'];
  
  const totalEnergyProduced = apiContext?.circuits.reduce((acc, circuit) => acc + circuit.production.total, 0) || 0;
  const totalEnergyConsumed = apiContext?.circuits.reduce((acc, circuit) => acc + circuit.consumption.total, 0) || 0;

  const totalMinableProduced = apiContext?.prodStats.minableProducedPerMinute || 0;
  const totalMinableConsumed = apiContext?.prodStats.minableConsumedPerMinute || 0;

  const totalItemsProduced = apiContext?.prodStats.itemsProducedPerMinute || 0;
  const totalItemsConsumed = apiContext?.prodStats.itemsConsumedPerMinute || 0;

  const renderDashboard = () => (
    <DashboardContent maxWidth="xl">
      <Grid container spacing={3}>
        <Grid xs={12} sm={6} md={3}>
          <AnalyticsWidgetSummary
            title="Energy Consumption (P/C)"
            total={`${fShortenNumber(totalEnergyConsumed, wUnits, {ensureConstantDecimals: true})}\n${fShortenNumber(totalEnergyProduced, wUnits, {ensureConstantDecimals: true})}`}
            icon={<Iconify icon="bi:lightning-charge-fill" />}
            chart={{
              categories:
                apiContext?.history.map((data) => data.timestamp.toLocaleTimeString()) || [],
              series:
                apiContext?.history.map((data) =>
                  data.circuits.reduce((acc, circuit) => acc + circuit.consumption.total, 0)
                ) || [],
            }}
          />
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <AnalyticsWidgetSummary
            title="Mined Resources (P/C)"
            total={`${fShortenNumber(totalMinableProduced, mUnits, {ensureConstantDecimals: true})}\n${fShortenNumber(totalMinableConsumed, mUnits, {ensureConstantDecimals: true})}`}
            color="secondary"
            icon={<Iconify icon="bi:gem" />}
            chart={{
              categories:
                apiContext?.history.map((data) => data.timestamp.toLocaleTimeString()) || [],
              series: apiContext?.history.map((data) => data.prodStats.minableProducedPerMinute) || [],
            }}
          />
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <AnalyticsWidgetSummary
            title="Produced Resources (P/C)"
            total={`${fShortenNumber(totalItemsProduced, mUnits, {ensureConstantDecimals: true})}\n${fShortenNumber(totalItemsConsumed, mUnits, {ensureConstantDecimals: true})}`}
            color="info"
            icon={<Iconify icon="material-symbols:factory" />}
            chart={{
              categories:
                apiContext?.history.map((data) => data.timestamp.toLocaleTimeString()) || [],
              series: apiContext?.history.map((data) => data.prodStats.itemsProducedPerMinute) || [],
            }}
          />
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <AnalyticsWidgetSummary
            title="Resources Sunk"
            total={apiContext?.sinkStats.totalPoints || 0}
            color="warning"
            icon={<Iconify icon="hugeicons:black-hole-01" />}
            chart={{
              categories:
                apiContext?.history.map((data) => data.timestamp.toLocaleTimeString()) || [],
              series: apiContext?.history.map((data) => data.sinkStats.totalPoints) || [],
            }}
            units={['', 'k', 'M', 'B', 'T']}
          />
        </Grid>

        <Grid xs={12} md={6} lg={4}>
          <AnalyticsEnergySources
            title="Energy Sources"
            chart={{
              series: (() => {
                const data = [
                  {
                    label: 'Biomass',
                    value: apiContext?.generatorStats.sources.biomass?.totalProduction || 0,
                  },
                  {
                    label: 'Coal',
                    value: apiContext?.generatorStats.sources.coal?.totalProduction || 0,
                  },
                  {
                    label: 'Fuel',
                    value: apiContext?.generatorStats.sources.fuel?.totalProduction || 0,
                  },
                  {
                    label: 'Geothermal',
                    value: apiContext?.generatorStats.sources.geothermal?.totalProduction || 0,
                  },
                  {
                    label: 'Nuclear',
                    value: apiContext?.generatorStats.sources.nuclear?.totalProduction || 0,
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

        <Grid xs={12} md={6} lg={4}>
          <AnalyticsEnergySources
            title="Machine Efficiency"
            chart={{
              series: (() => {
                const data = [
                  {
                    label: 'Operating',
                    value: apiContext?.factoryStats.efficiency.machinesOperating || 0,
                  },
                  {
                    label: 'Idle',
                    value: apiContext?.factoryStats.efficiency.machinesIdle || 0,
                  },
                  {
                    label: 'Paused',
                    value: apiContext?.factoryStats.efficiency.machinesPaused || 0,
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

        <Grid xs={12} md={6} lg={4}>
          <AnalyticsCouponsProgress
            title="Coupon Progress"
            progress={apiContext?.sinkStats.nextCouponProgress || 0}
            available={apiContext?.sinkStats.coupons || 0}
          />
        </Grid>
      </Grid>
    </DashboardContent>
  );

  return apiContext?.isLoading ? renderLoading() : renderDashboard();
}
