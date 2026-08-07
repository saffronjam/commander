import { Iconify } from '@/components/iconify';
import { ConnectionStateOffline, ConnectionStateSaveMismatch } from 'src/apiTypes';
import { useSession } from '@/contexts/sessions';
import { offlineCopy, saveMismatchCopy } from 'src/utils/session-offline';

/**
 * Status bar displayed at the bottom of the screen when the selected session
 * cannot serve data. The message depends on whether the server is unreachable or
 * simply running the wrong save.
 */
export const SessionStatusBar = () => {
  const { selectedSession, isLoading } = useSession();

  // Only a settled failure warrants the bar; while connecting the overlay
  // already says so, and flashing this on every reconnect would be noise.
  if (isLoading || !selectedSession) {
    return null;
  }

  const isOffline = selectedSession.connectionState === ConnectionStateOffline;
  const isSaveMismatch = selectedSession.connectionState === ConnectionStateSaveMismatch;
  if (!isOffline && !isSaveMismatch) {
    return null;
  }

  const copy = isSaveMismatch
    ? saveMismatchCopy(selectedSession.saveName, selectedSession.mismatchedSaveName)
    : offlineCopy(selectedSession.offlineReason);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-10 bg-destructive flex items-center justify-center gap-2 px-2">
      <Iconify icon="mdi:alert-circle" width={18} className="text-destructive-foreground" />
      <span className="text-sm text-destructive-foreground font-medium">{copy.bar}</span>
    </div>
  );
};
