import { Iconify } from '@/components/iconify';
import { ConnectionStateOffline } from 'src/apiTypes';
import { useSession } from '@/contexts/sessions';
import { offlineCopy } from 'src/utils/session-offline';

/**
 * Status bar displayed at the bottom of the screen when a session is offline.
 * The message depends on why the backend could not reach it.
 */
export const SessionStatusBar = () => {
  const { selectedSession, isLoading } = useSession();

  // Only a settled offline state warrants the bar; while connecting the overlay
  // already says so, and flashing this on every reconnect would be noise.
  if (isLoading || selectedSession?.connectionState !== ConnectionStateOffline) {
    return null;
  }

  const copy = offlineCopy(selectedSession.offlineReason);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-10 bg-destructive flex items-center justify-center gap-2 px-2">
      <Iconify icon="mdi:alert-circle" width={18} className="text-destructive-foreground" />
      <span className="text-sm text-destructive-foreground font-medium">{copy.bar}</span>
    </div>
  );
};
