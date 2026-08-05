import { Navigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { useAuth } from 'src/contexts/auth/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Gates the dashboard on the instance's authorization state. An unclaimed
 * instance goes to setup; a password-protected one goes to login; an open one
 * passes straight through, since the server reports every caller as authorized.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { initialized, authenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-screen">
        <Progress className="w-full max-w-80" />
      </div>
    );
  }

  if (!initialized) {
    return <Navigate to="/setup" replace />;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
