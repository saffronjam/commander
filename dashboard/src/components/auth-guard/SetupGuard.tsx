import { Navigate } from 'react-router-dom';
import { useAuth } from 'src/contexts/auth/useAuth';

interface SetupGuardProps {
  children: React.ReactNode;
}

/**
 * Protects the setup route so a claimed instance cannot be walked through
 * first-run again. The server refuses a second claim regardless; this just keeps
 * the screen from being reachable.
 */
export function SetupGuard({ children }: SetupGuardProps) {
  const { initialized, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (initialized) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
