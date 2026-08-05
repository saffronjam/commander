import 'src/index.css';

import { useEffect } from 'react';
import { toast } from 'sonner';

import { useScrollToTop } from 'src/hooks/use-scroll-to-top';
import { Router } from 'src/routes/sections';

import { ConnectionCheckerProvider } from './contexts/api/ConnectionChecker';
import { useAuth } from './contexts/auth/useAuth';

/**
 * Root application component that handles routing and global notifications.
 * Displays a session expiration notification when the session times out.
 */
export default function App() {
  useScrollToTop();
  const { sessionExpired, clearSessionExpired } = useAuth();

  useEffect(() => {
    if (sessionExpired) {
      toast.info('Session expired. Please sign in again.', { duration: 5000 });
      clearSessionExpired();
    }
  }, [sessionExpired, clearSessionExpired]);

  return (
    <>
      <ConnectionCheckerProvider />
      <Router />
    </>
  );
}
