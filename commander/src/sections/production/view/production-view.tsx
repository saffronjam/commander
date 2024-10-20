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
} from '@mui/material';
import { DashboardContent } from 'src/layouts/dashboard';
import { ApiContext } from 'src/contexts/api/useApi';

interface Column {
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
}

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
  const apiContext = React.useContext(ApiContext);
  const theme = useTheme();

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const [includeMinable, setIncludeMinable] = React.useState(false);
  const [includeItems, setIncludeItems] = React.useState(true);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const renderLoading = () => <div>Loading...</div>;
  const renderDashboard = () => {
    const rows =
      apiContext?.prodStats.items
        .filter((item) => {
          if (includeMinable && item.minable) {
            return true;
          }

          if (includeItems && !item.minable) {
            return true;
          }

          return false;
        })
        .map((item) => ({
          name: item.name,
          production: item.producedPerMinute,
          consumption: item.consumedPerMinute,
          'production efficiency': item.produceEfficiency,
          'consumption efficiency': item.consumeEfficiency,
        })) || [];

    return (
      <DashboardContent maxWidth="xl">
        <TableContainer
          // maxHeight=fill
          sx={{ height: 'calc(100vh - 200px)', backgroundColor: 'grey.800' }}
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
                      backgroundColor: theme.palette.primary.dark,
                      color: theme.palette.primary.contrastText,
                    }}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
                  return (
                    <TableRow
                      hover
                      role="checkbox"
                      tabIndex={-1}
                      key={row.name}
                      sx={{
                        backgroundColor: index % 2 === 0 ? 'grey.800' : 'grey.700', // Alternating row colors
                      }}
                    >
                      {columns.map((column) => {
                        if (column.id === 'icon') {
                          return (
                            <TableCell key={column.id} align={column.align}>
                              <img
                                src={`assets/images/satisfactory/64x64/${row.name}.png`}
                                alt={row.name}
                                style={{ width: '50px', height: '50px' }}
                              />
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
                                        column.severity &&
                                        column.severity(value) === severity.awesome
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
          sx={{ backgroundColor: 'grey.700', color: theme.palette.primary.contrastText }}
        >
          <Box display="flex" alignItems="center" sx={{ marginLeft: '1rem' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeMinable}
                  color="primary"
                  sx={{
                    '&:hover': {
                      backgroundColor: 'transparent', // Removes hover background color
                    },
                  }}
                />
              }
              label="Minable"
              sx={{ color: 'white', marginRight: '1rem' }}
              onChange={(event: any) => setIncludeMinable(event.target.checked)}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeItems}
                  color="primary"
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
              onChange={(event: any) => setIncludeItems(event.target.checked)}
            />
          </Box>

          <TablePagination
            rowsPerPageOptions={[10, 25, 100]}
            component="div"
            count={rows.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{ color: 'white' }}
          />
        </Box>
      </DashboardContent>
    );
  };

  return apiContext?.isLoading ? renderLoading() : renderDashboard();
}
