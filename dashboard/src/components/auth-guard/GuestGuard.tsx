import { Navigate } from 'react-router-dom';
import { useAuth } from 'src/contexts/auth/useAuth';

interface GuestGuardProps {
  children: React.ReactNode;
}

/**
 * Protects the login route. An unclaimed instance belongs in setup, and an open
 * instance has no access key to enter, so neither should ever see a login form.
 */
export function GuestGuard({ children }: GuestGuardProps) {
  const { initialized, authRequired, authenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!initialized) {
    return <Navigate to="/setup" replace />;
  }

  if (!authRequired || authenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
