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
} from '@mui/material';
import { DashboardContent } from 'src/layouts/dashboard';
import { ApiContext } from 'src/contexts/api/useApi';
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

                        // Apex chart
                        if (column.id === 'history') {
                          return (
                            <TableCell key={column.id} align={column.align}>
                              <HistoryChart chart={{ series: row.history, categories: [] }} />
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
          sx={{ color: theme.palette.primary.contrastText, backgroundColor: 'grey.700' }}
        />
      </DashboardContent>
    );
  };

  return apiContext?.isLoading ? renderLoading() : renderDashboard();
}
