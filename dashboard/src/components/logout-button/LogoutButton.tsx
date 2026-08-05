import { LogOut } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/auth/useAuth';

/**
 * Logout button for the sidebar. Renders nothing on an open instance, where
 * there is no access key and so nothing to sign out of.
 */
export function LogoutButton() {
  const { authRequired, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }, [logout]);

  if (!authRequired) {
    return null;
  }

  // No wrapper padding: the sidebar footer already insets its children, and an
  // extra inset here would misalign this against the nav items above it.
  return (
    <Button
      variant="ghost"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="h-8 w-full justify-start gap-2 px-2 text-sm font-normal group-data-[collapsible=icon]:justify-center"
    >
      {isLoggingOut ? <Spinner className="size-4" /> : <LogOut className="size-4" />}
      <span className="group-data-[collapsible=icon]:hidden">
        {isLoggingOut ? 'Signing out...' : 'Sign out'}
      </span>
    </Button>
  );
}
