import type { CardProps } from '@mui/material/Card';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import { useTheme } from '@mui/material/styles';
import Divider from '@mui/material/Divider';
import { Chart } from 'src/components/chart';

// ----------------------------------------------------------------------

type Props = CardProps & {
  title?: string;
  subheader?: string;
  available: number;
  progress: number;
  color?: string;
};

export function AnalyticsCouponsProgress({
  title = 'Coupon Progress',
  subheader,
  available,
  progress,
  color = 'primary',
  ...other
}: Props) {
  const theme = useTheme();

  const chartOptions = {
    chart: {
      sparkline: { enabled: true },
    },
    colors: [theme.palette.primary.main],
    plotOptions: {
      radialBar: {
        hollow: {
          size: '80%',
          background: 'transparent',
          position: 'front' as any,
        },
        dataLabels: {
          name: {
            offsetY: 0,
            show: true,
            color: theme.palette.primary.contrastText,
            fontSize: '22px',
          },
          value: {
            offsetY: 10,
            show: true,
            color: theme.palette.primary.dark,
          },
        },
      },
    },

    labels: [`${Math.round(available)} Coupons`],
  };

  const chartSeries = [(progress * 100).toFixed(2)] as any;

  return (
    <Card
      {...other}
      sx={{
        boxShadow: 0
      }}
    >
      <CardHeader
        title={title}
        subheader={subheader}
        titleTypographyProps={{ variant: 'overline' }}
      />

      <Chart
        type="radialBar"
        series={chartSeries}
        options={chartOptions}
        height={{ xs: 240, xl: 265 }}
        sx={{ my: 10, mx: 'auto' }}
      />
    </Card>
  );
}
