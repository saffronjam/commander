import type { CardProps } from '@mui/material/Card';
import type { ColorType } from 'src/theme/core/palette';
import type { ChartOptions } from 'src/components/chart';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import { useTheme } from '@mui/material/styles';

import { fNumber, fShortenNumber } from 'src/utils/format-number';
import { Chart, useChart } from 'src/components/chart';
import { bgGradient, varAlpha } from 'src/theme/styles';
import { Typography } from '@mui/material';

// ----------------------------------------------------------------------

type Props = CardProps & {
  title: string;
  total: number | string | number[];
  units?: string[];
  color?: ColorType;
  icon: React.ReactNode;
  chart: {
    series: number[];
    // If not provided, a [0, 1 ... n] will be used, where n is the length of the series
    categories?: string[];
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

  const chartColors = [varAlpha(theme.palette[color].mainChannel, 0.48)];

  const chartOptions = useChart({
    chart: { sparkline: { enabled: true } },
    colors: chartColors,
    xaxis: { categories: chart.categories || [...Array(chart.series.length).keys()] },
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
    stroke: {
      curve: 'smooth',
    },
    ...chart.options,
  });

  const formatNumber = (value: number, options?: { decimals?: number }) => {
    if (units) {
      return fShortenNumber(value, units, options);
    }
    return Math.round(value);
  };

  const genContent = (value: number | string | number[]) => {
    if (Array.isArray(value)) {
      // Return a box that has a | in between the two values
      if (Array.isArray(value) && value.length === 2) {
        // Format numbers
        const leftNumber = formatNumber(value[0], { decimals: 1 });
        const rightNumber = formatNumber(value[1], { decimals: 1 });

        return (
          <Box
            sx={{
              flexGrow: 1,
              minWidth: 112,
              display: 'flex',
              position: 'relative',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* Left number */}
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography sx={{ color: theme.palette.primary.contrastText, textAlign: 'right', mr: 2 }} variant="h5">
                {leftNumber}
              </Typography>
            </Box>

            {/* Separator in the center */}
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              <Typography variant="body2" sx={{ fontSize: 25 }}>
                |
              </Typography>
            </Box>

            {/* Right number */}
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography sx={{ color: theme.palette.primary.contrastText, textAlign: 'left', ml: 2 }} variant="h5">
                {rightNumber}
              </Typography>
            </Box>
          </Box>
        );
      }
    }

    if (typeof value === 'number') {
      return (
        <Box sx={{ flexGrow: 1, minWidth: 112, textAlign: 'center' }}>
          <Typography sx={{ color: theme.palette.primary.contrastText }} variant="h4">
            {formatNumber(value, { decimals: 1})}
          </Typography>
        </Box>
      );
    }

    if (typeof value === 'string') {
      const newLineSplit = value.split('\n');
      return (
        <Box sx={{ flexGrow: 1, minWidth: 112, color: theme.palette.primary.contrastText }}>
          {newLineSplit.map((line, index) => (
            <Box
              key={index}
              sx={{ typography: 'h4', fontFamily: "'DM Mono', 'Roboto Mono', monospace" }}
            >
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
        boxShadow: 0,
        p: 3,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column', // Ensure content stacks vertically
        justifyContent: 'space-between', // Space between chart and content
        ...sx,
      }}
      {...other}
    >
      <Box sx={{ width: 38, height: 38, my: 2, mb: 5, mx: 'auto' }}>{icon}</Box>

      {/* Main content area */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexGrow: 1,
          minHeight: 100,
        }}
      >
        <Box sx={{ mb: 1, typography: 'overline' }}>{title}</Box>

        {/* Bigger numbers and centered */}
        <Box
          sx={{
            typography: 'h2', // Making numbers bigger
            display: 'flex',
            justifyContent: 'center',
            width: '100%', // Ensure full width
          }}
        >
          {genContent(total)}
        </Box>
      </Box>

      {/* Wider chart at the bottom */}
      <Box sx={{ mt: 0, width: '100%' }}>
        {' '}
        {/* Add margin at the top */}
        <Chart
          type="line"
          series={[{ data: chart.series }]}
          options={chartOptions}
          width="100%"
          height={56}
        />
      </Box>
    </Card>
  );
}
