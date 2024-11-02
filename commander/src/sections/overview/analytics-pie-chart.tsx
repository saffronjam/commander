import type { CardProps } from '@mui/material/Card';
import type { ChartOptions } from 'src/components/chart';

import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import CardHeader from '@mui/material/CardHeader';

import { fNumber } from 'src/utils/format-number';

import { Chart, useChart, ChartLegends } from 'src/components/chart';

// ----------------------------------------------------------------------

type Props = CardProps & {
  title?: string;
  subheader?: string;
  chart: {
    colors?: string[];
    series: {
      label: string;
      value: number;
    }[];
    options?: ChartOptions;
  };
};

export function AnalyticsPieChart({
  title,
  subheader,
  chart,
  color = 'primary',
  ...other
}: Props) {
  const theme = useTheme();

  const chartSeries = chart.series.map((item) => item.value);

  const chartColors = chart.colors ?? [
    theme.palette.primary.main,
    theme.palette.secondary.dark,
    theme.palette.primary.dark,
    theme.palette.secondary.main,
  ];

  const chartOptions = useChart({
    chart: {
      sparkline: { enabled: true },
      animations: {
        enabled: false, // Disables animation on updates
      },
    },
    colors: chartColors,
    labels: chart.series.map((item) => item.label),
    stroke: { width: 5, colors: [theme.palette.background.paper] },
    dataLabels: {
      enabled: true,
      style: { fontSize: '15' },
      textAnchor: 'start',
      dropShadow: { enabled: false },
    },
    tooltip: {
      y: {
        formatter: (value: number) => fNumber(value, { decimals: 0 }),
        title: { formatter: (seriesName: string) => `${seriesName}` },
      },
    },
    plotOptions: { pie: { expandOnClick: false, dataLabels: {offset: -20}, donut: { labels: { show: false } } } },
    ...chart.options,
  });

  return (
    <Card
      {...other}
      sx={{
        boxShadow: 0,
      }}
    >
      <CardHeader
        title={title}
        subheader={subheader}
        titleTypographyProps={{ variant: 'overline', fontSize: '16px' }}
      />

      <Chart
        type="pie"
        series={chartSeries}
        options={chartOptions}
        width={{ xs: 240, xl: 260 }}
        height={{ xs: 240, xl: 260 }}
        sx={{ my: 6, mx: 'auto' }}
      />

      <Divider sx={{ borderStyle: 'dashed' }} />

      <ChartLegends
        labels={chartOptions?.labels}
        colors={chartOptions?.colors}
        sx={{ p: 3, justifyContent: 'center' }}
      />
    </Card>
  );
}
