import * as React from 'react';
import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  useTheme,
  Box,
  FormControlLabel,
  Checkbox,
  Tooltip,
  Typography,
  Backdrop,
  CircularProgress,
  Stack,
} from '@mui/material';
import { DashboardContent } from 'src/layouts/dashboard';
import { ApiContext, ApiContextType } from 'src/contexts/api/useApi';
import { varAlpha } from 'src/theme/styles';
import { useSettings } from 'src/hooks/use-settings';
import { Iconify } from 'src/components/iconify';
import { useContextSelector } from 'use-context-selector';
import {
  fNumber,
  fPercent,
  fShortenNumber,
  MetricUnits,
  PerMinuteMetricUnits,
} from 'src/utils/format-number';

type Column = {
  id:
    | 'icon'
    | 'name'
    | 'inventory'
    | 'production'
    | 'consumption'
    | 'production efficiency'
    | 'consumption efficiency';
  label: string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: number) => string;
  severity?: (value: number | string) => Severity;
  trend?: (row: any, history: any) => number;
};

enum Severity {
  none = 'none',
  awesome = 'awesome',
  ok = 'ok',
  unsatisfactory = 'unsatisfactory',
  poor = 'poor',
}

function calculateTrend(data: number[]): number {
  if (data.length < 2) {
    throw new Error('At least two data points are required to calculate a trend.');
  }

  const n = data.length;
  const xSum = data.reduce((sum, _, index) => sum + index, 0);
  const ySum = data.reduce((sum, value) => sum + value, 0);
  const xySum = data.reduce((sum, value, index) => sum + index * value, 0);
  const xSquaredSum = data.reduce((sum, _, index) => sum + index ** 2, 0);

  // Calculate the slope (m) of the line y = mx + b
  const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum ** 2);

  return slope;
}

const columns: readonly Column[] = [
  { id: 'icon', label: '', minWidth: 64, align: 'center' },
  { id: 'name', label: 'Name', minWidth: 100, align: 'left' },

  {
    id: 'inventory',
    label: 'Inventory',
    minWidth: 150,
    align: 'center',
    format: (value) => fShortenNumber(value, MetricUnits, { decimals: 2 }),
    severity: (_value: number | string) => Severity.none,
    trend: (row: any, history: ApiContextType['history']) => {
      if (history.length < 10) {
        return 0;
      }

      // Collect all values for the current item
      const itemProdHistory = history.map((dataPoint) =>
        dataPoint.prodStats.items.find((i) => i.name === row.name)
      );

      const itemProdHistoryCount = itemProdHistory
        .filter((item) => item !== undefined)
        .map((item) => item.count);

      // Calculate the trend
      return calculateTrend(itemProdHistoryCount) * itemProdHistory.length;
    },
  },
  {
    id: 'production',
    label: 'Production',
    minWidth: 150,
    align: 'center',
    format: (value: number) => `${fShortenNumber(value, PerMinuteMetricUnits, { decimals: 2 })}`,
    severity: (_value: number | string) => Severity.none,
    trend: (row: any, history: ApiContextType['history']) => {
      if (history.length < 10) {
        return 0;
      }

      // Collect all values for the current item
      const itemProdHistory = history.map((dataPoint) =>
        dataPoint.prodStats.items.find((i) => i.name === row.name)
      );

      const itemValues = itemProdHistory
        .map((item) => item?.producedPerMinute)
        .filter((item) => item !== undefined);

      // Calculate the trend
      return calculateTrend(itemValues) * itemProdHistory.length;
    },
  },
  {
    id: 'consumption',
    label: 'Consumption',
    minWidth: 150,
    align: 'center',
    format: (value: number) => `${fShortenNumber(value, PerMinuteMetricUnits, { decimals: 2 })}`,
    severity: (_value: number | string) => Severity.none,
    trend: (row: any, history: ApiContextType['history']) => {
      if (history.length < 10) {
        return 0;
      }

      // Collect all values for the current item
      const itemProdHistory = history.map((dataPoint) =>
        dataPoint.prodStats.items.find((i) => i.name === row.name)
      );

      const itemValues = itemProdHistory
        .map((item) => item?.consumedPerMinute)
        .filter((item) => item !== undefined);

      // Calculate the trend
      return calculateTrend(itemValues) * itemProdHistory.length;
    },
  },
  {
    id: 'production efficiency',
    label: 'Production Efficiency',
    minWidth: 100,
    align: 'center',
    format: (value: number) => `${Math.round(value * 100)}%`,
    severity: (value: number | string) => {
      if (typeof value === 'string') {
        return Severity.none;
      }

      if (value >= 0.9) {
        return Severity.awesome;
      }

      if (value >= 0.75) {
        return Severity.ok;
      }
      if (value >= 0.5) {
        return Severity.unsatisfactory;
      }
      return Severity.poor;
    },
  },
  {
    id: 'consumption efficiency',
    label: 'Consumption Efficiency',
    minWidth: 100,
    align: 'center',
    format: (value: number) => `${Math.round(value * 100)}%`,
    severity: (value: number | string) => {
      if (typeof value === 'string') {
        return Severity.none;
      }

      if (value >= 0.9) {
        return Severity.awesome;
      }

      if (value >= 0.75) {
        return Severity.ok;
      }
      if (value >= 0.5) {
        return Severity.unsatisfactory;
      }
      return Severity.poor;
    },
  },
];

