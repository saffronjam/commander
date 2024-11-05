import { Box, Card, CardContent, Chip, Stack, Typography, useTheme } from '@mui/material';
import { Train, TrainStation, TrainStatus } from 'common/src/types';
import { Iconify } from 'src/components/iconify';
import { varAlpha } from 'src/theme/styles';
import { fNumber } from 'src/utils/format-number';
import { abbreviations } from './abbreviations';

const TrainCard = ({ train }: { train: Train }) => {
  const theme = useTheme();

  const statusToStyle = (status: string) => {
    switch (status) {
      case TrainStatus.selfDriving:
        return {
          icon: <Iconify icon="mdi:train" />,
          label: 'Self Driving',
          backgroundColor: theme.palette.success.darkChannel,
          color: theme.palette.primary.contrastTextChannel,
          pulse: false,
        };
      case TrainStatus.manualDriving:
        return {
          icon: <Iconify icon="ri:steering-2-fill" />,
          label: 'Manual Driving',
          backgroundColor: theme.palette.warning.darkChannel,
          color: theme.palette.warning.contrastTextChannel,
          pulse: false,
        };
      case TrainStatus.docking:
        return {
          icon: <Iconify icon="game-icons:cargo-crate" />,
          label: 'Docking',
          backgroundColor: theme.palette.info.darkChannel,
          color: theme.palette.primary.contrastTextChannel,
          pulse: true,
        };
      case TrainStatus.derailed:
        return {
          icon: <Iconify icon="mdi:alert" />,
          label: 'Derailed',
          backgroundColor: theme.palette.error.darkChannel,
          color: theme.palette.primary.contrastTextChannel,
          pulse: false,
        };
      default:
        return {
          icon: <Iconify icon="ri:question-line" />,
          label: status,
          backgroundColor: theme.palette.info.darkChannel,
          color: theme.palette.primary.contrastTextChannel,
          pulse: false,
        };
    }
  };
  function parseTrainItems(trainName: string) {
    // Extract the item codes within the brackets using regex
    const match = trainName.match(/\[(.*?)\]/);
    if (!match) return [];

    // Split item codes by "/" and map each to its full item name using abbreviations
    const items = match[1]
      .replace(/,/g, '/')
      .split('/')
      .map((code) => abbreviations.get(code.trim().toLowerCase()))
      .filter((item) => item);

    return items as string[];
  }

  const style = statusToStyle(train.status);
  const items = parseTrainItems(train.name);

  return (
    <Card
      variant="outlined"
      sx={{
        marginBottom: '15px',
        padding: '20px',
        outline: style.label === 'Derailed' ? `2px solid ${theme.palette.error.dark}` : 'none',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
              <Stack direction="row" spacing={3}>
                <Typography variant="h4">{`${train.name}`}</Typography>
                <Stack direction="row" spacing={1}>
                  {items.map((item, index) => (
                    <Chip
                      key={index}
                      label={item}
                      sx={{ color: theme.palette.primary.contrastText }}
                      icon={
                        <img
                          src={`assets/images/satisfactory/64x64/${item}.png`}
                          alt={item}
                          width={25}
                        />
                      }
                    />
                  ))}
                </Stack>
              </Stack>
            </Stack>
          </Box>

          <Chip
            label={style.label}
            icon={style.icon}
            sx={{
              backgroundColor: varAlpha(style.backgroundColor),
              color: varAlpha(style.color),
              pl: 0.6,
              ...(style.pulse && {
                animation: 'pulse-animation 2s infinite ease-in-out',
                '@keyframes pulse-animation': {
                  '0%': {
                    opacity: 1,
                  },
                  '50%': {
                    opacity: 0.6,
                  },
                  '100%': {
                    opacity: 1,
                  },
                },
              }),
            }}
          />
        </Box>

        {/* Scrollable Timetable Node Graph with Rounded Scrollbar */}
        <Box
          sx={{
            overflowX: 'auto', // Enables horizontal scrolling
            marginY: 2,
            paddingY: 1,
            '&::-webkit-scrollbar': {
              height: '8px', // Scrollbar height for horizontal scroll
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'grey.500',
              borderRadius: '4px', // Rounds the scrollbar
            },
            '&::-webkit-scrollbar-thumb:hover': {
              backgroundColor: 'grey.700',
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              minWidth: '100%', // Ensures scrollable space is used
            }}
          >
            {train.timetable.map((stop, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: '200px', // Space between nodes
                  mb: 2,
                  position: 'relative',
                }}
              >
                {/* Station name directly above each circle */}
                <Typography variant="body2" sx={{ marginBottom: 1 }}>
                  {stop.station}
                </Typography>

                {/* Horizontal connecting line, positioned absolutely */}
                {index > 0 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '84%',
                      left: '-85px',
                      width: '170px',
                      height: '2px',
                      backgroundColor: 'grey.500',
                      zIndex: -1,
                    }}
                  />
                )}

                {/* Circular node */}
                <Box
                  sx={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: 'grey.700',
                    borderRadius: '50%', // Creates a circular "O" node
                  }}
                />
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', marginTop: 2 }}>
          <Typography variant="body2">Speed:</Typography>
          <Typography variant="h6" sx={{ pl: 0.5, fontWeight: 'bold' }}>
            {fNumber(train.speed, { decimals: 0 })} km/h
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export function TrainList({
  trains,
  trainStations,
}: {
  trains: Train[];
  trainStations: TrainStation[];
}) {
  return (
    <>
      {trains.map((train, index) => (
        <TrainCard key={index} train={train} />
      ))}
    </>
  );
}
