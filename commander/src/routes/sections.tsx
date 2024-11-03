import { lazy, Suspense } from 'react';
import { Outlet, Navigate, useRoutes } from 'react-router-dom';

import Box from '@mui/material/Box';
import LinearProgress, { linearProgressClasses } from '@mui/material/LinearProgress';

import { varAlpha } from 'src/theme/styles';
import { DashboardLayout } from 'src/layouts/dashboard';

import PlayersPage from 'src/pages/players';
import PoductionPage from 'src/pages/production';
import PowerPage from 'src/pages/power';
import TrainsPage from 'src/pages/trains';
import DronesPage from 'src/pages/drones';
import SettingsPage from 'src/pages/settings';

// ----------------------------------------------------------------------

export const HomePage = lazy(() => import('src/pages/home'));
export const Page404 = lazy(() => import('src/pages/page-not-found'));

// ----------------------------------------------------------------------

const renderFallback = (
  <Box display="flex" alignItems="center" justifyContent="center" flex="1 1 auto">
    <LinearProgress
      sx={{
        width: 1,
        maxWidth: 320,
        bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
        [`& .${linearProgressClasses.bar}`]: { bgcolor: 'text.primary' },
      }}
    />
  </Box>
);

export function Router() {
  return useRoutes([
    {
      element: (
        <DashboardLayout>
          <Suspense fallback={renderFallback}>
            <Outlet />
          </Suspense>
        </DashboardLayout>
      ),
      children: [
        { element: <HomePage />, index: true },
        { path: 'production', element: <PoductionPage /> },
        { path: 'power', element: <PowerPage /> },
        { path: 'trains', element: <TrainsPage /> },
        { path: 'drones', element: <DronesPage /> },
        { path: 'players', element: <PlayersPage /> },
        { path: 'settings', element: <SettingsPage /> },
      ],
    },
    {
      path: '404',
      element: <Page404 />,
    },
    {
      path: '*',
      element: <Navigate to="/404" replace />,
    },
  ]);
}
