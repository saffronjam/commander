import { useTheme } from '@mui/material';
import GaugeComponent from 'react-gauge-component';

export function Gauge({ value }: { value: number }) {
  const theme = useTheme();
  return (
    <GaugeComponent
      value={value}
      type="radial"
      labels={{
        valueLabel: {
          hide: true,
        },
        tickLabels: {
          type: 'inner',
        },
      }}
      arc={{
        colorArray: [
          theme.palette.success.dark,
          theme.palette.warning.dark,
          theme.palette.error.dark,
        ],
        padding: 0.02,
        width: 0.3,
        subArcs: [{ limit: 40 }, { limit: 60 }, { limit: 70 }, {}, {}, {}, {}],
      }}
      pointer={{
        type: 'needle',
        elastic: true,
        animationDelay: 0,
        color: theme.palette.grey[400],
      }}
    />
  );
}
