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
  Skeleton,
  Typography,
} from '@mui/material';
import { DashboardContent } from 'src/layouts/dashboard';
import { ApiContext } from 'src/contexts/api/useApi';
import { varAlpha } from 'src/theme/styles';
import { useSettings } from 'src/hooks/use-settings';
import { Iconify } from 'src/components/iconify';

type Column = {
  id:
    | 'icon'
    | 'name'
    | 'production'
    | 'consumption'
    | 'production efficiency'
    | 'consumption efficiency';
  label: string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: number) => string;
  severity?: (value: number | string) => severity;
};

enum severity {
  none = 'none',
  awesome = 'awesome',
  ok = 'ok',
  unsatisfactory = 'unsatisfactory',
  poor = 'poor',
}

const columns: readonly Column[] = [
  { id: 'icon', label: '', minWidth: 64, align: 'center' },
  { id: 'name', label: 'Name', minWidth: 170 },
  {
    id: 'production',
    label: 'Production',
    minWidth: 100,
    align: 'center',
    format: (value: number) => `${Math.round(value)}/min`,
    severity: (_value: number | string) => severity.none,
  },
  {
    id: 'consumption',
    label: 'Consumption',
    minWidth: 100,
    align: 'center',
    format: (value: number) => `${Math.round(value)}/min`,
    severity: (_value: number | string) => severity.none,
  },
  {
    id: 'production efficiency',
    label: 'Production Efficiency',
    minWidth: 100,
    align: 'center',
    format: (value: number) => `${Math.round(value * 100)}%`,
    severity: (value: number | string) => {
      if (typeof value === 'string') {
        return severity.none;
      }

      if (value >= 0.9) {
        return severity.awesome;
      }

      if (value >= 0.75) {
        return severity.ok;
      }
      if (value >= 0.5) {
        return severity.unsatisfactory;
      }
      return severity.poor;
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
        return severity.none;
      }

      if (value >= 0.9) {
        return severity.awesome;
      }

      if (value >= 0.75) {
        return severity.ok;
      }
      if (value >= 0.5) {
        return severity.unsatisfactory;
      }
      return severity.poor;
    },
  },
];

export function ProductionView() {
  const api = React.useContext(ApiContext);
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
    const rows =
      api?.prodStats.items
        .filter((item) => settings.productionView.includeItems || item.minable)
        .map((item) => ({
          name: item.name,
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
        return sortDirection === 'asc' ? compareResult : -compareResult;
      });
    }
    return rows;
  }, [api, sortColumn, sortDirection, settings.productionView.includeItems]);

  return (
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
                      return (
                        <TableCell
                          key={column.id}
                          align={column.align}
                          style={{ color: theme.palette.primary.contrastText }}
                        >
                          <>
                            {column.format && typeof value === 'number'
                              ? column.format(value)
                              : value}
                            {column.severity && (
                              <Tooltip
                                title={
                                  column.severity(value) === severity.awesome
                                    ? 'Awesome'
                                    : column.severity(value) === severity.ok
                                      ? 'OK'
                                      : column.severity(value) === severity.unsatisfactory
                                        ? 'Unsatisfactory'
                                        : column.severity(value) === severity.poor
                                          ? 'Poor'
                                          : ''
                                }
                                arrow
                              >
                                <Box
                                  sx={{
                                    display: 'inline-block',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor:
                                      column.severity && column.severity(value) === severity.awesome
                                        ? theme.palette.success.main
                                        : column.severity(value) === severity.ok
                                          ? theme.palette.info.main
                                          : column.severity(value) === severity.unsatisfactory
                                            ? theme.palette.warning.main
                                            : column.severity(value) === severity.poor
                                              ? theme.palette.error.main
                                              : 'transparent',
                                    marginLeft: '0.5rem',
                                  }}
                                />
                              </Tooltip>
                            )}
                          </>
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
  );
}
