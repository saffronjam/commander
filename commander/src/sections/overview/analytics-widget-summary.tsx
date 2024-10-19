import type { CardProps } from '@mui/material/Card';
import type { ColorType } from 'src/theme/core/palette';
import type { ChartOptions } from 'src/components/chart';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import { useTheme } from '@mui/material/styles';

import { fNumber, fShortenNumber } from 'src/utils/format-number';
import { Chart, useChart } from 'src/components/chart';

// ----------------------------------------------------------------------

type Props = CardProps & {
  title: string;
  total: number | string;
  units?: string[];
  color?: ColorType;
  icon: React.ReactNode;
  chart: {
    series: number[];
    categories: string[];
    options?: ChartOptions;
  };
};

export function AnalyticsWidgetSummary({
  icon,
  title,
  total,
  chart,
  units,
  color = 'primary',
  sx,
  ...other
}: Props) {
  const theme = useTheme();

  const chartColors = [theme.palette[color].darker];

  const chartOptions = useChart({
    chart: { sparkline: { enabled: true } },
    colors: chartColors,
    xaxis: { categories: chart.categories },
    markers: { size: 0, colors: chartColors, strokeColors: chartColors, strokeWidth: 0 },
    grid: {
      padding: {
        top: 6,
        left: 6,
        right: 6,
        bottom: 6,
      },
    },
    tooltip: {
      y: { formatter: (value: number) => fNumber(value), title: { formatter: () => '' } },
    },
    ...chart.options,
  });

  const formatNumber = (value: number) => {
    if (units) {
      return fShortenNumber(value, units);
    }
    return Math.round(value);
  };

  const genContent = (value: number | string) => {
    if (typeof value === 'number') {
      return (
        <Box sx={{ flexGrow: 1, minWidth: 112 }}>
          <Box sx={{ typography: 'h4' }}>{formatNumber(value)}</Box>
        </Box>
      );
    }

    if (typeof value === 'string') {
      const newLineSplit = value.split('\n');
      return (
        <Box sx={{ flexGrow: 1, minWidth: 112 }}>
          {newLineSplit.map((line, index) => (
            // Monospace roboto
            <Box key={index} sx={{ typography: 'h4', fontFamily: "'DM Mono', 'Roboto Mono', monospace" }}>
              {line}
            </Box>
          ))}
        </Box>
      );
    }

    return <></>;
  };

  return (
    <Card
      sx={{
        p: 3,
        boxShadow: 'none',
        position: 'relative',
        color: `grey.900`,
        backgroundColor: `${color}.dark`,
        ...sx,
      }}
      {...other}
    >
      <Box sx={{ width: 48, height: 48, mb: 3 }}>{icon}</Box>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
        }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 112, minHeight: 100 }}>
          <Box sx={{ mb: 1, typography: 'subtitle2' }}>{title}</Box>

          <Box sx={{ typography: 'h4' }}>{genContent(total)}</Box>
        </Box>

        <Chart
          type="line"
          series={[{ data: chart.series }]}
          options={chartOptions}
          width={84}
          height={56}
        />
      </Box>
    </Card>
  );
}
