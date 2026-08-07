import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionDTO, SessionInfo } from 'src/apiTypes';
import { useAuth } from 'src/contexts/auth/useAuth';
import { sessionApi } from 'src/services/sessionApi';
import { SessionContext, SessionContextType } from './SessionContext';

const SELECTED_SESSION_KEY = 'satisfactory-dashboard-selected-session';
const SESSION_POLL_INTERVAL = 20000; // Poll session status every 20 seconds

interface SessionProviderProps {
  children: React.ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const { authenticated, isLoading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(() =>
    localStorage.getItem(SELECTED_SESSION_KEY)
  );
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The session list is only readable once the caller is authorized, so treat
  // anything before the first successful fetch as still loading. Reporting an
  // empty list too early makes the dashboard claim there are no sessions.
  const isLoading = authLoading || !authenticated || !hasLoaded;

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  const refreshSessions = useCallback(async () => {
    try {
      setError(null);
      const fetchedSessions = await sessionApi.list();
      setSessions(fetchedSessions);

      // If we have a selected session ID but it's not in the list, clear it
      if (selectedSessionId && !fetchedSessions.find((s) => s.id === selectedSessionId)) {
        setSelectedSessionId(null);
        localStorage.removeItem(SELECTED_SESSION_KEY);
      }

      // Auto-select first session if none selected and sessions exist
      if (!selectedSessionId && fetchedSessions.length > 0) {
        const firstSession = fetchedSessions[0];
        setSelectedSessionId(firstSession.id);
        localStorage.setItem(SELECTED_SESSION_KEY, firstSession.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setHasLoaded(true);
    }
  }, [selectedSessionId]);

  // Silently refresh session statuses without affecting loading state or selection
  const refreshSessionStatuses = useCallback(async () => {
    try {
      const fetchedSessions = await sessionApi.list();
      setSessions((prev) => {
        // Only the runtime fields move; the pinned save name never does.
        return prev.map((session) => {
          const updated = fetchedSessions.find((s) => s.id === session.id);
          if (updated) {
            return {
              ...session,
              connectionState: updated.connectionState,
              offlineReason: updated.offlineReason,
              mismatchedSaveName: updated.mismatchedSaveName,
              stage: updated.stage,
            };
          }
          return session;
        });
      });
    } catch {
      // Silently fail - don't update error state for background polling
    }
  }, []);

  // Load once the caller is authorized, and again whenever that flips — logging
  // in must not leave the list stuck on whatever the unauthorized attempt saw.
  useEffect(() => {
    if (!authenticated) {
      setHasLoaded(false);
      setSessions([]);
      return;
    }
    void refreshSessions();
    // refreshSessions is intentionally omitted: it changes with the selected
    // session, and re-running on selection would refetch on every switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // Periodic polling for session statuses
  useEffect(() => {
    if (!authenticated) {
      return;
    }
    const intervalId = setInterval(() => {
      void refreshSessionStatuses();
    }, SESSION_POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [authenticated, refreshSessionStatuses]);

  const selectSession = useCallback((id: string) => {
    setSelectedSessionId(id);
    localStorage.setItem(SELECTED_SESSION_KEY, id);
  }, []);

  const createSession = useCallback(
    async (name: string, address: string, expectedSaveName: string): Promise<SessionDTO> => {
      const newSession = await sessionApi.create(name, address, expectedSaveName);
      setSessions((prev) => [...prev, newSession]);

      // Adding a session is a request to look at it, so it always becomes the
      // selected one rather than only when nothing was selected before.
      setSelectedSessionId(newSession.id);
      localStorage.setItem(SELECTED_SESSION_KEY, newSession.id);

      return newSession;
    },
    []
  );

  const updateSession = useCallback(
    async (
      id: string,
      updates: { name?: string; isPaused?: boolean; address?: string }
    ): Promise<SessionDTO> => {
      const updatedSession = await sessionApi.update(id, updates);
      setSessions((prev) => prev.map((s) => (s.id === id ? updatedSession : s)));
      return updatedSession;
    },
    []
  );

  const updateSessionFromEvent = useCallback((session: SessionDTO) => {
    setSessions((prev) => prev.map((s) => (s.id === session.id ? session : s)));
  }, []);

  const deleteSession = useCallback(
    async (id: string): Promise<void> => {
      await sessionApi.delete(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));

      // If deleted session was selected, select another
      if (selectedSessionId === id) {
        const remaining = sessions.filter((s) => s.id !== id);
        if (remaining.length > 0) {
          setSelectedSessionId(remaining[0].id);
          localStorage.setItem(SELECTED_SESSION_KEY, remaining[0].id);
        } else {
          setSelectedSessionId(null);
          localStorage.removeItem(SELECTED_SESSION_KEY);
        }
      }
    },
    [selectedSessionId, sessions]
  );

  const previewSession = useCallback(async (address: string): Promise<SessionInfo> => {
    const result = await sessionApi.preview(address);
    return result.sessionInfo;
  }, []);

  const discoverSessions = useCallback(() => sessionApi.discover(), []);

  const contextValue: SessionContextType = useMemo(
    () => ({
      sessions,
      selectedSession,
      isLoading,
      error,
      selectSession,
      createSession,
      updateSession,
      updateSessionFromEvent,
      deleteSession,
      refreshSessions,
      previewSession,
      discoverSessions,
    }),
    [
      sessions,
      selectedSession,
      isLoading,
      error,
      selectSession,
      createSession,
      updateSession,
      updateSessionFromEvent,
      deleteSession,
      refreshSessions,
      previewSession,
      discoverSessions,
    ]
  );

  return <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>;
};
