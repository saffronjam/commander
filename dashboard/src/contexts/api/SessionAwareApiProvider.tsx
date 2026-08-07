import React, { useCallback } from 'react';
import type { SessionDTO } from 'src/apiTypes';
import { useSession } from 'src/contexts/sessions';
import { ApiProvider } from './ApiProvider';

interface SessionAwareApiProviderProps {
  children: React.ReactNode;
}

/**
 * Binds the live API provider to the selected session.
 *
 * The key is the session id alone: a session is pinned to one save for its
 * lifetime, so switching sessions is the only thing that invalidates every
 * subscription at once.
 */
export const SessionAwareApiProvider: React.FC<SessionAwareApiProviderProps> = ({ children }) => {
  const { selectedSession, updateSessionFromEvent } = useSession();

  const handleSessionUpdate = useCallback(
    (session: SessionDTO) => {
      updateSessionFromEvent(session);
    },
    [updateSessionFromEvent]
  );

  return (
    <ApiProvider
      key={selectedSession?.id ?? null}
      sessionId={selectedSession?.id || null}
      sessionStage={selectedSession?.stage || null}
      onSessionUpdate={handleSessionUpdate}
    >
      {children}
    </ApiProvider>
  );
};
