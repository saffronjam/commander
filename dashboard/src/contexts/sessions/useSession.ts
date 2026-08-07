import { useContextSelector } from 'use-context-selector';
import { SessionContext, SessionContextType } from './SessionContext';

export function useSession(): SessionContextType {
  const sessions = useContextSelector(SessionContext, (ctx) => ctx.sessions);
  const selectedSession = useContextSelector(SessionContext, (ctx) => ctx.selectedSession);
  const isLoading = useContextSelector(SessionContext, (ctx) => ctx.isLoading);
  const error = useContextSelector(SessionContext, (ctx) => ctx.error);
  const selectSession = useContextSelector(SessionContext, (ctx) => ctx.selectSession);
  const createSession = useContextSelector(SessionContext, (ctx) => ctx.createSession);
  const updateSession = useContextSelector(SessionContext, (ctx) => ctx.updateSession);
  const updateSessionFromEvent = useContextSelector(
    SessionContext,
    (ctx) => ctx.updateSessionFromEvent
  );
  const deleteSession = useContextSelector(SessionContext, (ctx) => ctx.deleteSession);
  const refreshSessions = useContextSelector(SessionContext, (ctx) => ctx.refreshSessions);
  const previewSession = useContextSelector(SessionContext, (ctx) => ctx.previewSession);
  const discoverSessions = useContextSelector(SessionContext, (ctx) => ctx.discoverSessions);

  return {
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
  };
}
