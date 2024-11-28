import { Box, Divider, Typography, useTheme } from '@mui/material';
import { MachineGroup } from 'src/types';
import { fShortenNumber, MetricUnits, WattUnits } from 'src/utils/format-number';

export const SelectionSidebar = ({ machineGroup }: { machineGroup: MachineGroup | null }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: 400,
        height: '100%',
        backgroundColor: theme.palette.background.default,
        zIndex: 1,
        boxShadow: '0 0 15px rgba(0, 0, 0, 0.8)',
        borderRadius: '0 10px 10px 0',
        overflow: 'auto',
      }}
    >
      {/* selected machine group */}
      <Box sx={{ padding: 2 }}>
        {machineGroup ? (
          <Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 1,
              }}
            >
              <Box sx={{ fontWeight: 'bold' }}>Selected Group</Box>
              <Box sx={{ color: theme.palette.text.secondary, fontSize: 12 }}>
                {machineGroup.machines.length} machines
              </Box>
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 1,
              }}
            >
              <Box sx={{ color: theme.palette.text.secondary, fontSize: 12 }}>
                Power Consumption
              </Box>
              <Box sx={{ fontWeight: 'bold' }}>
                {machineGroup.powerConsumption
                  ? fShortenNumber(machineGroup.powerConsumption, WattUnits)
                  : '-'}
              </Box>
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 1,
              }}
            >
              <Box sx={{ color: theme.palette.text.secondary, fontSize: 12 }}>Power Production</Box>
              <Box sx={{ fontWeight: 'bold' }}>
                {machineGroup.powerProduction
                  ? fShortenNumber(machineGroup.powerProduction, WattUnits)
                  : '-'}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box>
            <Typography variant="h3" color="textSecondary">
              No group selected
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Click on a group to see details
            </Typography>
          </Box>
        )}

        {/* produced items */}
        {machineGroup && Object.entries(machineGroup.itemProduction).length > 0 && (
          <>
            <Divider sx={{ margin: '10px 0' }} />
            <Box sx={{ marginTop: 2 }}>
              <Box sx={{ fontWeight: 'bold', mb: 1 }}>Production</Box>
              {Object.entries(machineGroup.itemProduction).map(([name, value]) => (
                <Box
                  key={name}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <img
                      src={`assets/images/satisfactory/64x64/${name}.png`}
                      style={{
                        width: '24px',
                        height: '24px',
                      }}
                    />
                    <Box sx={{ color: theme.palette.text.secondary, fontSize: 12 }}>{name}</Box>
                  </Box>
                  <Box sx={{ fontWeight: 'bold' }}>
                    {fShortenNumber(value, MetricUnits, {
                      ensureConstantDecimals: true,
                      onlyDecimalsWhenDivisible: true,
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}

        {/* consumed items */}
        {machineGroup && Object.entries(machineGroup.itemConsumption).length > 0 && (
          <>
            <Divider sx={{ margin: '10px 0' }} />
            <Box sx={{ marginTop: 2 }}>
              <Box sx={{ fontWeight: 'bold', mb: 1 }}>Consumption</Box>
              {Object.entries(machineGroup.itemConsumption).map(([name, value]) => (
                <Box
                  key={name}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <img
                      src={`assets/images/satisfactory/64x64/${name}.png`}
                      style={{
                        width: '24px',
                        height: '24px',
                      }}
                    />
                    <Box sx={{ color: theme.palette.text.secondary, fontSize: 12 }}>{name}</Box>
                  </Box>
                  <Box sx={{ fontWeight: 'bold' }}>
                    {fShortenNumber(value, MetricUnits, {
                      ensureConstantDecimals: true,
                      onlyDecimalsWhenDivisible: true,
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};
