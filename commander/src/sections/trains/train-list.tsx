import { Box, Card, CardContent, Chip, Stack, Typography, useTheme } from '@mui/material';
import { Train, TrainStation, TrainStatus } from 'common/src/types';
import { Iconify } from 'src/components/iconify';
import { varAlpha } from 'src/theme/styles';
import { fNumber } from 'src/utils/format-number';
import { c } from 'vite/dist/node/types.d-aGj9QkWt';

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

  const parseName = (name: string) => {
    // Parse groups from train name
    // - [prefix] Train 1
    //
    // 'prefix' start with XXX, which is the group name, followed by a space, followed by some category name
    // 'category' can be "IM" for "import", "EX" for "export"

    // Example:
    // - [CPR IM] Train 1  -> CPR=copper -> group: "Copper", category: "Import"
    // - [CPR EX] Train 2  -> CPR=copper -> group: "Copper", category: "Export"
    // - [IRN IM] Train 3  -> IRN=iron -> group: "Iron", category: "Import"
    // - [IRN EX] Train 4  -> IRN=iron -> group: "Iron", category: "Export"
    // - [CNC IM] Train 5  -> CNC=concrete -> group: "Concrete", category: "Import"
    // - [CNC EX] Train 6  -> CNC=concrete -> group: "Concrete", category: "Export"

    const parsePrefix = (prefix: string) => {
      const [groupShort, category] = prefix.split(' ');

      const parseGroup = (groupShort: string) => {
        if (!groupShort) return undefined;

        groupShort = groupShort.toLowerCase();
        const groupMap = {
          cpr: 'Copper Ore',
          cop: 'Copper Ore',
          irn: 'Iron Ore',
          iro: 'Iron Ore',
          cnc: 'Concrete',
          con: 'Concrete',
          lms: 'Limestone',
          lim: 'Limestone',
          oil: 'Crude Oil',
          wtr: 'Water',
          h2o: 'Water',
          wat: 'Water',
          sul: 'Sulfur',
          sfr: 'Sulfur',
          cat: 'Caterium Ore',
          ctm: 'Caterium Ore',
          qrz: 'Raw Quartz',
          qtz: 'Raw Quartz',
          qua: 'Raw Quartz',
          bxt: 'Bauxite',
          bau: 'Bauxite',
          sua: 'Sulfuric Acid',
          sfa: 'Sulfuric Acid',
          nit: 'Nitrogen',
          ntr: 'Nitrogen',
          col: 'Coal',
          plt: 'Plastic',
          pls: 'Plastic',
          pla: 'Plastic',
          rbr: 'Rubber',
          rub: 'Rubber',
          stl: 'Steel',
          ste: 'Steel',
          alu: 'Aluminum',
          slt: 'Silica',
        };
        return groupShort in groupMap ? groupMap[groupShort as keyof typeof groupMap] : groupShort;
      };

      const parseCategory = (category: string) => {
        if (!category) return undefined;

        category = category.toLowerCase();
        const categoryMap = {
          im: 'Import',
          ex: 'Export',
          mi: 'Mined',
        };
        return category in categoryMap
          ? categoryMap[category as keyof typeof categoryMap]
          : category;
      };

      return {
        group: parseGroup(groupShort),
        category: parseCategory(category),
      };
    };

    const prefix = name.match(/\[(.*?)\]/);
    let trainName = name.replace(/\[(.*?)\]/, '').trim();

    const { group, category } = prefix
      ? parsePrefix(prefix[1])
      : { group: undefined, category: undefined };

    // If trainName is only numbers (e.g. "1", "22", "333"), prepend "Train" to the name
    if (/^\d+$/.test(trainName.replace(/\s/g, ''))) {
      trainName = `Train ${trainName}`;
    }

    return {
      group,
      category,
      trainName,
    };
  };

  const style = statusToStyle(train.status);

  const { group, category, trainName } = parseName(train.name);

  const ChipIcon = ({ group }: { group: string }) => {
    return (
      <img
        src={`assets/images/satisfactory/64x64/${group}.png`}
        alt={group}
        style={{
          height: 50,
        }}
      />
    );
  };

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
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {group && <ChipIcon group={group} />}
              <Typography variant="h4">{`${train.name}`}</Typography>
              <Stack direction="row" spacing={1}>
                {group && <Chip label={group} />}
                {category && <Chip label={category} />}
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
                      left: '-80px',
                      width: '160px',
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