const severityToStyle = (severity: Severity) => {
  switch (severity) {
    case Severity.awesome:
      return { label: 'Awesome', color: 'green' };
    case Severity.ok:
      return { label: 'OK', color: 'yellow' };
    case Severity.unsatisfactory:
      return { label: 'Unsatisfactory', color: 'orange' };
    case Severity.poor:
      return { label: 'Poor', color: 'red' };
    default:
      return { label: '', color: 'transparent' };
  }
};

export function ProductionView() {
  const api = useContextSelector(ApiContext, (v) => {
    return {
      prodStats: v.prodStats,
      isLoading: v.isLoading,
      isOnline: v.isOnline,
      history: v.history,
    };
  });
  const theme = useTheme();

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [sortColumn, setSortColumn] = React.useState<Column['id'] | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const { settings, saveSettings } = useSettings();

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleSort = (columnId: Column['id']) => {
    if (columnId === 'icon') return; // Skip sorting for the 'Icon' column
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const sortedRows = React.useMemo(() => {
    if (api.isLoading || !api.isOnline) {
      return [];
    }

    const rows =
      api.prodStats.items
        .filter((item) => settings.productionView.includeItems || item.minable)
        .filter((item) => settings.productionView.includeMinable || !item.minable)
        .map((item) => ({
          name: item.name,
          inventory: item.count,
          production: item.producedPerMinute,
          consumption: item.consumedPerMinute,
          'production efficiency': item.produceEfficiency,
          'consumption efficiency': item.consumeEfficiency,
        })) || [];

    if (sortColumn == 'icon') {
      return rows;
    }

    if (sortColumn) {
      rows.sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];
        const compareResult =
          typeof aValue === 'number' && typeof bValue === 'number'
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue));

        // If same, sort by name
        if (compareResult === 0) {
          return a.name.localeCompare(b.name);
        }
        return sortDirection === 'asc' ? compareResult : -compareResult;
      });
    }
    return rows;
  }, [api, sortColumn, sortDirection, settings.productionView.includeItems]);

  return (
    <>
      <Backdrop
        open={api.isLoading || !api.isOnline}
        sx={{
          color: theme.palette.primary.main,
          backgroundColor: varAlpha(theme.palette.background.defaultChannel, 0.5),
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>

      {!api.isLoading && api.isOnline && (
        <DashboardContent maxWidth="xl">
          <TableContainer
            sx={{
              backgroundColor: theme.palette.background.neutral,
              height: 'calc(100vh - 200px)',
              borderTopLeftRadius: 15,
              borderTopRightRadius: 15,
            }}
          >
            <Table stickyHeader aria-label="sticky table">
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.align}
                      style={{
                        minWidth: column.minWidth,
                        backgroundColor: theme.palette.primary.darker,
                        color: theme.palette.primary.contrastText,
                        cursor: column.id !== 'icon' ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (column.id !== 'icon') {
                          handleSort(column.id);
                        }
                      }}
                    >
                      <Typography
                        variant="overline"
                        sx={{
                          display: 'flex', // Set display to flex
                          alignItems: 'center', // Center vertically
                          justifyContent: column.align,

                          userSelect: 'none', // Prevent text selection
                          WebkitUserSelect: 'none', // For Safari
                          MozUserSelect: 'none', // For Firefox
                          msUserSelect: 'none', // For older IE versions
                        }}
                      >
                        {column.label}
                        {sortDirection === 'asc' ? (
                          <Iconify
                            icon="bi:caret-up-fill"
                            fontSize="small"
                            sx={{
                              ml: 0.5,
                              color: sortColumn === column.id ? 'white' : 'transparent',
                            }}
                          />
                        ) : (
                          <Iconify
                            icon="bi:caret-down-fill"
                            fontSize="small"
                            sx={{
                              ml: 0.5,
                              color: sortColumn === column.id ? 'white' : 'transparent',
                            }}
                          />
                        )}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRows
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, index) => {
                    return (
                      <TableRow
                        hover
                        role="checkbox"
                        tabIndex={-1}
                        key={row.name}
                        sx={{
                          backgroundColor:
                            index % 2 === 0
                              ? theme.palette.background.paper
                              : varAlpha(theme.palette.background.defaultChannel, 0.5),
                        }}
                      >
                        {columns.map((column) => {
                          if (column.id === 'icon') {
                            return (
                              <TableCell key={column.id} align={column.align}>
                                <div
                                  style={{
                                    marginLeft: '10px',
                                    width: '50px',
                                    height: '50px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <img
                                    src={`assets/images/satisfactory/64x64/${row.name}.png`}
                                    alt={row.name}
                                    style={{
                                      width: '50px',
                                      height: '50px',
                                    }}
                                  />
                                </div>
                              </TableCell>
                            );
                          }

                          const value = row[column.id];

                          const EndDecorator = () => {
                            const severity = column.severity
                              ? column.severity(value)
                              : Severity.none;
                            const severityStyle = severityToStyle(severity);

                            if (severity !== Severity.none) {
                              return (
                                <Tooltip title={severityStyle.label} arrow>
                                  <Box
                                    sx={{
                                      display: 'inline-block',
                                      width: '10px',
                                      height: '10px',
                                      borderRadius: '50%',
                                      backgroundColor: severityStyle.color,
                                      marginLeft: '0.5rem',
                                    }}
                                  />
                                </Tooltip>
                              );
                            }

                            if (settings.productionView.showTrend && typeof value === 'number') {
                              const trendValue = column.trend ? column.trend(row, api.history) : 0;

                              const color =
                                trendValue === 0 ? 'transparent' : trendValue > 0 ? 'green' : 'red';

                              return (
                                <Stack direction="row" spacing={0.3} sx={{ ml: 1 }}>
                                  <Iconify
                                    icon={
                                      settings.productionView.showTrend
                                        ? trendValue > 0
                                          ? 'bi:caret-up-fill'
                                          : 'bi:caret-down-fill'
                                        : ''
                                    }
                                    fontSize="small"
                                    sx={{ color: color }}
                                  />
                                  <Typography variant="caption" sx={{ color: color }}>
                                    {fShortenNumber(trendValue, MetricUnits, { decimals: 0 })}
                                  </Typography>
                                </Stack>
                              );
                            }

                            return (
                              <Box
                                sx={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  backgroundColor: severityStyle.color,
                                  marginLeft: '0.5rem',
                                }}
                              />
                            );
                          };

                          return (
                            <TableCell
                              key={column.id}
                              align={column.align}
                              style={{ color: theme.palette.primary.contrastText }}
                            >
                              <Box
                                display="flex"
                                alignItems="center"
                                justifyContent={column.align || 'flex-start'}
                              >
                                {column.format && typeof value === 'number'
                                  ? column.format(value)
                                  : value}
                                <EndDecorator />
                              </Box>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TableContainer>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              backgroundColor: theme.palette.background.neutral,
              color: theme.palette.primary.contrastText,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
            }}
          >
            <Box display="flex" alignItems="center" sx={{ marginLeft: '1rem' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.productionView.includeMinable}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'transparent', // Removes hover background color
                      },
                    }}
                  />
                }
                label="Minable"
                sx={{ color: 'white', marginRight: '1rem' }}
                onChange={(event: any) =>
                  saveSettings({
                    ...settings,
                    productionView: {
                      ...settings.productionView,
                      includeMinable: event.target.checked,
                    },
                  })
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.productionView.includeItems}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'transparent', // Removes hover background color
                      },
                    }}
                  />
                }
                label="Items"
                // No hover color
                sx={{ color: 'white', marginRight: '1rem' }}
                onChange={(event: any) =>
                  saveSettings({
                    ...settings,
                    productionView: {
                      ...settings.productionView,
                      includeItems: event.target.checked,
                    },
                  })
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.productionView.showTrend}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'transparent', // Removes hover background color
                      },
                    }}
                  />
                }
                label="Show Trend"
                // No hover color
                sx={{ color: 'white', marginRight: '1rem' }}
                onChange={(event: any) =>
                  saveSettings({
                    ...settings,
                    productionView: {
                      ...settings.productionView,
                      showTrend: event.target.checked,
                    },
                  })
                }
              />
            </Box>

            <TablePagination
              rowsPerPageOptions={[10, 25, 100]}
              component="div"
              count={sortedRows.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ color: 'white' }}
            />
          </Box>
        </DashboardContent>
      )}
    </>
  );
}
