import { lazy, Suspense } from 'react';
import { Navigate, Outlet, useRoutes } from 'react-router-dom';

import { Spinner } from '@/components/ui/spinner';
import { AuthGuard } from '@/components/auth-guard/AuthGuard';
import { GuestGuard } from '@/components/auth-guard/GuestGuard';
import { DashboardLayout } from '@/layouts/dashboard';
import DebugPage from '@/pages/debug';
import DronesPage from '@/pages/drones';
import LoginPage from '@/pages/login';
import MapPage from '@/pages/map';
import MilestonesPage from '@/pages/milestones';
import PlayersPage from '@/pages/players';
import PowerPage from '@/pages/power';
import PoductionPage from '@/pages/production';
import SettingsPage from '@/pages/settings';
import TrainsPage from '@/pages/trains';

export const HomePage = lazy(() => import('@/pages/home'));
export const Page404 = lazy(() => import('@/pages/page-not-found'));

/**
 * Loading fallback component displayed while lazy-loaded pages are loading.
 * Shows a centered spinner indicator.
 */
const renderFallback = (
  <div className="flex flex-1 items-center justify-center">
    <Spinner className="size-8 text-muted-foreground" />
  </div>
);

/**
 * Main router component that defines all application routes.
 * Uses DashboardLayout for authenticated pages and SimpleLayout for standalone pages.
 */
export function Router() {
  return useRoutes([
    {
      path: 'login',
      element: (
        <GuestGuard>
          <LoginPage />
        </GuestGuard>
      ),
    },
    {
      element: (
        <AuthGuard>
          <DashboardLayout>
            <Suspense fallback={renderFallback}>
              <Outlet />
            </Suspense>
          </DashboardLayout>
        </AuthGuard>
      ),
      children: [
        { element: <HomePage />, index: true },
        { path: 'milestones', element: <MilestonesPage /> },
        { path: 'map', element: <MapPage /> },
        { path: 'production', element: <PoductionPage /> },
        { path: 'power', element: <PowerPage /> },
        { path: 'trains', element: <TrainsPage /> },
        { path: 'drones', element: <DronesPage /> },
        { path: 'players', element: <PlayersPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: 'debug', element: <DebugPage /> },
      ],
    },
    {
      path: '404',
      element: (
        <Suspense fallback={renderFallback}>
          <Page404 />
        </Suspense>
      ),
    },
    {
      path: '*',
      element: <Navigate to="/404" replace />,
    },
  ]);
}
