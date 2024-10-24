import { Box, useTheme } from '@mui/material';
import { Chart, ChartOptions, useChart } from 'src/components/chart';
import { fNumber } from 'src/utils/format-number';

type Props = {
  chart: {
    series: number[];
    categories: string[];
    options?: ChartOptions;
  };
};

export function HistoryChart({ chart, ...other }: Props) {
  const theme = useTheme();

  const chartColors = [theme.palette.secondary.dark];

  const chartOptions = useChart({
    chart: { sparkline: { enabled: true } },
    colors: chartColors,
    xaxis: { categories: chart.categories },
    markers: { size: 0, colors: chartColors, strokeColors: chartColors, strokeWidth: 0 },
    tooltip: {
      x: { show: true }, // Hide x-axis values in tooltip
      y: {
        formatter: (value: number) => fNumber(value), // Show y-axis values
        title: { formatter: () => '' },
      },
    },
    ...chart.options,
  });

  return (
    <Chart
      type="line"
      series={[{ data: chart.series }]}
      options={chartOptions}
      width="90%"
      height={56}
    />
  );
}
