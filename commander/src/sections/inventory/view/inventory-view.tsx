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
} from '@mui/material';
import { DashboardContent } from 'src/layouts/dashboard';
import { ApiContext } from 'src/contexts/api/useApi';
import { varAlpha } from 'src/theme/styles';
import { HistoryChart } from '../history-chart';

interface Column {
  id: 'icon' | 'name' | 'inventory' | 'history';
  label: string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: number) => string;
}

const columns: readonly Column[] = [
  { id: 'icon', label: '', minWidth: 64, align: 'center' },
  { id: 'name', label: 'Name', minWidth: 100 },
  {
    id: 'inventory',
    label: 'Inventory',
    format: (value) => Math.round(value).toString(),
    align: 'center',
  },
  { id: 'history', label: '', align: 'right' },
];

export function InventoryView() {
  const apiContext = React.useContext(ApiContext);
  const theme = useTheme();

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

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
      apiContext?.itemStats.map((item) => ({
        name: item.name,
        inventory:
          apiContext?.itemStats.find((inventory) => inventory.name === item.name)?.count || 0,
        history: apiContext?.history.map(
          (data) => data.itemStats.find((itemStat) => itemStat.name === item.name)?.count || 0
        ),
      })) || [];

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
                      backgroundColor: theme.palette.secondary.darker,
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

                        // Apex chart
                        if (column.id === 'history') {
                          return (
                            <TableCell key={column.id} align={column.align}>
                              {/* align middle */}
                              <Box sx={{ mr: 10, display: 'flex', justifyContent: 'center' }}>
                                <HistoryChart chart={{ series: row.history, categories: [] }} />
                              </Box>
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
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{
            backgroundColor: theme.palette.background.neutral,
            color: theme.palette.primary.contrastText,
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
          }}
        />
      </DashboardContent>
    );
  };

  return apiContext?.isLoading ? renderLoading() : renderDashboard();
}
