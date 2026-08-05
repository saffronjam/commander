import { PauseCircle, WifiOff } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { ConnectionStateConnecting, ConnectionStateOffline, SessionStageReady } from 'src/apiTypes';
import { Spinner } from '@/components/loading/spinner';
import { useSession } from 'src/contexts/sessions';
import { offlineCopy } from 'src/utils/session-offline';

/** Pages that are instance-wide rather than scoped to the selected session. */
const INSTANCE_WIDE_PATHS = ['/settings', '/debug'];

/**
 * Covers the session-scoped pages when the selected session cannot show data yet.
 *
 * The three cases are distinct on purpose: a paused session, an unreachable one,
 * and one that is reachable but has not delivered its first data. Only the last
 * is a wait, so only the last gets a spinner.
 */
export const SessionInitOverlay = () => {
  const location = useLocation();
  const { selectedSession } = useSession();

  // Instance-wide pages do not belong to a session, so a session that is still
  // initializing must not block them.
  const isInstanceWidePage = INSTANCE_WIDE_PATHS.some((path) => location.pathname.startsWith(path));
  if (isInstanceWidePage) {
    return null;
  }

  if (!selectedSession) {
    return null;
  }

  const isReady = selectedSession.stage === SessionStageReady;
  const isPaused = selectedSession.isPaused;
  const isOffline = selectedSession.connectionState === ConnectionStateOffline;
  const isConnecting = selectedSession.connectionState === ConnectionStateConnecting;

  if (isReady && !isPaused && !isOffline && !isConnecting) {
    return null;
  }

  const content = () => {
    if (isPaused) {
      return {
        icon: <PauseCircle className="size-16 opacity-80" />,
        title: 'Session is paused',
        detail: 'Enable this session to view its data',
      };
    }
    if (isOffline) {
      const copy = offlineCopy(selectedSession.offlineReason);
      return {
        icon: <WifiOff className="size-16 opacity-80" />,
        title: copy.title,
        detail: copy.detail,
      };
    }
    if (isConnecting) {
      return {
        icon: <Spinner size="xl" />,
        title: 'Connecting to FRM',
        detail: `Reaching ${selectedSession.address}...`,
      };
    }
    return {
      icon: <Spinner size="xl" />,
      title: 'Session is being initialized',
      detail: 'Please wait while we fetch data from the Satisfactory server...',
    };
  };

  const { icon, title, detail } = content();

  return (
    <div className="fixed inset-0 md:left-[var(--sidebar-width)] z-50 text-foreground bg-background flex flex-col items-center justify-center gap-4">
      {icon}
      <div className="max-w-md px-6 text-center">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
};
