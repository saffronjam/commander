import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '@/services/authApi';
import { createContext } from 'use-context-selector';

/**
 * Authentication state and actions exposed by AuthContext.
 *
 * All three flags come from the server's authStatus, the only query readable
 * before authenticating, so it is the single source of truth for what the client
 * should render.
 */
export interface AuthContextType {
  /** Whether first-run setup has completed. False means route to /setup. */
  initialized: boolean;
  /** Whether an access key is needed at all. False on an open instance. */
  authRequired: boolean;
  /** Whether this caller may read guarded data. Always true on an open instance. */
  authenticated: boolean;
  /** Whether the initial status probe is still in flight */
  isLoading: boolean;
  /** Error message if the status probe failed */
  error: string | null;
  /** Whether the session expired (for showing a notification) */
  sessionExpired: boolean;
  /** Authenticate with the access key */
  login: (password: string) => Promise<void>;
  /** Log out and drop the token */
  logout: () => Promise<void>;
  /** Re-check status with the server */
  checkAuthStatus: () => Promise<void>;
  /** Clear the session expired flag after showing a notification */
  clearSessionExpired: () => void;
}

const defaultAuthContext: AuthContextType = {
  initialized: false,
  authRequired: true,
  authenticated: false,
  isLoading: true,
  error: null,
  sessionExpired: false,
  login: async () => {
    throw new Error('AuthProvider not initialized');
  },
  logout: async () => {},
  checkAuthStatus: async () => {},
  clearSessionExpired: () => {},
};

/**
 * React context for authentication state and actions.
 * Use the useAuth hook to access this context with optimized re-renders.
 */
export const AuthContext = createContext<AuthContextType>(defaultAuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

/** Custom event name for unauthenticated GraphQL responses */
const AUTH_EXPIRED_EVENT = 'auth:expired';

/**
 * Dispatch an authentication expired event.
 * Called from the GraphQL client when a response comes back unauthenticated.
 */
export function dispatchAuthExpired(): void {
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

/**
 * Provides authentication state and actions to the application.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [initialized, setInitialized] = useState(false);
  const [authRequired, setAuthRequired] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const wasAuthenticatedRef = useRef(false);

  const checkAuthStatus = useCallback(async () => {
    try {
      setError(null);
      const status = await authApi.getStatus();
      setInitialized(status.initialized);
      setAuthRequired(status.authRequired);
      setAuthenticated(status.authenticated);
    } catch (err) {
      setAuthenticated(false);
      setError(err instanceof Error ? err.message : 'Failed to check authentication status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    async (password: string) => {
      setError(null);
      setSessionExpired(false);
      const response = await authApi.login(password);
      if (!response.success) {
        throw new Error(response.message || 'Authentication failed');
      }
      await checkAuthStatus();
    },
    [checkAuthStatus]
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    await checkAuthStatus();
  }, [checkAuthStatus]);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  /**
   * Re-probe rather than assuming the worst. A late unauthenticated response from
   * an unrelated in-flight query would otherwise log out a caller who is in fact
   * authenticated, and would break open mode entirely.
   */
  const handleAuthExpired = useCallback(() => {
    if (wasAuthenticatedRef.current) {
      setSessionExpired(true);
    }
    void checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    wasAuthenticatedRef.current = authenticated;
  }, [authenticated]);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, [handleAuthExpired]);

  useEffect(() => {
    void checkAuthStatus();
  }, [checkAuthStatus]);

  const contextValue: AuthContextType = useMemo(
    () => ({
      initialized,
      authRequired,
      authenticated,
      isLoading,
      error,
      sessionExpired,
      login,
      logout,
      checkAuthStatus,
      clearSessionExpired,
    }),
    [
      initialized,
      authRequired,
      authenticated,
      isLoading,
      error,
      sessionExpired,
      login,
      logout,
      checkAuthStatus,
      clearSessionExpired,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
