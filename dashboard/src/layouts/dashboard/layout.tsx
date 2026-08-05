'use client';

import { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { LogoutButton } from '@/components/logout-button';
import { AddSessionDialog } from '@/components/session-dialog';
import { SessionSelector } from '@/components/session-selector';
import { SessionInitOverlay } from '@/components/session-init-overlay';
import { SessionStatusBar } from '@/components/session-status-bar';
import { VersionDisplay } from '@/components/version-display/VersionDisplay';
import { WelcomeScreen } from '@/components/welcome';
import { useDebug } from '@/contexts/debug/DebugContext';
import { ConnectionStateOffline } from 'src/apiTypes';
import { useSession } from '@/contexts/sessions';

import { useNavData } from '../config-nav-dashboard';
import { DashboardHeader } from './header';
import { AppSidebar } from './sidebar';

export type DashboardLayoutProps = {
  children: React.ReactNode;
};

/**
 * Shown when the session list could not be read, so a transient failure is never
 * mistaken for a fresh instance with no sessions.
 */
function SessionsUnavailable({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Could not load your sessions</h1>
        <Alert variant="destructive" className="text-left">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">
          The dashboard could not reach its own API. Your sessions are safe.
        </p>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}

/**
 * Dashboard layout component that composes the sidebar, header, and content area.
 * Uses shadcn SidebarProvider for collapsible sidebar functionality.
 * Handles welcome screen display when no sessions exist.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const {
    sessions,
    selectedSession,
    isLoading: sessionsLoading,
    error: sessionsError,
    refreshSessions,
  } = useSession();
  const { isDebugMode } = useDebug();

  const [addSessionDialogOpen, setAddSessionDialogOpen] = useState(false);

  const navData = useNavData(isDebugMode);

  const hideHeader = location.pathname === '/map';

  // Decide nothing until the session list is known. Falling through to the
  // dashboard while loading renders it for a frame before the welcome screen
  // replaces it.
  if (sessionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  // A failed fetch is not an empty instance. Offering to "add your first
  // session" here would invite a duplicate of one that already exists.
  if (sessionsError) {
    return <SessionsUnavailable message={sessionsError} onRetry={() => void refreshSessions()} />;
  }

  if (sessions.length === 0) {
    return <WelcomeScreen />;
  }

  const sessionSelectorSlot = (
    <SessionSelector onAddSession={() => setAddSessionDialogOpen(true)} />
  );

  // Settings is rendered by the sidebar itself as a footer nav item; the version
  // sits last, below everything.
  const bottomSlot = (
    <>
      <LogoutButton />
      <VersionDisplay />
    </>
  );

  // Check if the status bar will be visible (session offline)
  const showStatusBar =
    !sessionsLoading && selectedSession?.connectionState === ConnectionStateOffline;

  return (
    <>
      <AddSessionDialog
        open={addSessionDialogOpen}
        onClose={() => setAddSessionDialogOpen(false)}
      />
      <div
        className="min-h-screen flex flex-col"
        style={
          {
            '--status-bar-height': showStatusBar ? '2.5rem' : '0px',
          } as React.CSSProperties
        }
      >
        <SidebarProvider className="flex-1">
          <AppSidebar
            data={navData}
            slots={{ topArea: sessionSelectorSlot, bottomArea: bottomSlot }}
          />
          <SidebarInset>
            {!hideHeader && <DashboardHeader />}
            <main
              className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--status-bar-height,0px))] md:p-6 md:pb-[calc(1.5rem+var(--status-bar-height,0px))]"
              data-scroll-container
            >
              {children}
            </main>
          </SidebarInset>
          <SessionInitOverlay />
        </SidebarProvider>
        <SessionStatusBar />
      </div>
    </>
  );
}
